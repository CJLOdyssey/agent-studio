"""MCP stdio executor — extracted from agent_pipeline.py for cohesion."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any, cast

from virtual_team.logging_config import get_logger

if TYPE_CHECKING:
    from virtual_team.agent_graph import ToolConfig

logger = get_logger(__name__)


async def exec_stdio_mcp(tc: ToolConfig, args: str) -> str:
    """Execute a stdio-based MCP tool via the MCP SDK."""
    from mcp import StdioServerParameters
    from mcp.client.session import ClientSession
    from mcp.client.stdio import stdio_client

    params = StdioServerParameters(command=tc.endpoint)
    try:
        async with asyncio.timeout(60):
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.call_tool(tc.name, {"args": args})
                    if result.isError:
                        return f"[MCP Error] {cast(Any, result.content[0]).text if result.content else 'unknown'}"
                    return cast(Any, result.content[0]).text if result.content else ""
    except TimeoutError:
        return f"[MCP Timeout] {tc.name}"
