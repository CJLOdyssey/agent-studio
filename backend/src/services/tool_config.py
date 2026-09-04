"""用于 agent 工具执行的 ToolConfig 数据类 + _ToolWrapper。"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from core._interfaces import ToolDescriptor

from core.infra.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class ToolConfig:
    """用于向 agent 图注册的轻量工具描述符。"""

    name: str
    description: str = ""
    parameters: dict[str, Any] | None = None
    instructions: str = ""
    mcp_type: str = ""
    mcp_endpoint: str = ""
    mcp_tool_name: str = ""
    mcp_config: dict[str, Any] | None = None
    endpoint: str = ""
    method: str = "GET"
    headers: str = "{}"


# ── MCP 会话存储 ──────────────────────────────────────────
# 在一次图运行内跨工具调用复用。
_mcp_sessions: dict[str, tuple[Any, Any, Any]] = {}


# ── _ToolWrapper ────────────────────────────────────────────────


class _ToolWrapper:
    """包装工具名，使其能被图的工具节点调用。

    根据工具配置字段分发到正确的处理器（不做硬编码的工具名匹配）。
    """

    def __init__(
        self,
        name: str,
        description: str = "",
        instructions: str = "",
        mcp_type: str = "",
        mcp_endpoint: str = "",
        mcp_tool_name: str = "",
        mcp_config: dict[str, Any] | None = None,
        endpoint: str = "",
        method: str = "GET",
        headers: str = "{}",
    ):
        self.name = name
        self.description = description
        self.instructions = instructions
        self.mcp_type = mcp_type
        self.mcp_endpoint = mcp_endpoint
        self.mcp_tool_name = mcp_tool_name
        self.mcp_config = mcp_config
        self.endpoint = endpoint
        self.method = method
        self.headers = headers
        self._llm = None
        self._run_id: str | None = None

    def set_llm(self, llm: Any) -> None:
        """设置用于工具回退执行的 LLM 实例。"""
        self._llm = llm

    def set_run_id(self, run_id: str) -> None:
        """设置当前 run ID 以用于事件发布。"""
        self._run_id = run_id

    # ── 分发 ────────────────────────────────────────────────

    def _resolve_handler(self) -> str | None:
        """从工具配置字段解析处理器判别符。

        返回 'mcp'、'http'、'skill'，无匹配则返回 None。
        """
        if self.mcp_type or self.mcp_endpoint:
            return "mcp"
        if self.endpoint and self.endpoint.startswith(("http://", "https://")):
            return "http"
        # 技能工具绑定为 skill_<name>；按前缀路由，使未配置的技能
        # （instructions 为空）从 handle_skill 获得清晰提示，而非静默
        # 落入 llm_fallback。
        if self.instructions or self.name.startswith("skill_"):
            return "skill"
        return None

    async def invoke(self, args: dict[str, Any]) -> str:
        """将工具调用分发到合适的处理器。"""
        # 1) 可插拔的外部处理器
        from thinking_tree.registry import registry

        for handler in registry.get_handlers(self.name):
            try:
                result = await handler(self.name, args)
                if isinstance(result, dict) and result.get("error") and not result.get("results"):
                    continue
                return json.dumps(result, ensure_ascii=False) if not isinstance(result, str) else result
            except Exception:
                continue

        # 2) 基于字段的处理器
        from services.tool_handlers import (
            call_http_endpoint,
            handle_mcp,
            handle_skill,
        )

        kind = self._resolve_handler()
        if kind == "mcp":
            return await handle_mcp(self, args)
        if kind == "http":
            return await call_http_endpoint(self, args)
        if kind == "skill":
            return handle_skill(self, args)

        # 3) LLM 回退
        from services.tool_handlers import llm_fallback
        return await llm_fallback(self, args)


# ── 工具函数 ──────────────────────────────────────────────────


def sanitize_tool_name(name: str) -> str:
    """DeepSeek 要求工具名匹配 ``^[a-zA-Z0-9_-]+$``。

    纯非 ASCII 名称回退为 ``tool_<sha256-8>``——确定性摘要
    （``hash()`` 依赖进程种子，同一名称在不同 worker/重启间会映射到
    不同的 API 名）。
    """
    sanitized = "".join(c for c in name if c.isascii() and (c.isalnum() or c in "_-"))
    if sanitized:
        return sanitized
    return f"tool_{hashlib.sha256(name.encode()).hexdigest()[:8]}"


def build_tool_definition(
    tc: ToolConfig | ToolDescriptor,
    llm: Any = None,
) -> tuple[str, _ToolWrapper, dict[str, Any]]:
    """从 ``ToolConfig`` 创建 ``_ToolWrapper`` 和 OpenAI 工具调用定义。

    返回 ``(api_name, wrapper, definition_dict)``。
    """
    api_name = sanitize_tool_name(tc.name)
    wrapper = _ToolWrapper(
        name=tc.name,
        description=tc.description,
        instructions=tc.instructions,
        mcp_type=tc.mcp_type,
        mcp_endpoint=tc.mcp_endpoint,
        mcp_tool_name=tc.mcp_tool_name,
        mcp_config=getattr(tc, "mcp_config", None),
        endpoint=tc.endpoint,
        method=tc.method,
        headers=tc.headers,
    )
    if llm is not None:
        wrapper.set_llm(llm)

    schema: dict[str, Any] = {"type": "object"}
    if isinstance(tc.parameters, dict) and tc.parameters:
        props = tc.parameters.get("properties", {}) or {}
        schema = tc.parameters if props else {"type": tc.parameters.get("type", "object")}

    # 为搜索工具补充可选的 Tavily 参数（topic、time_range），
    # 使 LLM 能在需要时效性或主题特定搜索时传入它们。
    search_tools = {"web_search", "tavily", "TavilyAISearch", "search"}
    tool_key = api_name.lower().replace("_", "").replace("-", "")
    if any(st in tool_key or tool_key in st for st in search_tools):
        props = schema.setdefault("properties", {})
        if "topic" not in props:
            props["topic"] = {
                "type": "string",
                "enum": ["general", "news", "finance"],
                "description": (
                    "Search category. Use 'news' for current events/news searches, "
                    "'finance' for financial data, 'general' otherwise."
                ),
            }
        if "time_range" not in props:
            props["time_range"] = {
                "type": "string",
                "enum": ["day", "week", "month", "year"],
                "description": (
                    "Time range back from today. Use 'day' or 'week' for recent news, "
                    "'month' or 'year' for broader historical search."
                ),
            }
        if "required" not in schema:
            schema["required"] = ["query"]
        elif "query" not in schema["required"]:
            schema["required"].append("query")

    definition = {
        "type": "function",
        "function": {"name": api_name, "description": tc.description, "parameters": schema},
    }
    return api_name, wrapper, definition
