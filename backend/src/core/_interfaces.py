"""用于解耦 agent 图引擎的抽象 Protocol 接口。

这些协议定义了 ``graph.py``（SingleAgentGraph）依赖的契约，
使测试与替代实现能够替换 ``tool_config.py`` 和 ``llm_stream.py`` 中的具体类。
"""
# ▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲
from __future__ import annotations

from collections.abc import Callable
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class ToolDescriptor(Protocol):
    """向 agent 图注册工具所需的只读元数据。

    ``ToolConfig`` 的结构化子类型 —— 每个 ``ToolConfig`` 实例自动满足此协议。
    """

    name: str
    description: str
    parameters: dict[str, Any] | None
    instructions: str
    mcp_type: str
    mcp_endpoint: str
    mcp_tool_name: str
    endpoint: str
    method: str
    headers: str


@runtime_checkable
class ToolExecutor(Protocol):
    """图的 ``_tools_node`` 可调用的工具包装器的契约。

    ``_ToolWrapper`` 的结构化子类型 —— 每个 ``_ToolWrapper`` 实例自动满足此协议。
    """

    name: str
    description: str

    async def invoke(self, args: dict[str, Any]) -> str: ...

    def set_llm(self, llm: Any) -> None: ...

    def set_run_id(self, run_id: str) -> None: ...


@runtime_checkable
class StreamResponseHandler(Protocol):
    """LLM 流式响应解析器的契约。

    ``stream_llm_response`` 的结构化子类型。
    """

    async def __call__(
        self,
        url: str,
        headers: dict[str, str],
        body: dict[str, Any],
        stream_cb: Callable[..., Any] | None,
        tool_definitions: list[dict[str, Any]],
    ) -> tuple[list[str], list[str], dict[int, dict[str, Any]], str | None, dict[str, Any]]: ...


__all__ = ["ToolDescriptor", "ToolExecutor", "StreamResponseHandler"]
