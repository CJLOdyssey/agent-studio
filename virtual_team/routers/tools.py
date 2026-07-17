"""Tool CRUD routes and tool generation API endpoints."""

import json
import time
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from virtual_team.audit import log_audit
from virtual_team.error_codes import ErrorCode, error_response
from virtual_team.logging_config import get_logger
from virtual_team.repository import (
    create_tool as repo_create_tool,
)
from virtual_team.repository import (
    delete_tool,
    get_tool,
    update_tool,
)
from virtual_team.repository import (
    get_tools_as_dicts as repo_get_tools_as_dicts,
)
from virtual_team.services.tool_generator import (
    ToolValidateRequest,
    ToolValidateResponse,
    _execute_tool_sandbox,
    _validate_tool_code,
)

logger = get_logger(__name__)
router = APIRouter(tags=["tools"])


class ToolTestResult(BaseModel):
    success: bool
    status_code: int | None = None
    duration_ms: int
    message: str
    body: str | None = None


class ToolCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    category: str = Field(..., min_length=1, max_length=32)
    description: str = ""
    model: str | None = None
    status: str = "active"
    version: str = "v1.0.0"
    endpoint: str = ""
    method: str = "GET"
    headers: str = "{}"
    parameters: str = '{"type":"object","properties":{}}'


class ToolUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    model: str | None = None
    status: str | None = None
    version: str | None = None
    endpoint: str | None = None
    method: str | None = None
    headers: str | None = None
    parameters: str | None = None


@router.post("/api/tools/validate", response_model=ToolValidateResponse)
async def validate_tool(req: ToolValidateRequest) -> Any:
    try:
        result = _validate_tool_code(req.code, req.language)
        return result
    except Exception as e:
        logger.error("Tool validation failed: %s", e, exc_info=True)
        raise error_response(ErrorCode.TOOL_GENERATE_FAILED, detail=f"验证失败: {e}") from e


@router.post("/api/tools/execute")
async def execute_tool(code: str, language: str = "python") -> Any:
    try:
        result = _execute_tool_sandbox(code, language)
        return {"success": True, "output": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/api/tools/plugins")
async def list_tool_plugins() -> Any:
    import virtual_team.thinking_tree.tools  # noqa: F401
    from virtual_team.thinking_tree.registry import registry

    return registry.list_plugins()


@router.get("/api/tools")
async def list_tools() -> Any:
    try:
        return await repo_get_tools_as_dicts()
    except Exception as e:
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


async def _snapshot_tool(resource_id: str, session=None) -> Any:  # type: ignore[no-untyped-def]
    """Create a version snapshot after tool save."""
    try:
        from virtual_team.repository.snapshot_helper import build_table_snapshot, with_session
        from virtual_team.repository.versions import create_version as _cv

        async def _save(s: Any, rt: str, rid: str, **kw: Any) -> None:
            from virtual_team.repository.tools import get_tool as repo_get_tool
            item = await repo_get_tool(rid)
            if not item:
                return
            snapshot = build_table_snapshot(item)
            await _cv(s, rt, rid, snapshot, "system")

        await with_session(
            _save,
            resource_type="tool",
            resource_id=resource_id,
            session=session,
        )
    except Exception:
        logger.warning("Version snapshot failed for tool %s", resource_id, exc_info=True)


@router.post("/api/tools/{tool_id}/test")
async def test_tool_endpoint(tool_id: str) -> Any:
    timeout = 10
    try:
        t = await get_tool(tool_id)
        if not t:
            raise error_response(ErrorCode.TOOL_NOT_FOUND, detail="Tool not found")

        endpoint = t.endpoint or ""
        if not endpoint:
            return ToolTestResult(success=False, status_code=None, duration_ms=0, message="No endpoint configured")

        method = (t.method or "GET").upper()
        headers = json.loads(t.headers or "{}")

        start = time.monotonic()
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.request(method, endpoint, headers=headers)
        elapsed = int((time.monotonic() - start) * 1000)

        body = resp.text[:500] if resp.text else None
        return ToolTestResult(
            success=resp.status_code < 500,
            status_code=resp.status_code,
            duration_ms=elapsed,
            message=f"{method} {endpoint} -> {resp.status_code}",
            body=body,
        )
    except httpx.TimeoutException:
        return ToolTestResult(success=False, status_code=None, duration_ms=timeout * 1000, message="Request timed out")
    except httpx.RequestError as e:
        return ToolTestResult(success=False, status_code=None, duration_ms=0, message=f"Connection failed: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.post("/api/tools", status_code=201)
async def add_tool(req: ToolCreate) -> Any:
    try:
        t = await repo_create_tool(req.model_dump())
        await log_audit("create", "tool", t.name, "创建成功")
        return {
            "id": t.id,
            "name": t.name,
            "category": t.category,
            "status": t.status,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
    except Exception as e:
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.put("/api/tools/{tool_id}")
async def edit_tool(tool_id: str, req: ToolUpdate) -> Any:
    try:
        t = await update_tool(tool_id, req.model_dump(exclude_unset=True))
        if not t:
            raise error_response(ErrorCode.TOOL_NOT_FOUND, detail="Tool not found")
        await _snapshot_tool(t.id)
        await _snapshot_tool(tool_id)
        await log_audit("update", "tool", t.name, "更新成功")
        return {"id": t.id, "name": t.name, "category": t.category, "status": t.status}
    except HTTPException:
        raise
    except Exception as e:
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.delete("/api/tools/{tool_id}", status_code=204)
async def remove_tool(tool_id: str) -> None:
    try:
        t = await get_tool(tool_id)
        tool_name = t.name if t else tool_id
        ok = await delete_tool(tool_id)
        if not ok:
            raise error_response(ErrorCode.TOOL_NOT_FOUND, detail="Tool not found")
        await log_audit("delete", "tool", tool_name, "删除成功")
    except HTTPException:
        raise
    except Exception as e:
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e
