"""LangGraph agent 引擎的 AgentState TypedDict 及共享类型定义。"""

from __future__ import annotations

from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """定义 LangGraph agent 状态结构的 TypedDict。"""

    messages: Annotated[list[BaseMessage], add_messages]
    system_prompt: str
    session_context: str


__all__ = ["AgentState"]
