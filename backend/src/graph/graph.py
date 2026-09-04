"""基于 LangGraph 的单 Agent 引擎，支持 DeepSeek 深度思考。

架构：
  START -> agent -> [是否有 tool_calls?] --是--> tools -> agent
                    `-- 否 ---> END
"""

from __future__ import annotations

import contextlib
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from typing import Any, cast

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.runnables.config import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, StateGraph
from langgraph.graph.state import CompiledStateGraph

from core._interfaces import StreamResponseHandler, ToolDescriptor, ToolExecutor
from core.infra.logging_config import get_logger
from graph.graph_state import AgentState  # noqa: F401  # 为向后兼容重新导出
from graph.helpers import as_text, emit_balance_warning, is_balance_error
from services.tool_config import ToolConfig, build_tool_definition
from streaming.llm_stream import (
    stream_llm_response,
)

# 向后兼容：辅助函数已迁移到 graph.helpers，保留旧导入路径。
_as_text = as_text
_is_balance_error = is_balance_error
_emit_balance_warning = emit_balance_warning

logger = get_logger(__name__)


class SingleAgentGraph:
    """构建并运行带 DeepSeek 深度思考支持的 ReAct agent 图。"""

    def __init__(
        self,
        model: str,
        api_key: str,
        base_url: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 16384,
        checkpointer: BaseCheckpointSaver[Any] | None = None,
        image_model: bool = False,
    ):
        """使用 LLM 和 checkpointer 初始化 ReAct agent 图。"""
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.image_model = image_model
        self._run_id = None
        self._last_usage: dict[str, Any] = {}
        # ── 追踪（粒度 B）上下文：通过 run_traced 运行时设置 ──
        self._trace_root_id: str | None = None
        self._trace_session_id: str | None = None
        self._trace_team_id: str | None = None
        self._trace_user_id: str | None = None
        self._trace_key_id: str | None = None
        self._trace_node_id: str = "agent"

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
            from checkpoint import create_checkpointer
            self.checkpointer = create_checkpointer()
        self._graph = self._build_graph()

        self._stream_cb: Callable[..., Any] | None = None

    # ── LLM 流式输出 ──────────────────────────────────────────

    async def _raw_llm_stream(
        self,
        messages: list[BaseMessage],
        _stream_handler: StreamResponseHandler = stream_llm_response,
    ) -> tuple[str, str, list[dict[str, Any]]]:
        """异步原始 HTTP 流式输出。委托给 graph.llm_stream 模块。"""
        from graph.llm_stream import raw_llm_stream as _impl

        return await _impl(self, messages, _stream_handler)

    # ── Graph nodes ────────────────────────────────────────────

    async def _agent_node(self, state: AgentState) -> dict[str, Any]:
        """LangGraph agent 节点——构造消息、调用 LLM、返回 AIMessage。"""
        if self.image_model:
            return await self._image_node(state)
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

    async def _image_node(self, state: AgentState) -> dict[str, Any]:
        """图像模型节点——调用服务商的 /images/generations 端点。

        非对话模型（model_types == "image"，如 Kwai-Kolors/Kolors）无法消费
        对话提示词：因此取最后一条用户消息文本作为提示词，并把生成的图片 URL
        以 markdown 形式返回，使前端现有的 markdown 渲染器能内联展示。
        """
        messages = state.get("messages", [])
        prompt = ""
        for m in reversed(messages):
            if getattr(m, "type", "") == "human":
                prompt = str(m.content or "")
                break
        if not prompt.strip():
            prompt = "请生成一张图片"

        if self._stream_cb:
            with contextlib.suppress(Exception):
                await self._stream_cb({
                    "event": "on_custom_thinking",
                    "data": {"content": f"正在使用 {self.model} 生成图片…"},
                })

        from streaming.image_generation import generate_image

        image_url = await generate_image(
            self.api_key,
            prompt,
            model=self.model,
            base_url=self.base_url,
        )
        content = f"![生成的图片]({image_url})"

        if self._stream_cb:
            with contextlib.suppress(Exception):
                await self._stream_cb({
                    "event": "on_custom_token",
                    "data": {"content": content},
                })
            await self._stream_cb({"event": "on_node_end", "data": {}})

        return {"messages": [AIMessage(content=content)]}

    async def _tools_node(self, state: AgentState) -> dict[str, Any]:
        """LangGraph 工具节点。委托给 graph.tools_node 模块。"""
        from graph.tools_node import tools_node as _impl

        return await _impl(self, state)

    def _should_continue(self, state: AgentState) -> str:
        """条件边：最后一条消息含 tool_calls 则继续，否则 END。"""
        messages = state.get("messages", [])
        if messages and isinstance(messages[-1], AIMessage) and messages[-1].tool_calls:
            return "tools"
        return END

    def _build_graph(self) -> CompiledStateGraph[Any]:
        """构建 LangGraph StateGraph。"""
        builder = StateGraph(AgentState)
        builder.add_node("agent", self._agent_node)
        builder.add_node("tools", self._tools_node)
        builder.set_entry_point("agent")
        builder.add_conditional_edges("agent", self._should_continue, {"tools": "tools", END: END})
        builder.add_edge("tools", "agent")
        return builder.compile(checkpointer=self.checkpointer)

    # ── 公共 API ─────────────────────────────────────────────

    def set_stream_callback(self, cb: Callable[..., Any]) -> None:
        """设置流式事件的回调。"""
        self._stream_cb = cb

    def bind_tools(self, tools: Sequence[ToolDescriptor | ToolConfig]) -> None:
        """向图注册工具定义与执行器。"""
        for tc in tools:
            api_name, wrapper, definition = build_tool_definition(tc, llm=self.llm)
            self._tool_map[api_name] = wrapper
            self._tool_definitions.append(definition)

    @property
    def graph(self) -> CompiledStateGraph[Any]:
        """返回已编译的 LangGraph 状态图。"""
        return self._graph

    def with_config(self, **kwargs: Any) -> SingleAgentGraph:
        """返回自身（配置透传，用于接口兼容）。"""
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
        """以给定需求运行 agent 图并返回结果。"""
        if run_id:
            for wrapper in self._tool_map.values():
                wrapper.set_run_id(run_id)
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
            "input_tokens": usage.get("input_tokens") or usage.get("prompt_tokens", 0),
            "output_tokens": usage.get("output_tokens") or usage.get("completion_tokens", 0),
            "model": self.model,
        }

    async def run_traced(
        self,
        requirement: str,
        system_prompt: str = "",
        session_context: str = "",
        chat_history: list[Any] | None = None,
        thread_id: str = "",
        run_id: str = "",
        session_id: str | None = None,
        team_id: str | None = None,
        user_id: str | None = None,
        key_id: str | None = None,
        node_id: str = "agent",
    ) -> dict[str, Any]:
        """带追踪的运行。委托给 graph.traced 模块。"""
        from graph.traced import run_traced as _impl

        return await _impl(
            self,
            requirement=requirement,
            system_prompt=system_prompt,
            session_context=session_context,
            chat_history=chat_history,
            thread_id=thread_id,
            run_id=run_id,
            session_id=session_id,
            team_id=team_id,
            user_id=user_id,
            key_id=key_id,
            node_id=node_id,
        )

    async def arun(self, message: str, system_prompt: str = "", session_context: str = "") -> str:
        """同步运行一轮并返回响应文本。"""
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



