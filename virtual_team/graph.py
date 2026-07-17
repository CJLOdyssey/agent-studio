"""LangGraph-based single Agent engine with DeepSeek thinking support.

Architecture:
  START -> agent -> [has tool_calls?] --yes--> tools -> agent
                    `-- no ---> END
"""

from __future__ import annotations

import json
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from typing import Any, cast

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.runnables.config import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, StateGraph
from langgraph.graph.state import CompiledStateGraph

from virtual_team._interfaces import StreamResponseHandler, ToolDescriptor, ToolExecutor
from virtual_team.graph_state import AgentState  # noqa: F401  # re-exported for backward compat
from virtual_team.llm_stream import (
    build_llm_request_body,
    build_tool_calls_list,
    convert_messages_to_api,
    stream_llm_response,
)
from virtual_team.logging_config import get_logger
from virtual_team.tool_config import ToolConfig, build_tool_definition

logger = get_logger(__name__)


class SingleAgentGraph:
    """Builds and runs a ReAct agent graph with DeepSeek thinking support."""

    def __init__(
        self,
        model: str,
        api_key: str,
        base_url: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 65536,
        checkpointer: BaseCheckpointSaver[Any] | None = None,
    ):
        """Initialize the ReAct agent graph with LLM and checkpointer."""
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.temperature = temperature
        self.max_tokens = max_tokens
        self._run_id = None
        self._last_usage: dict[str, Any] = {}

        llm_kwargs: dict[str, Any] = {
            "model": model,
            "api_key": api_key,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if base_url:
            llm_kwargs["base_url"] = base_url
        self.llm = ChatOpenAI(**llm_kwargs)

        self._tools: list[Any] = []
        self._tool_map: dict[str, ToolExecutor] = {}
        self._tool_definitions: list[dict[str, Any]] = []
        if checkpointer is not None:
            self.checkpointer = checkpointer
        else:
            from virtual_team.checkpoint import create_checkpointer
            self.checkpointer = create_checkpointer()
        self._graph = self._build_graph()

        self._stream_cb: Callable[..., Any] | None = None

    # ── LLM streaming ──────────────────────────────────────────

    async def _raw_llm_stream(
        self,
        messages: list[BaseMessage],
        _stream_handler: StreamResponseHandler = stream_llm_response,
    ) -> tuple[str, str, list[dict[str, Any]]]:
        """Async raw HTTP streaming — captures content + reasoning_content + tool_calls."""
        api_messages = convert_messages_to_api(messages)
        url, headers, body = build_llm_request_body(
            api_messages,
            model=self.model,
            api_key=self.api_key,
            base_url=self.base_url,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            tool_definitions=self._tool_definitions,
        )

        content_chunks, thinking_chunks, tool_calls_map, finish_reason, usage_info = (
            await _stream_handler(url, headers, body, self._stream_cb, self._tool_definitions)
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

    # ── Graph nodes ────────────────────────────────────────────

    async def _agent_node(self, state: AgentState) -> dict[str, Any]:
        """LangGraph agent node — builds messages, calls LLM, returns AIMessage."""
        messages = state.get("messages", [])
        system_prompt = state.get("system_prompt", "")
        session_context = state.get("session_context", "")

        full_messages: list[BaseMessage] = []
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

        kwargs: dict[str, Any] = {"content": content}
        if raw_tool_calls:
            kwargs["tool_calls"] = [
                {"name": tc["name"], "args": tc["args"], "id": tc["id"]}
                for tc in raw_tool_calls
            ]
        if thinking:
            kwargs["additional_kwargs"] = {"thinking": thinking}

        if thinking:
            thinking_nodes: list[dict[str, Any]] = [{"type": "thought", "content": thinking}]
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

    async def _tools_node(self, state: AgentState) -> dict[str, Any]:
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
                    t0 = datetime.now(UTC)
                    llm_result = await self.llm.ainvoke([HumanMessage(content=prompt)])
                    elapsed = (datetime.now(UTC) - t0).total_seconds()
                    result = str(llm_result.content) if llm_result.content else ""
                    logger.info(
                        "LLM tool-fallback | model=%s | tool=%s | elapsed=%.2fs | result_len=%d",
                        self.model, tool_name, elapsed, len(result or ""),
                    )
                except Exception as exc:
                    logger.warning("LLM tool-fallback failed | tool=%s | error=%s", tool_name, exc)
            logger.info(
                "Tool result | tool=%s | result_len=%d | has_cb=%s",
                tool_name, len(str(result or "")), self._stream_cb is not None,
            )

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

    def _build_graph(self) -> CompiledStateGraph[Any]:
        """Build the LangGraph StateGraph."""
        builder = StateGraph(AgentState)
        builder.add_node("agent", self._agent_node)
        builder.add_node("tools", self._tools_node)
        builder.set_entry_point("agent")
        builder.add_conditional_edges("agent", self._should_continue, {"tools": "tools", END: END})
        builder.add_edge("tools", "agent")
        return builder.compile(checkpointer=self.checkpointer)

    # ── Public API ─────────────────────────────────────────────

    def set_stream_callback(self, cb: Callable[..., Any]) -> None:
        """Set the callback for streaming events."""
        self._stream_cb = cb

    def bind_tools(self, tools: Sequence[ToolDescriptor | ToolConfig]) -> None:
        """Register tool definitions and executors with the graph."""
        for tc in tools:
            api_name, wrapper, definition = build_tool_definition(tc, llm=self.llm)
            self._tool_map[api_name] = wrapper
            self._tool_definitions.append(definition)

    @property
    def graph(self) -> CompiledStateGraph[Any]:
        """Return the compiled LangGraph state graph."""
        return self._graph

    def with_config(self, **kwargs: Any) -> SingleAgentGraph:
        """Return self (config passthrough for interface compatibility)."""
        return self

    async def run(
        self,
        requirement: str,
        system_prompt: str = "",
        session_context: str = "",
        chat_history: list[Any] | None = None,
        thread_id: str = "",
        run_id: str = "",
    ) -> dict[str, Any]:
        """Run the agent graph with the given requirement and return results."""
        config = cast(
            "RunnableConfig",
            {
                "configurable": {"thread_id": thread_id or run_id or str(id(self))},
                "recursion_limit": 100,
            },
        )
        initial_messages = list(chat_history) if chat_history else []
        initial_messages.append(HumanMessage(content=requirement))
        result = await self._graph.ainvoke(
            {
                "messages": initial_messages,
                "system_prompt": system_prompt,
                "session_context": session_context,
            },
            config,
        )
        usage = self._last_usage or {}
        return {
            "messages": result.get("messages", []),
            "input_tokens": usage.get("input_tokens", 0),
            "output_tokens": usage.get("output_tokens", 0),
            "model": self.model,
        }

    async def arun(self, message: str, system_prompt: str = "", session_context: str = "") -> str:
        """Run one turn synchronously and return the response text."""
        config = cast("RunnableConfig", {"configurable": {"thread_id": str(id(self))}, "recursion_limit": 25})
        result = await self._graph.ainvoke(
            {
                "messages": [HumanMessage(content=message)],
                "system_prompt": system_prompt,
                "session_context": session_context,
            },
            config,
        )
        return result["messages"][-1].content if result.get("messages") else ""



