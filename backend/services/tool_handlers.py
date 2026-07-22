"""Handler implementations for _ToolWrapper — dispatched from tool_config.py."""

from __future__ import annotations

import asyncio
import json
import shlex
import subprocess
import time
import urllib.request
from typing import TYPE_CHECKING, Any

import httpx
from langchain_core.messages import HumanMessage

from backend.core.infra.logging_config import get_logger

if TYPE_CHECKING:
    from backend.services.tool_config import _ToolWrapper

logger = get_logger(__name__)


def handle_skill(tool_self: _ToolWrapper, args: dict[str, Any]) -> str:
    """Return the skill's instruction text as the tool result."""
    return tool_self.instructions if tool_self.instructions else json.dumps({
        "role": "skill",
        "name": tool_self.name,
        "content": "This skill provides specialized guidance. Follow these instructions.",
    })


async def handle_mcp(tool_self: _ToolWrapper, args: dict[str, Any]) -> str:
    """Dispatch an MCP tool call."""
    return await execute_mcp(tool_self, args)


async def call_http_endpoint(tool_self: _ToolWrapper, args: dict[str, Any]) -> str:
    """Call an HTTP endpoint with the tool's configured method and headers."""
    try:
        hdrs = json.loads(tool_self.headers) if isinstance(tool_self.headers, str) else {}
        hdrs.setdefault("Content-Type", "application/json")
        async with httpx.AsyncClient(timeout=30.0) as client:
            if tool_self.method.upper() == "GET":
                resp = await client.get(tool_self.endpoint, params=args, headers=hdrs)
            else:
                resp = await client.post(tool_self.endpoint, json=args, headers=hdrs)
            resp.raise_for_status()
            return resp.text
    except httpx.HTTPStatusError as e:
        return json.dumps({"tool": tool_self.name, "error": f"HTTP {e.response.status_code}: {e.response.text[:500]}"})
    except Exception as e:
        return json.dumps({"tool": tool_self.name, "error": str(e)})


async def execute_mcp(tool_self: _ToolWrapper, args: dict[str, Any]) -> str:
    """MCP execution: sse → httpx, stdio → mcp SDK, fallback → execute_tool."""
    if tool_self.mcp_type == "sse" and tool_self.mcp_endpoint:
        try:
            params = {"name": tool_self.mcp_tool_name or tool_self.name, "arguments": args}
            body = json.dumps({"jsonrpc": "2.0", "method": "tools/call", "params": params, "id": 1})
            async with httpx.AsyncClient(timeout=30) as client:
                hdrs = {"Content-Type": "application/json"}
                resp = await client.post(tool_self.mcp_endpoint, content=body, headers=hdrs)
                return resp.text[:5000]
        except Exception as e:
            return json.dumps({"error": str(e)})

    if tool_self.mcp_type == "stdio" and tool_self.mcp_endpoint:
        return await call_mcp_sdk(tool_self, args)

    result = execute_tool(tool_self, args)
    logger.debug("MCP fallback to tool execution | tool=%s", tool_self.name)
    return result


def execute_tool(tool_self: _ToolWrapper, args: dict[str, Any]) -> str:
    """Execute a tool: HTTP POST or local command."""
    if tool_self.mcp_endpoint:
        if tool_self.mcp_endpoint.startswith("http://") or tool_self.mcp_endpoint.startswith("https://"):
            try:
                body = json.dumps(args).encode()
                req = urllib.request.Request(
                    tool_self.mcp_endpoint, data=body, headers={"Content-Type": "application/json"}, method="POST"
                )
                with urllib.request.urlopen(req, timeout=30) as resp:  # nosec B310
                    data: bytes = resp.read()
                    return data.decode("utf-8", errors="ignore")[:5000]
            except Exception as e:
                return json.dumps({"error": str(e)})
        else:
            try:
                cmd = [tool_self.mcp_endpoint] + [str(v) for v in args.values()]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                stdout = result.stdout[:3000]
                stderr = result.stderr[:500]
                return json.dumps({"stdout": stdout, "stderr": stderr, "rc": result.returncode})
            except subprocess.TimeoutExpired:
                return json.dumps({"error": "timeout (30s)"})
            except Exception as e:
                return json.dumps({"error": str(e)})
    return json.dumps({"status": "called", "args": args})


