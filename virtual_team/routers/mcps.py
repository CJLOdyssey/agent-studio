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
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/mcps", status_code=201)
async def add_mcp(req: MCPCreate):
    try:
        m = await create_mcp(req.model_dump())
        return {"id": m.id, "name": m.name, "type": m.type, "endpoint": m.endpoint, "status": m.status, "created_at": m.created_at.isoformat() if m.created_at else None}
    except Exception as e:
        logger.error("Error creating MCP: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/mcps/{mcp_id}")
async def edit_mcp(mcp_id: str, req: MCPUpdate):
    try:
        m = await update_mcp(mcp_id, req.model_dump(exclude_unset=True))
        if not m:
            raise HTTPException(status_code=404, detail="MCP not found")
        return {"id": m.id, "name": m.name, "type": m.type, "status": m.status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating MCP: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))
