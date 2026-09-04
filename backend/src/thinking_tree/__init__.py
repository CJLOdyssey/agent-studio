"""思维树类型——用于推理可视化的结构化节点。"""

from dataclasses import dataclass
from typing import Literal

ThinkingNodeType = Literal["thought", "tool_call"]


@dataclass
class RefLink:
    """来自搜索/工具结果的引用链接。"""

    title: str
    url: str
    snippet: str | None = None


@dataclass
class ThinkingNode:
    """思维树中的单个节点。

    - ``thought`` 节点：普通推理文本（同前）
    - ``tool_call`` 节点：带名称、参数与可选引用的工具调用
    """

    type: ThinkingNodeType
    content: str
    tool_name: str | None = None
    tool_params: dict[str, str] | None = None
    references: list[RefLink] | None = None
