"""ToolConfig dataclass + _ToolWrapper for agent tool execution."""

from __future__ import annotations

import asyncio
import json
import shlex
import subprocess
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import httpx
from langchain_core.messages import HumanMessage

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

    def _resolve_handler(self) -> tuple[bool, Any]:
        """Resolve handler by tool config fields (no hardcoded tool names)."""
        if self.mcp_type or self.mcp_endpoint:
            return True, self._handle_mcp
        if self.endpoint and self.endpoint.startswith(("http://", "https://")):
            return True, self._call_http_endpoint
        if self.instructions:
            return True, self._handle_skill
        return False, None

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
            return await self._handle_open_browser(args)

        # 3) Field-based handler
        matched, handler_fn = self._resolve_handler()
        if matched and handler_fn:
            return await handler_fn(args)

        # 4) LLM fallback
        return await self._llm_fallback(args)

    # ── Handlers ────────────────────────────────────────────────

    async def _handle_skill(self, args: dict) -> str:
        return self.instructions if self.instructions else json.dumps({
            "role": "skill",
            "name": self.name,
            "content": "This skill provides specialized guidance. Follow these instructions.",
        })

    async def _handle_mcp(self, args: dict) -> str:
        return await self._execute_mcp(args)

    async def _call_http_endpoint(self, args: dict) -> str:
        try:
            hdrs = json.loads(self.headers) if isinstance(self.headers, str) else {}
            hdrs.setdefault("Content-Type", "application/json")
            async with httpx.AsyncClient(timeout=30.0) as client:
                if self.method.upper() == "GET":
                    resp = await client.get(self.endpoint, params=args, headers=hdrs)
                else:
                    resp = await client.post(self.endpoint, json=args, headers=hdrs)
                resp.raise_for_status()
                return resp.text
        except httpx.HTTPStatusError as e:
            return json.dumps({"tool": self.name, "error": f"HTTP {e.response.status_code}: {e.response.text[:500]}"})
        except Exception as e:
            return json.dumps({"tool": self.name, "error": str(e)})

    async def _execute_mcp(self, args: dict) -> str:
        """MCP execution: sse → httpx, stdio → mcp SDK, fallback → _execute_tool."""
        if self.mcp_type == "sse" and self.mcp_endpoint:
            try:
                params = {"name": self.mcp_tool_name or self.name, "arguments": args}
                body = json.dumps({"jsonrpc": "2.0", "method": "tools/call", "params": params, "id": 1})
                async with httpx.AsyncClient(timeout=30) as client:
                    hdrs = {"Content-Type": "application/json"}
                    resp = await client.post(self.mcp_endpoint, content=body, headers=hdrs)
                    return resp.text[:5000]
            except Exception as e:
                return json.dumps({"error": str(e)})

        if self.mcp_type == "stdio" and self.mcp_endpoint:
            return await self._call_mcp_sdk(args)

        result = self._execute_tool(args)
        logger.debug("MCP fallback to tool execution | tool=%s", self.name)
        return result

    def _execute_tool(self, args: dict) -> str:
        """Execute a tool: HTTP POST or local command."""
        if self.mcp_endpoint:
            if self.mcp_endpoint.startswith("http://") or self.mcp_endpoint.startswith("https://"):
                try:
                    body = json.dumps(args).encode()
                    req = urllib.request.Request(
                        self.mcp_endpoint, data=body, headers={"Content-Type": "application/json"}, method="POST"
                    )
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        return resp.read().decode("utf-8", errors="ignore")[:5000]
                except Exception as e:
                    return json.dumps({"error": str(e)})
            else:
                try:
                    cmd = [self.mcp_endpoint] + [str(v) for v in args.values()]
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                    return json.dumps({"stdout": result.stdout[:3000], "stderr": result.stderr[:500], "rc": result.returncode})
                except subprocess.TimeoutExpired:
                    return json.dumps({"error": "timeout (30s)"})
                except Exception as e:
                    return json.dumps({"error": str(e)})
        return json.dumps({"status": "called", "args": args})

    async def _call_mcp_sdk(self, args: dict) -> str:
        """Call MCP stdio tool, caching sessions."""
        from mcp import StdioServerParameters
        from mcp.client.stdio import stdio_client
        from mcp.client.session import ClientSession

        async def _call(session, name: str, arguments: dict | None, timeout: int = 45) -> Any:
            if name:
                return await asyncio.wait_for(session.call_tool(name, arguments=arguments or {}), timeout=timeout)
            return await asyncio.wait_for(session.list_tools(), timeout=20)

        # Create a fresh session for each call — avoids cross-task connection issues
        cmd = shlex.split(self.mcp_endpoint)
        params = StdioServerParameters(command=cmd[0], args=cmd[1:])
        try:
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await _call(session, self.mcp_tool_name, args)
        except Exception as e:
            return json.dumps({"error": str(e)})

        if self.mcp_tool_name:
            content_list = getattr(result, "content", [])
            texts = [getattr(c, "text", "") for c in content_list if getattr(c, "text", "")]
            texts = [t for t in texts if t]
            return "\n".join(texts) if texts else json.dumps({"result": str(content_list)})

        tools = getattr(result, "tools", [])
        if tools:
            lines = []
            for t in tools:
                props = {}
                if hasattr(t, "inputSchema") and t.inputSchema:
                    props = t.inputSchema.get("properties", {}) or {}
                desc = "; ".join(f"{k}: {v.get('description','')}" for k, v in props.items()) if props else ""
                lines.append(f"- {t.name}: {t.description or ''} [{desc}]")
            return ("MCP server provides:\n" + "\n".join(lines) +
                    "\n\nTo call one, pass {\"_tool\": \"TOOL_NAME\", \"_args\": {...}}")
        return json.dumps({"error": "no tools found"})

    async def _handle_open_browser(self, args: dict) -> str:
        """Publish an open_url event so the frontend opens the URL in the user's browser."""
        url = args.get("url", "") or args.get("URL", "")
        if not url:
            return json.dumps({"error": "Missing 'url' argument"})
        if self._run_id:
            from virtual_team.broker import publish_run_message
            try:
                await publish_run_message(self._run_id, {
                    "type": "open_url",
                    "url": url,
                    "agent_name": "Agent",
                })
                logger.info("open_url published: %s (run=%s)", url, self._run_id[:12])
            except Exception as e:
                logger.warning("open_url publish failed: %s", e)
        return json.dumps({"status": "ok", "message": f"已在用户浏览器打开: {url}"})

    async def _llm_fallback(self, args: dict) -> str:
        if self._llm:
            try:
                prompt = (
                    f"You are the '{self.name}' tool. "
                    f"Your description: {self.description or 'No description'}.\n"
                    "Execute this tool call and return ONLY the result "
                    "as plain text or JSON (no markdown, no explanation):\n"
                    f"Arguments: {json.dumps(args, ensure_ascii=False)}\n"
                    "Output:"
                )
                resp = await self._llm.ainvoke([HumanMessage(content=prompt)])
                return resp.content
            except Exception as e:
                return json.dumps({"tool": self.name, "status": "error", "error": str(e)})
        return json.dumps({"tool": self.name, "status": "executed", "note": "no LLM available, falling back", "args": args})