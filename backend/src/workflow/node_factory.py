"""Node factory — creates callable LangGraph nodes from workflow definitions."""

import contextlib
import json
from collections.abc import Awaitable, Callable
from typing import Any, Protocol

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from broker import publish_run_message
from services.thinking_chain import format_result_preview, get_tool_prefix
from services.tool_config import ToolConfig, build_tool_definition
from streaming.llm_stream import (
    build_tool_calls_list,
    convert_messages_to_api,
    stream_llm_response,
)

from .models import WorkflowNode, WorkflowState
from .strategy_registry import registry

# Cap tool-call turns inside a single node so a misbehaving model can't loop.
_MAX_TOOL_ROUNDS = 8


def _validate_json(text: str, schema: dict[str, Any]) -> bool:
    """Check *text* parses as JSON and contains every ``required`` schema field."""
    data: Any = None
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            try:
                data = json.loads(text[start : end + 1])
            except (json.JSONDecodeError, ValueError):
                return False
        else:
            return False
    if not isinstance(data, dict):
        return False
    required = schema.get("required", [])
    return all(key in data for key in required)


class LLMConfig(Protocol):
    """Protocol for LLM configuration — any object with these attributes works.

    ChatOpenAI fields are Optional in practice (temperature/max_tokens default to None),
    so the Protocol mirrors that reality. The factory uses getattr() with defaults to
    handle None values at call sites.
    """

    openai_api_key: Any
    openai_api_base: str | None
    model_name: str
    temperature: float | None
    max_tokens: int | None


