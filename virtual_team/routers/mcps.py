"""MCP server CRUD API routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from virtual_team.logging_config import get_logger
from virtual_team.repository import create_mcp, delete_mcp, get_mcps, update_mcp

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
async def list_mcps():
    try:
        return await get_mcps()
    except Exception as e:
        logger.error("Error listing MCPs: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


async def _snapshot_mcp(resource_id: str, session=None):
    """Create a version snapshot after mcp save."""
    try:
        if session is None:
            from virtual_team.database import get_session_factory
            factory = get_session_factory()
            async with factory() as s:
                await _do_snapshot_mcp(resource_id, s)
                await s.commit()
        else:
            await _do_snapshot_mcp(resource_id, session)
    except Exception:
        logger.warning("Version snapshot failed for mcp %s", resource_id, exc_info=True)


async def _do_snapshot_mcp(resource_id: str, session):
    from virtual_team.repository.versions import create_version as _cv
    from virtual_team.repository import get_mcps as _gmcps
    all_items = await _gmcps()
    item = next((m for m in all_items if m["id"] == resource_id), None)
    if not item:
        return
    snapshot = {k: v for k, v in item.items() if k in ("name", "description", "type", "command", "url", "status", "version")}
    await _cv(session, "mcp", resource_id, snapshot, "system")

@router.post("/api/mcps", status_code=201)
async def add_mcp(req: MCPCreate):
    try:
        m = await create_mcp(req.model_dump())
        return {
            "id": m.id,
            "name": m.name,
            "type": m.type,
            "endpoint": m.endpoint,
            "status": m.status,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
    except Exception as e:
        logger.error("Error creating MCP: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/api/mcps/{mcp_id}")
async def edit_mcp(mcp_id: str, req: MCPUpdate):
    try:
        m = await update_mcp(mcp_id, req.model_dump(exclude_unset=True))
        if not m:
            raise HTTPException(status_code=404, detail="MCP not found")
        await _snapshot_mcp(m.id)
        return {"id": m.id, "name": m.name, "type": m.type, "status": m.status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating MCP: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/api/mcps/{mcp_id}", status_code=204)
async def remove_mcp(mcp_id: str):
    try:
        ok = await delete_mcp(mcp_id)
        if not ok:
            raise HTTPException(status_code=404, detail="MCP not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting MCP: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


class MCPTestResult(BaseModel):
    success: bool
    message: str
    duration_ms: int = 0


@router.post("/api/mcps/{mcp_id}/test")
async def test_mcp(mcp_id: str):
    """Test an MCP server connection."""
    import time
    from virtual_team.repository import get_mcps as _get_mcps

    all_mcps = await _get_mcps()
    mcp = next((m for m in all_mcps if m["id"] == mcp_id), None)
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found")

    start = time.monotonic()
    try:
        mcp_type = mcp.get("type", "stdio")
        endpoint = mcp.get("endpoint", "")

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
            except asyncio.TimeoutError:
                proc.kill()
                dur = int((time.monotonic() - start) * 1000)
                return MCPTestResult(
                    success=True, message="Command started (process running)", duration_ms=dur,
                )

        return MCPTestResult(success=False, message="No endpoint configured", duration_ms=0)
    except Exception as e:
        dur = int((time.monotonic() - start) * 1000)
        return MCPTestResult(success=False, message=str(e), duration_ms=dur)
