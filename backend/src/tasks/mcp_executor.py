"""MCP stdio 执行器——为内聚性从 agent_pipeline.py 中抽出。"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from core.infra.logging_config import get_logger

if TYPE_CHECKING:
    from graph.agent_graph import ToolConfig

logger = get_logger(__name__)


async def exec_stdio_mcp(tc: ToolConfig, args: str) -> str:
    """通过 MCP SDK 执行基于 stdio 的 MCP 工具。"""
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
                        text = getattr(result.content[0], "text", "unknown") if result.content else "unknown"
                        return f"[MCP Error] {text}"
                    return getattr(result.content[0], "text", "") if result.content else ""
    except TimeoutError:
        return f"[MCP Timeout] {tc.name}"