class NodeFactory:
    """Factory that creates callable LangGraph nodes from workflow definitions."""

    def __init__(
        self,
        llm: LLMConfig,
        agent_prompts: dict[str, str],
        tools: list[ToolConfig] | None = None,
        node_tools: dict[str, list[ToolConfig]] | None = None,
        run_id: str = "",
    ):
        """Initialize the node factory with LLM config, prompts, and optional tools.

        ``tools`` applies to every node as a fallback; ``node_tools`` maps a
        ``role_identifier`` to its own ToolConfig list, which takes precedence.
        """
        self.llm = llm
        self.agent_prompts = agent_prompts
        self.tools = tools or []
        self.node_tools = node_tools or {}
        self.run_id = run_id

    def _build_request(
        self,
        api_messages: list[dict[str, Any]],
        tool_definitions: list[dict[str, Any]] | None = None,
    ) -> tuple[str, dict[str, Any], dict[str, Any]]:
        """Build the HTTP request for the LLM streaming API."""
        raw_key = getattr(self.llm, "openai_api_key", "")
        actual_key = raw_key.get_secret_value() if hasattr(raw_key, "get_secret_value") else str(raw_key)
        base = (getattr(self.llm, "openai_api_base", None) or "https://api.deepseek.com").rstrip("/")
        url = f"{base}/chat/completions"
        headers = {"Authorization": f"Bearer {actual_key}", "Content-Type": "application/json"}
        body: dict[str, Any] = {
            "model": getattr(self.llm, "model_name", "deepseek-chat"),
            "messages": api_messages,
            "stream": True,
            "stream_options": {"include_usage": True},
            "temperature": getattr(self.llm, "temperature", 0.7),
            "max_tokens": getattr(self.llm, "max_tokens", None),
        }
        if tool_definitions:
            body["tools"] = tool_definitions
            body["tool_choice"] = "auto"
        elif "deepseek" in (base.lower() + body["model"].lower()):
            # DeepSeek's native thinking mode conflicts with tool calling —
            # only enable it when no tools are bound (matches build_llm_request_body).
            body["thinking"] = {"type": "enabled"}
        return url, headers, body

    def _node_tool_configs(
        self, node: WorkflowNode
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """Resolve and register tool definitions + wrappers for a node.

        Returns ``(definitions, tool_map)`` where ``tool_map`` maps the API tool
        name to a ``_ToolWrapper``. Node-specific configs win over the fallback
        ``tools`` list.
        """
        configs = self.node_tools.get(node.role_identifier)
        if configs is None:
            configs = self.tools
        if not configs:
            return [], {}
        definitions: list[dict[str, Any]] = []
        tool_map: dict[str, Any] = {}
        for tc in configs:
            api_name, wrapper, definition = build_tool_definition(tc, llm=self.llm)
            if self.run_id:
                wrapper.set_run_id(self.run_id)
            tool_map[api_name] = wrapper
            definitions.append(definition)
        return definitions, tool_map

    def create(self, node: WorkflowNode) -> Callable[[WorkflowState], dict[str, Any] | Awaitable[dict[str, Any]]]:
        """Create a callable node function for a workflow node."""
        strategy = registry.get(node.strategy.value)
        system_prompt = self.agent_prompts.get(node.role_identifier, "")
        run_id = self.run_id
        tool_definitions, tool_map = self._node_tool_configs(node)

        async def node_fn(state: WorkflowState) -> dict[str, Any]:
            context = strategy.build_prompt_context(state, node)
            messages = [SystemMessage(content=system_prompt), HumanMessage(content=context)]
            api_msgs = convert_messages_to_api(messages)

            async def cb(ev: dict[str, Any]) -> Any:
                if not run_id:
                    return
                chunk = ev.get("data", {}).get("content", "")
                if not chunk:
                    return
                mt = "thinking_stream" if ev.get("event") == "on_custom_thinking" else "stream"
                with contextlib.suppress(Exception):
                    await publish_run_message(
                        run_id,
                        {"type": mt, "agent_name": node.role_identifier, "content": chunk},
                    )

            full_content = ""
            tool_round_exhausted = False
            for _ in range(_MAX_TOOL_ROUNDS + 1):
                url, headers, body = self._build_request(api_msgs, tool_definitions)
                content_chunks, _, tool_calls_map, _, _ = await stream_llm_response(
                    url, headers, body, cb, tool_definitions
                )
                full_content = "".join(content_chunks)
                tool_calls = build_tool_calls_list(tool_calls_map or {})
                if not tool_calls:
                    break

                messages.append(AIMessage(
                    content=full_content,
                    tool_calls=[
                        {"name": tc["name"], "args": tc["args"], "id": tc["id"]}
                        for tc in tool_calls
                    ],
                ))
                tool_messages = []
                for tc in tool_calls:
                    name = tc.get("name", "")
                    args = tc.get("args", {}) or {}
                    fn = tool_map.get(name)
                    prefix = get_tool_prefix(name)
                    args_preview = json.dumps(args, ensure_ascii=False)[:200]
                    await cb({"event": "on_custom_thinking", "data": {"content": f"{prefix} {name}({args_preview})"}})
                    if fn:
                        try:
                            result = await fn.invoke(args)
                        except Exception as exc:
                            result = f"Error: {exc}"
                    else:
                        result = f"Unknown tool: {name}"
                    await cb({
                        "event": "on_custom_thinking",
                        "data": {"content": f"[result] {name} → {format_result_preview(result)}"},
                    })
                    tool_messages.append(ToolMessage(
                        content=str(result or ""),
                        tool_call_id=tc.get("id", ""),
                        name=name,
                    ))
                messages.extend(tool_messages)
                api_msgs = convert_messages_to_api(messages)
            else:
                tool_round_exhausted = True

            if tool_round_exhausted:
                # Every tool round returned tool_calls — the appended ToolMessages
                # are never re-sent, so the node output may be incomplete/empty.
                # Surface that to the user via the thinking chain ([info] node).
                await cb({
                    "event": "on_custom_thinking",
                    "data": {
                        "content": (
                            f"[info] 工具调用轮数已达上限（{_MAX_TOOL_ROUNDS + 1} 轮），"
                            "本轮输出可能不完整"
                        )
                    },
                })

            schema = getattr(strategy, "output_schema", None)
            if schema:
                for _ in range(2):
                    if _validate_json(full_content, schema):
                        break
                    messages.append(AIMessage(content=full_content))
                    messages.append(HumanMessage(content="输出不符合 JSON Schema，请重试（必须含 required 字段）"))
                    api_msgs = convert_messages_to_api(messages)
                    url, headers, body = self._build_request(api_msgs, tool_definitions)
                    chunks, _, _, _, _ = await stream_llm_response(url, headers, body, cb, tool_definitions)
                    full_content = "".join(chunks)

            result = strategy.process_output(state, node, full_content)
            result["messages"] = state.get("messages", []) + [AIMessage(content=full_content)]
            return result

        return node_fn