async def call_mcp_sdk(tool_self: _ToolWrapper, args: dict[str, Any]) -> str:
    """Call MCP stdio tool, caching sessions."""
    from mcp import StdioServerParameters
    from mcp.client.session import ClientSession
    from mcp.client.stdio import stdio_client

    async def _call(session: Any, name: str, arguments: dict[str, Any] | None, timeout: int = 45) -> Any:
        if name:
            return await asyncio.wait_for(session.call_tool(name, arguments=arguments or {}), timeout=timeout)
        return await asyncio.wait_for(session.list_tools(), timeout=20)

    # Create a fresh session for each call — avoids cross-task connection issues
    cmd = shlex.split(tool_self.mcp_endpoint)
    params = StdioServerParameters(command=cmd[0], args=cmd[1:])
    try:
        async with stdio_client(params) as (read, write), ClientSession(read, write) as session:
            await session.initialize()
            result = await _call(session, tool_self.mcp_tool_name, args)
    except Exception as e:
        return json.dumps({"error": str(e)})

    if tool_self.mcp_tool_name:
        content_list = getattr(result, "content", [])
        texts = [getattr(c, "text", "") for c in content_list if getattr(c, "text", "")]
        texts = [t for t in texts if t]
        return "\n".join(texts) if texts else json.dumps({"result": str(content_list)})

    tools = getattr(result, "tools", [])
    if tools:
        lines = []
        for t in tools:
            props: dict[str, Any] = {}
            if hasattr(t, "inputSchema") and t.inputSchema:
                props = t.inputSchema.get("properties", {}) or {}
            desc = "; ".join(f"{k}: {v.get('description','')}" for k, v in props.items()) if props else ""
            lines.append(f"- {t.name}: {t.description or ''} [{desc}]")
        return ("MCP server provides:\n" + "\n".join(lines) +
                "\n\nTo call one, pass {\"_tool\": \"TOOL_NAME\", \"_args\": {...}}")
    return json.dumps({"error": "no tools found"})


async def handle_open_browser(tool_self: _ToolWrapper, args: dict[str, Any]) -> str:
    """Publish an open_url event so the frontend opens the URL in the user's browser."""
    url = args.get("url", "") or args.get("URL", "")
    if not url:
        return json.dumps({"error": "Missing 'url' argument"})
    if tool_self._run_id:
        from backend.broker import publish_run_message
        try:
            await publish_run_message(tool_self._run_id, {
                "type": "open_url",
                "url": url,
                "agent_name": "Agent",
            })
            logger.info("open_url published: %s (run=%s)", url, tool_self._run_id[:12])
        except Exception as e:
            logger.warning("open_url publish failed: %s", e)
    return json.dumps({"status": "ok", "message": f"已在用户浏览器打开: {url}"})


async def llm_fallback(tool_self: _ToolWrapper, args: dict[str, Any]) -> str:
    """Use an LLM as a fallback executor when no other handler matches."""
    if tool_self._llm:
        try:
            prompt = (
                f"You are the '{tool_self.name}' tool. "
                f"Your description: {tool_self.description or 'No description'}.\n"
                "Execute this tool call and return ONLY the result "
                "as plain text or JSON (no markdown, no explanation):\n"
                f"Arguments: {json.dumps(args, ensure_ascii=False)}\n"
                "Output:"
            )
            t0 = time.time()
            resp = await tool_self._llm.ainvoke([HumanMessage(content=prompt)])
            elapsed = time.time() - t0
            logger.info(
                "LLM tool-fallback | tool=%s | model=%s | elapsed=%.2fs | out=%d chars",
                tool_self.name, getattr(tool_self._llm, 'model', '?'), elapsed, len(resp.content or ""),
            )
            return resp.content
        except Exception as e:
            return json.dumps({"tool": tool_self.name, "status": "error", "error": str(e)})
    note = "no LLM available, falling back"
    return json.dumps({"tool": tool_self.name, "status": "executed", "note": note, "args": args})
