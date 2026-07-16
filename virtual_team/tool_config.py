"""ToolConfig dataclass + _ToolWrapper for agent tool execution."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from virtual_team.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class ToolConfig:
    """Lightweight tool descriptor for registration with the agent graph."""

    name: str
    description: str = ""
    parameters: dict | None = None
    instructions: str = ""
    mcp_type: str = ""
    mcp_endpoint: str = ""
    mcp_tool_name: str = ""
    endpoint: str = ""
    method: str = "GET"
    headers: str = "{}"


# ── MCP session store ──────────────────────────────────────────
# Reused across tool calls within one graph run.
_mcp_sessions: dict[str, tuple[Any, Any, Any]] = {}


# ── _ToolWrapper ────────────────────────────────────────────────


class _ToolWrapper:
    """Wraps a tool name so it can be invoked by the graph's tools node.

    Dispatches to the correct handler based on tool config fields
    (no hardcoded tool name matching).
    """

    def __init__(
        self,
        name: str,
        description: str = "",
        instructions: str = "",
        mcp_type: str = "",
        mcp_endpoint: str = "",
        mcp_tool_name: str = "",
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
        self.endpoint = endpoint
        self.method = method
        self.headers = headers
        self._llm = None
        self._run_id: str | None = None

    def set_llm(self, llm) -> None:
        self._llm = llm

    def set_run_id(self, run_id: str) -> None:
        self._run_id = run_id

    # ── Dispatch ────────────────────────────────────────────────

    def _resolve_handler(self) -> str | None:
        """Resolve handler by tool config fields (no hardcoded tool names).
        Returns a discriminator string: 'mcp', 'http', or 'skill'.  None = no match.
        """
        if self.mcp_type or self.mcp_endpoint:
            return "mcp"
        if self.endpoint and self.endpoint.startswith(("http://", "https://")):
            return "http"
        if self.instructions:
            return "skill"
        return None

    async def invoke(self, args: dict) -> str:
        # 1) Pluggable external handlers
        from virtual_team.thinking_tree.registry import registry

        for handler in registry.get_handlers(self.name):
            try:
                result = await handler(self.name, args)
                if isinstance(result, dict) and result.get("error") and not result.get("results"):
                    continue
                return json.dumps(result) if not isinstance(result, str) else result
            except Exception:
                continue

        # 2) User-browser opener — publishes open_url event to frontend via WebSocket
        if self.name.startswith("open_user_browser"):
            from virtual_team.tool_handlers import handle_open_browser
            return await handle_open_browser(self, args)

        # 3) Field-based handler
        from virtual_team.tool_handlers import call_http_endpoint, handle_mcp, handle_skill

        kind = self._resolve_handler()
        if kind == "mcp":
            return await handle_mcp(self, args)
        if kind == "http":
            return await call_http_endpoint(self, args)
        if kind == "skill":
            return await handle_skill(self, args)

        # 4) LLM fallback
        from virtual_team.tool_handlers import llm_fallback
        return await llm_fallback(self, args)
