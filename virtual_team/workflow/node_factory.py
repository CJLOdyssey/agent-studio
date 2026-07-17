"""Node factory — creates callable LangGraph nodes from workflow definitions."""

import contextlib
from collections.abc import Awaitable, Callable
from typing import Any, Protocol

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from virtual_team.broker import publish_run_message
from virtual_team.llm_stream import convert_messages_to_api, stream_llm_response

from .models import WorkflowNode, WorkflowState
from .strategies import get_strategy


class LLMConfig(Protocol):
    """Protocol for LLM configuration — any object with these attributes works.

    Decouples NodeFactory from concrete ChatOpenAI so tests can inject
    a SimpleNamespace or mock without type-ignore.
    """

    openai_api_key: Any
    openai_api_base: str | None
    model_name: str
    temperature: float
    max_tokens: int


class NodeFactory:
    """Factory that creates callable LangGraph nodes from workflow definitions."""

    def __init__(
        self,
        llm: LLMConfig,
        agent_prompts: dict[str, str],
        tools: list[Any] | None = None,
        run_id: str = "",
    ):
        """Initialize the node factory with LLM config, prompts, and optional tools."""
        self.llm = llm
        self.agent_prompts = agent_prompts
        self.tools = tools or []
        self.run_id = run_id

    def _build_request(self, api_messages: list[dict[str, Any]]) -> tuple[str, dict, dict]:  # type: ignore[type-arg]
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
            "max_tokens": getattr(self.llm, "max_tokens", 65536),
        }
        if "deepseek" in (base.lower() + body["model"].lower()):
            body["thinking"] = {"type": "enabled"}
        return url, headers, body

    def create(self, node: WorkflowNode) -> Callable[[WorkflowState], dict | Awaitable[dict]]:  # type: ignore[type-arg]
        """Create a callable node function for a workflow node."""
        strategy = get_strategy(node)
        system_prompt = self.agent_prompts.get(node.role_identifier, "")
        run_id = self.run_id

        async def node_fn(state: WorkflowState) -> dict[str, Any]:
            context = strategy.build_prompt_context(state, node)
            messages = [SystemMessage(content=system_prompt), HumanMessage(content=context)]
            api_msgs = convert_messages_to_api(messages)
            url, headers, body = self._build_request(api_msgs)

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

            content_chunks, _, _, _, _ = await stream_llm_response(url, headers, body, cb)
            full_content = "".join(content_chunks)
            result = strategy.process_output(state, node, full_content)
            result["messages"] = state.get("messages", []) + [AIMessage(content=full_content)]
            return result

        return node_fn
