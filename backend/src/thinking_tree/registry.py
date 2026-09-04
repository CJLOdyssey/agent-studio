"""工具注册表——面向智能体工具的可扩展插件系统。

架构：
  插件作为特定工具名的处理器注册。
  同一工具名的多个处理器构成基于优先级的回退链。

  执行流程：
    LLM 调用 "web_search"
      → registry.get_handlers("web_search")
      → [prio=100] tavily  （返回结果）
      → [prio=50]  baidu   （回退）
      → [prio=0]   bing    （兜底）

  前端发现：
    GET /api/tools/plugins → registry.list_plugins()
    返回含 config_schema 的插件元数据，用于动态表单渲染。
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

ToolHandler = Callable[[str, dict[str, Any]], Any]


class ToolRegistry:
    """将工具名映射到处理器实现。

    register_plugin() 同时注册处理器（用于执行）与元数据（用于前端发现）。
    register() 是底层变体。
    """

    def __init__(self) -> None:
        self._handlers: dict[str, list[tuple[int, ToolHandler]]] = {}
        self._plugin_infos: dict[str, dict[str, Any]] = {}

    # ── 注册 ────────────────────────────────────────────────────

    def register(self, tool_name: str, handler: ToolHandler, priority: int = 0) -> None:
        """底层：为 *tool_name* 注册处理器。

        *priority* 值越大在回退链中越先尝试。
        """
        if tool_name not in self._handlers:
            self._handlers[tool_name] = []
        self._handlers[tool_name].append((priority, handler))
        self._handlers[tool_name].sort(key=lambda x: -x[0])

    def register_plugin(
        self,
        tool_name: str,
        handler: ToolHandler,
        *,
        label: str = "",
        description: str = "",
        config_schema: dict[str, Any] | None = None,
        priority: int = 0,
    ) -> None:
        """注册带元数据的完整插件，供前端发现。

        参数：
            tool_name: 该插件处理的工具名（如 "web_search"）
            handler: 异步函数 (tool_name, args) -> dict
            label: 供 UI 显示的可读名称（如 "Tavily AI Search"）
            description: 该插件的功能说明
            config_schema: 供前端配置表单使用的 JSON Schema
            priority: 值越大在回退链中越先尝试

        """
        self.register(tool_name, handler, priority=priority)
        existing = self._plugin_infos.get(tool_name)
        if not existing or priority > existing["_priority"]:
            self._plugin_infos[tool_name] = {
                "tool_name": tool_name,
                "label": label or tool_name,
                "description": description,
                "config_schema": config_schema,
                "_priority": priority,
                "_handler": handler,
            }

    # ── 执行路由 ───────────────────────────────────────────────

    def lookup(self, tool_name: str) -> ToolHandler | None:
        """返回 *tool_name* 的最高优先级处理器。"""
        handlers = self._handlers.get(tool_name, [])
        return handlers[0][1] if handlers else None

    def get_handlers(self, tool_name: str) -> list[ToolHandler]:
        """按优先级顺序返回 *tool_name* 的所有处理器。"""
        return [h for _, h in self._handlers.get(tool_name, [])]

    # ── 前端发现 ──────────────────────────────────────────────

    def list_plugins(self) -> list[dict[str, Any]]:
        """返回所有已注册插件的元数据（供前端展示）。"""
        return [
            {k: v for k, v in info.items() if not k.startswith("_")}
            for info in self._plugin_infos.values()
        ]

    def get_plugin_info(self, tool_name: str) -> dict[str, Any] | None:
        """返回特定工具名的插件元数据。"""
        info = self._plugin_infos.get(tool_name)
        if info:
            return {k: v for k, v in info.items() if not k.startswith("_")}
        return None

    def tool_names(self) -> list[str]:
        """返回至少注册了一个处理器的所有工具名。"""
        return list(self._handlers.keys())


registry = ToolRegistry()
