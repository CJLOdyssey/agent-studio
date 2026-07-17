"""MCP server CRUD API routes."""

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from virtual_team.audit import log_audit
from virtual_team.error_codes import ErrorCode, error_response
from virtual_team.logging_config import get_logger
from virtual_team.repository import create_mcp, delete_mcp, get_mcps, get_mcps_as_dicts, update_mcp

logger = get_logger(__name__)
router = APIRouter(tags=["mcps"])


class MCPCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    type: str = Field(default="stdio")
    endpoint: str = Field(default="")
    config: str | None = None


class MCPUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    endpoint: str | None = None
    config: str | None = None
    status: str | None = None


@router.get("/api/mcps")
async def list_mcps() -> Any:
    try:
        return await get_mcps_as_dicts()
    except Exception as e:
        logger.error("Error listing MCPs: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


async def _snapshot_mcp(resource_id: str, session=None) -> Any:  # type: ignore[no-untyped-def]
    """Create a version snapshot after mcp save."""
    try:
        from virtual_team.repository import get_mcps as _gmcps
        from virtual_team.repository.snapshot_helper import with_session
        from virtual_team.repository.versions import create_version as _cv

        async def _save(s: Any, rt: str, rid: str, **kw: Any) -> None:
            all_items = await _gmcps()
            item = next((m for m in all_items if m.id == rid), None)
            if not item:
                return
            config_raw = item.config or "{}"
            try:
                cfg = json.loads(config_raw) if isinstance(config_raw, str) else (config_raw or {})
            except (json.JSONDecodeError, TypeError):
                cfg = {}
            snapshot = {
                "name": item.name,
                "type": item.type,
                "endpoint": item.endpoint,
                "status": item.status,
                "description": cfg.get("description"),
                "version": cfg.get("version"),
            }
            await _cv(s, rt, rid, snapshot, "system")

        await with_session(
            _save,
            resource_type="mcp",
            resource_id=resource_id,
            session=session,
        )
    except Exception:
        logger.warning("Version snapshot failed for mcp %s", resource_id, exc_info=True)

@router.post("/api/mcps", status_code=201)
async def add_mcp(req: MCPCreate) -> Any:
    try:
        m = await create_mcp(req.model_dump())
        await log_audit("create", "mcp", m.name, "创建成功")
        return {
            "id": m.id,
            "name": m.name,
            "type": m.type,
            "endpoint": m.endpoint,
            "config": m.config,
            "status": m.status,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
    except Exception as e:
        logger.error("Error creating MCP: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.put("/api/mcps/{mcp_id}")
async def edit_mcp(mcp_id: str, req: MCPUpdate) -> Any:
    try:
        m = await update_mcp(mcp_id, req.model_dump(exclude_unset=True))
        if not m:
            raise error_response(ErrorCode.MCP_NOT_FOUND, detail="MCP not found")
        await _snapshot_mcp(m.id)
        await log_audit("update", "mcp", m.name, "更新成功")
        return {
            "id": m.id,
            "name": m.name,
            "type": m.type,
            "endpoint": m.endpoint,
            "config": m.config,
            "status": m.status,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating MCP: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.delete("/api/mcps/{mcp_id}", status_code=204)
async def remove_mcp(mcp_id: str) -> None:
    try:
        mcps = await get_mcps()
        target = next((m for m in mcps if m.id == mcp_id), None)
        mcp_name = target.name if target else mcp_id
        ok = await delete_mcp(mcp_id)
        if not ok:
            raise error_response(ErrorCode.MCP_NOT_FOUND, detail="MCP not found")
        await log_audit("delete", "mcp", mcp_name, "删除成功")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting MCP: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


class MCPTestResult(BaseModel):
    success: bool
    message: str
    duration_ms: int = 0


@router.post("/api/mcps/{mcp_id}/test")
async def test_mcp(mcp_id: str) -> Any:
    """Test an MCP server connection."""
    import time

    from virtual_team.repository import get_mcps as _get_mcps

    all_mcps = await _get_mcps()
    mcp = next((m for m in all_mcps if m.id == mcp_id), None)
    if not mcp:
        raise error_response(ErrorCode.MCP_NOT_FOUND, detail="MCP not found")

    start = time.monotonic()
    try:
        mcp_type = mcp.type or "stdio"
        endpoint = mcp.endpoint or ""

        if mcp_type == "sse" and endpoint:
            import httpx
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
                resp = await client.get(endpoint)
                dur = int((time.monotonic() - start) * 1000)
                return MCPTestResult(
                    success=resp.status_code < 500,
                    message=f"URL reachable (HTTP {resp.status_code})",
                    duration_ms=dur,
                )

        if mcp_type == "stdio" and endpoint:
            import asyncio
            proc = await asyncio.create_subprocess_shell(
                endpoint,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            try:
                await asyncio.wait_for(proc.wait(), timeout=5.0)
                dur = int((time.monotonic() - start) * 1000)
                return MCPTestResult(
                    success=proc.returncode == 0,
                    message=f"Command exited with code {proc.returncode}",
                    duration_ms=dur,
                )
            except TimeoutError:
                proc.kill()
                dur = int((time.monotonic() - start) * 1000)
                return MCPTestResult(
                    success=True, message="Command started (process running)", duration_ms=dur,
                )

        return MCPTestResult(success=False, message="No endpoint configured", duration_ms=0)
    except Exception as e:
        dur = int((time.monotonic() - start) * 1000)
        return MCPTestResult(success=False, message=str(e), duration_ms=dur)
