"""ToolConfig dataclass + _ToolWrapper for agent tool execution."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from backend.core._interfaces import ToolDescriptor

from backend.core.infra.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class ToolConfig:
    """Lightweight tool descriptor for registration with the agent graph."""

    name: str
    description: str = ""
    parameters: dict[str, Any] | None = None
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

    def set_llm(self, llm: Any) -> None:
        """Set the LLM instance for tool fallback execution."""
        self._llm = llm

    def set_run_id(self, run_id: str) -> None:
        """Set the current run ID for event publishing."""
        self._run_id = run_id

    # ── Dispatch ────────────────────────────────────────────────

    def _resolve_handler(self) -> str | None:
        """Resolve handler discriminator from tool config fields.

        Returns 'mcp', 'http', 'skill', or None if no match.
        """
        if self.mcp_type or self.mcp_endpoint:
            return "mcp"
        if self.endpoint and self.endpoint.startswith(("http://", "https://")):
            return "http"
        if self.instructions:
            return "skill"
        return None

    async def invoke(self, args: dict[str, Any]) -> str:
        """Dispatch a tool call to the appropriate handler."""
        # 1) Pluggable external handlers
        from backend.thinking_tree.registry import registry

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
            from backend.services.tool_handlers import handle_open_browser
            return await handle_open_browser(self, args)

        # 3) Field-based handler
        from backend.services.tool_handlers import call_http_endpoint, handle_mcp, handle_skill

        kind = self._resolve_handler()
        if kind == "mcp":
            return await handle_mcp(self, args)
        if kind == "http":
            return await call_http_endpoint(self, args)
        if kind == "skill":
            return handle_skill(self, args)

        # 4) LLM fallback
        from backend.services.tool_handlers import llm_fallback
        return await llm_fallback(self, args)


# ── Utilities ──────────────────────────────────────────────────


def sanitize_tool_name(name: str) -> str:
    """DeepSeek requires tool names matching ``^[a-zA-Z0-9_-]+$``."""
    sanitized = "".join(c for c in name if c.isascii() and (c.isalnum() or c in "_-"))
    return sanitized or f"tool_{hash(name) & 0xFFFFFFFF}"


def build_tool_definition(
    tc: ToolConfig | ToolDescriptor,
    llm: Any = None,
) -> tuple[str, _ToolWrapper, dict[str, Any]]:
    """Create a ``_ToolWrapper`` and an OpenAI tool-call definition from a ``ToolConfig``.

    Returns ``(api_name, wrapper, definition_dict)``.
    """
    api_name = sanitize_tool_name(tc.name)
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
    if llm is not None:
        wrapper.set_llm(llm)

    schema: dict[str, Any] = {"type": "object"}
    if tc.parameters:
        if isinstance(tc.parameters, dict):
            props = tc.parameters.get("properties", {}) or {}
            schema = tc.parameters if props else {"type": tc.parameters.get("type", "object")}
        else:
            schema = tc.parameters

    definition = {
        "type": "function",
        "function": {"name": api_name, "description": tc.description, "parameters": schema},
    }
    return api_name, wrapper, definition
