"""Task helper utilities."""
import asyncio
import contextlib
import json
import shlex
from typing import Any

from mcp import StdioServerParameters
from mcp.client.session import ClientSession
from mcp.client.stdio import stdio_client

from virtual_team.broker import publish_run_message
from virtual_team.logging_config import get_logger
from virtual_team.mock_fallback import run_mock
from virtual_team.repository import (
    create_memory_entry,
    update_run_result,
    update_run_status,
)

logger = get_logger(__name__)


def _run_async(coro):
    return asyncio.run(coro)


def _report_run_error(run_id: str, exc: Exception) -> None:
    try:
        _run_async(update_run_status(run_id, "error"))
        _run_async(
            publish_run_message(
                run_id,
                {
                    "type": "status",
                    "status": "error",
                    "error": str(exc),
                },
            )
        )
    except Exception:
        logger.exception("Failed to update error status for run %s", run_id)


def _try_mock_fallback(requirement: str, run_id: str, session_id: str | None, original_exc: Exception) -> dict | None:
    try:
        output = _run_async(run_mock(requirement, run_id, session_id))
        _run_async(
            update_run_result(
                run_id=run_id, pm_document="", code=output.response,
                review="LangGraph fallback", approved=True, status="converged",
            )
        )
        _run_async(
            publish_run_message(
                run_id,
                {"type": "result", "status": "completed", "approved": True,
                 "pm_document": "", "code": output.response, "review": "LangGraph fallback"},
            )
        )
        if session_id:
            with contextlib.suppress(Exception):
                _run_async(_save_output_memories(session_id, run_id, output.response, {}))
        return {"run_id": run_id, "status": "completed", "fallback": True}
    except Exception as mock_exc:
        logger.exception("Mock fallback also failed for run=%s", run_id)
        _report_run_error(run_id, original_exc)
        raise mock_exc


def _parse_json_field(field: Any) -> list:
    if isinstance(field, str):
        try:
            return json.loads(field) if field else []
        except (json.JSONDecodeError, TypeError):
            return []
    return field or []


async def _discover_mcp_tools(endpoint: str) -> list[dict]:
    cmd = shlex.split(endpoint)
    params = StdioServerParameters(command=cmd[0], args=cmd[1:])
    try:
        async with asyncio.timeout(25):
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.list_tools()
                    return [
                        {
                            "name": t.name,
                            "description": t.description or "",
                            "inputSchema": t.inputSchema or {"type": "object"},
                        }
                        for t in (result.tools or [])
                    ]
    except TimeoutError:
        logger.warning("MCP discovery timed out for endpoint: %s", endpoint)
        return []


def _build_session_context(memories) -> str:
    if not memories:
        return ""
    lines = ["\n\n【历史上下文】"]
    for m in memories:
        lines.append(f"- [{m.content_type}] {m.agent_role}: {m.summary}")
    return "\n".join(lines)


async def _get_rag_context(query: str, session_id: str) -> str:
    try:
        from virtual_team.rag import ensure_embedding_provider, retrieve_context
        from virtual_team.repository.keys import get_embedding_api_key

        api_key = await get_embedding_api_key()
        ensure_embedding_provider(api_key)
        return await retrieve_context(query=query, session_id=session_id, top_k=3)
    except Exception:
        return ""


async def _save_output_memories(session_id: str, run_id: str, response: str, metadata: dict):
    summary = response[:200].replace("\n", " ")
    content_type = "code"
    if "<pm_document>" in response or "需求分析" in response:
        content_type = "pm_document"
    elif "<review>" in response or "问题" in response or "bug" in response.lower():
        content_type = "review"
    try:
        await create_memory_entry(
            session_id=session_id,
            run_id=run_id,
            agent_role="agent",
            content_type=content_type,
            summary=summary,
            details=response[:2000],
        )
    except Exception:
        logger.exception("Failed to save memory for run %s", run_id)
