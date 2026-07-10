"""LangGraph-based single Agent engine with DeepSeek thinking support.

Architecture:
  START -> agent -> [has tool_calls?] --yes--> tools -> agent
                    `-- no ---> END
"""

from __future__ import annotations

import json
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Annotated, Any, cast, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.graph.state import CompiledStateGraph
from langchain_core.runnables.config import RunnableConfig

from virtual_team.llm_stream import convert_messages_to_api, build_tool_calls_list, stream_llm_response
from virtual_team.logging_config import get_logger
from virtual_team.tool_config import ToolConfig, _ToolWrapper

import virtual_team.thinking_tree.tools.tavily_search  # noqa: F401

logger = get_logger(__name__)


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    system_prompt: str
    session_context: str


class SingleAgentGraph:
    """Builds and runs a ReAct agent graph with DeepSeek thinking support."""

    def __init__(
        self,
        model: str,
        api_key: str,
        base_url: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 65536,
        checkpointer: BaseCheckpointSaver | None = None,
    ):
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.temperature = temperature
        self.max_tokens = max_tokens
        self._run_id = None
        self._last_usage: dict = {}

        llm_kwargs = {
            "model": model,
            "api_key": api_key,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if base_url:
            llm_kwargs["base_url"] = base_url
        self.llm = ChatOpenAI(**llm_kwargs)

        self._tools: list = []
        self._tool_map: dict = {}
        self._tool_definitions: list[dict] = []
        if checkpointer is not None:
            self.checkpointer = checkpointer
        else:
            from virtual_team.checkpoint import create_checkpointer
            self.checkpointer = create_checkpointer()
        self._graph = self._build_graph()

        self._stream_cb: Callable | None = None

    # ── LLM streaming ──────────────────────────────────────────

    async def _raw_llm_stream(self, messages: list[BaseMessage]) -> tuple[str, str, list[dict]]:
        """Async raw HTTP streaming — captures content + reasoning_content + tool_calls."""
        api_messages = convert_messages_to_api(messages)
        url, headers, body = self._build_request_body(api_messages)

        content_chunks, thinking_chunks, tool_calls_map, finish_reason, usage_info = (
            await stream_llm_response(url, headers, body, self._stream_cb, self._tool_definitions)
        )

        full_content = "".join(content_chunks)
        thinking = "".join(thinking_chunks).strip()

        final_tool_calls = build_tool_calls_list(tool_calls_map)

        logger.info(
            "Raw LLM | content=%d chars | thinking=%d chars | tool_calls=%d | finish=%s",
            len(full_content), len(thinking), len(final_tool_calls), finish_reason,
        )
        if final_tool_calls:
            for tc in final_tool_calls:
                logger.info(
                    "  tool=%s args=%s",
                    tc["name"],
                    json.dumps(tc.get("args", {}), ensure_ascii=False)[:200],
                )
        self._last_usage = usage_info
        return full_content, thinking, final_tool_calls

    def _build_request_body(self, api_messages: list[dict]) -> tuple[str, dict, dict]:
        """Build the HTTP request URL, headers, and JSON body."""
        base_url = (self.base_url or "https://api.deepseek.com").rstrip("/")
        url = f"{base_url}/chat/completions"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

        body: dict = {
            "model": self.model,
            "messages": api_messages,
            "stream": True,
            "stream_options": {"include_usage": True},
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

        if self._tool_definitions:
            body["tools"] = self._tool_definitions
            body["tool_choice"] = "auto"

        is_deepseek = (
            "deepseek" in (self.base_url or "").lower() or "deepseek" in self.model.lower()
        )
        if is_deepseek and not self._tool_definitions:
            body["thinking"] = {"type": "enabled"}

        logger.info(
            "LLM request | model=%s | msgs=%d | tools=%d | thinking=%s",
            self.model, len(api_messages), len(self._tool_definitions or []),
            "thinking" in body,
        )
        if self._tool_definitions:
            logger.info(
                "Tools sent: %s",
                json.dumps([t["function"]["name"] for t in self._tool_definitions]),
            )

        return url, headers, body

    # ── Graph nodes ────────────────────────────────────────────

    async def _agent_node(self, state: AgentState) -> dict:
        """LangGraph agent node — builds messages, calls LLM, returns AIMessage."""
        messages = state.get("messages", [])
        system_prompt = state.get("system_prompt", "")
        session_context = state.get("session_context", "")

        full_messages = []
        now = datetime.now(UTC).astimezone()
        weekday_cn = ["一", "二", "三", "四", "五", "六", "日"][now.weekday()]
        date_context = (
            f"当前日期：{now.year}年{now.month}月{now.day}日 周{weekday_cn} "
            f"{now.hour:02d}:{now.minute:02d}（北京时间 CST）"
        )
        full_messages.append(SystemMessage(content=date_context))
        if system_prompt:
            full_messages.append(SystemMessage(content=system_prompt))
        if session_context:
            full_messages.append(SystemMessage(content=session_context))
        full_messages.extend(messages)

        content, thinking, raw_tool_calls = await self._raw_llm_stream(full_messages)

        kwargs: dict = {"content": content}
        if raw_tool_calls:
            kwargs["tool_calls"] = [
                {"name": tc["name"], "args": tc["args"], "id": tc["id"]}
                for tc in raw_tool_calls
            ]
        if thinking:
            kwargs["additional_kwargs"] = {"thinking": thinking}

        if thinking:
            thinking_nodes: list[dict] = [{"type": "thought", "content": thinking}]
            for tc in (raw_tool_calls or []):
                tc_name = tc.get("name", "")
                tc_args = tc.get("args", {})
                thinking_nodes.append({
                    "type": "tool_call",
                    "content": f"Calling {tc_name}",
                    "toolName": tc_name,
                    "toolParams": {k: str(v) for k, v in tc_args.items()} if tc_args else {},
                })
            if self._stream_cb:
                await self._stream_cb({
                    "event": "on_thinking_nodes",
                    "data": {"nodes": thinking_nodes},
                })
        if self._stream_cb:
            await self._stream_cb({"event": "on_node_end", "data": {}})

        return {"messages": [AIMessage(**kwargs)]}

    async def _tools_node(self, state: AgentState) -> dict:
        """LangGraph tools node — executes tool calls."""
        messages = state.get("messages", [])
        last_msg = messages[-1] if messages else None
        if not isinstance(last_msg, AIMessage) or not last_msg.tool_calls:
            return {}

        tool_messages = []
        for tc in last_msg.tool_calls:
            tool_name = tc.get("name", "")
            tool_args = tc.get("args", {})
            tool_id = tc.get("id", "")
            fn = self._tool_map.get(tool_name)
            if fn:
                try:
                    result = await fn.invoke(tool_args)
                except Exception as e:
                    result = f"Error: {e}"
            else:
                result = f"Unknown tool: {tool_name}"
            if (
                fn
                and isinstance(result, str)
                and ('"status":' in result or '"status": "' in result)
            ):
                try:
                    desc = getattr(fn, "description", "") or ""
                    prompt = (
                        f"Tool: {tool_name}\n"
                        f"Description: {desc}\n"
                        f"Args: {json.dumps(tool_args, ensure_ascii=False)}\n"
                        "Execute and return ONLY the result (no markdown):"
                    )
                    llm_result = await self.llm.ainvoke([HumanMessage(content=prompt)])
                    result = llm_result.content
                except Exception:
                    pass
            print(f"\n[DEBUG] _tools_node: tool={tool_name} result_len={len(str(result or ''))} has_cb={self._stream_cb is not None}")  # noqa: T201

            tool_messages.append(
                ToolMessage(content=str(result or ""), tool_call_id=tool_id, name=tool_name)
            )
            if self._stream_cb:
                await self._stream_cb({
                    "event": "on_tool_result",
                    "data": {"tool": tool_name, "result": str(result or "")[:500]},
                })
        if self._stream_cb:
            await self._stream_cb({"event": "on_node_end", "data": {}})
        return {"messages": tool_messages}

    def _should_continue(self, state: AgentState) -> str:
        """Edge: continue if last message has tool_calls, else END."""
        messages = state.get("messages", [])
        if messages and isinstance(messages[-1], AIMessage) and messages[-1].tool_calls:
            return "tools"
        return END

    def _build_graph(self) -> CompiledStateGraph:
        """Build the LangGraph StateGraph."""
        builder = StateGraph(AgentState)
        builder.add_node("agent", self._agent_node)
        builder.add_node("tools", self._tools_node)
        builder.set_entry_point("agent")
        builder.add_conditional_edges("agent", self._should_continue, {"tools": "tools", END: END})
        builder.add_edge("tools", "agent")
        return builder.compile(checkpointer=self.checkpointer)

    # ── Public API ─────────────────────────────────────────────

    def set_stream_callback(self, cb: Callable) -> None:
        self._stream_cb = cb

    @staticmethod
    def _sanitize_tool_name(name: str) -> str:
        """DeepSeek requires tool names matching ^[a-zA-Z0-9_-]+$."""
        sanitized = "".join(c for c in name if c.isascii() and (c.isalnum() or c in "_-"))
        return sanitized or f"tool_{hash(name) & 0xFFFFFFFF}"

    def bind_tools(self, tools: list[ToolConfig]) -> None:
        """Bind tools to the graph — translates ToolConfig into tool definitions."""
        for tc in tools:
            api_name = self._sanitize_tool_name(tc.name)
            wrapper = _ToolWrapper(
                name=tc.name,
                description=tc.description,
                instructions=tc.instructions,
                mcp_type=tc.mcp_type,
                mcp_endpoint=tc.mcp_endpoint,
                mcp_tool_name=tc.mcp_tool_name,
                endpoint=tc.endpoint,
                method=tc.method,
                headers=tc.headers,
            )
            wrapper.set_llm(self.llm)
            self._tool_map[api_name] = wrapper
            schema = {"type": "object"}
            if tc.parameters:
                if isinstance(tc.parameters, dict):
                    props = tc.parameters.get("properties", {}) or {}
                    if props:
                        schema = tc.parameters
                    else:
                        schema = {"type": tc.parameters.get("type", "object")}
                else:
                    schema = tc.parameters
            self._tool_definitions.append({
                "type": "function",
                "function": {"name": api_name, "description": tc.description, "parameters": schema},
            })

    @property
    def graph(self) -> CompiledStateGraph:
        return self._graph

    def with_config(self, **kwargs: Any) -> "SingleAgentGraph":
        return self

    async def arun(self, message: str, system_prompt: str = "", session_context: str = "") -> str:
        """Convenience: run one turn synchronously."""
        config = cast("RunnableConfig", {"configurable": {"thread_id": str(id(self))}, "recursion_limit": 25})
        result = await self._graph.ainvoke(
            {"messages": [HumanMessage(content=message)], "system_prompt": system_prompt, "session_context": session_context},
            config,
        )
        return result["messages"][-1].content if result.get("messages") else ""


# Re-export ToolConfig for backward compatibility
from virtual_team.tool_config import ToolConfig as ToolConfig  # noqa: F401, E402, I100
# Re-export _ToolWrapper for backward compatibility
from virtual_team.tool_config import _ToolWrapper as _ToolWrapper  # noqa: F401, E402, I100