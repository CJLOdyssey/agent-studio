"""Version history API — generic version snapshot management.

No dependency on any business entity type (avoids Stamp Coupling).
Resource type and ID are passed as simple strings.
"""

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_user_id, require_owned
from auth.ownership import auth_enabled
from core.error_codes import ErrorCode, error_response
from repository import get_agent_config, get_prompt, get_team, get_tool
from repository.deps import get_session
from repository.versions import (
    create_version,
    get_version,
    list_versions,
)

router = APIRouter(tags=["versions"])

# 可精确校验归属的资源类型 → 对应单查仓储函数；
# 其余类型（mcp/skill/workflow 等）在 RBAC 下仅要求已登录。
_VERSION_GETTERS: dict[str, Any] = {
    "agent": get_agent_config,
    "team": get_team,
    "prompt": get_prompt,
    "tool": get_tool,
}


async def _check_version_access(request: Request, resource_type: str, resource_id: str) -> None:
    """RBAC 下校验版本快照访问归属；无法精确校验的类型要求已登录。"""
    if not auth_enabled():
        return
    if get_user_id(request) == "anonymous":
        raise error_response(ErrorCode.INVALID_REQUEST, detail="请先登录")
    getter = _VERSION_GETTERS.get(resource_type)
    if getter is not None:
        await require_owned(
            request, resource_id, getter, not_found=ErrorCode.INVALID_REQUEST,
        )


class CreateVersionRequest(BaseModel):
    resource_type: str
    resource_id: str
    snapshot: dict[str, Any]


@router.get("/api/versions/{resource_type}/{resource_id}")
async def api_list_versions(
    resource_type: str,
    resource_id: str,
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """List version history for a resource."""
    await _check_version_access(request, resource_type, resource_id)
    return await list_versions(session, resource_type, resource_id, limit, offset)


@router.get("/api/versions/detail/{version_id}")
async def api_get_version(
    version_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Any:
    """Get a single version by ID."""
    v = await get_version(session, version_id)
    if not v:
        raise error_response(ErrorCode.VERSION_NOT_FOUND, detail="Version not found")
    await _check_version_access(request, v["resource_type"], v["resource_id"])
    return v


@router.post("/api/versions", status_code=201)
async def api_create_version(
    req: CreateVersionRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Any:
    """Create a version snapshot for any resource type."""
    await _check_version_access(request, req.resource_type, req.resource_id)
    user_id = get_user_id(request)
    result = await create_version(
        session,
        req.resource_type,
        req.resource_id,
        req.snapshot,
        user_id,
    )
    # The Depends(get_session) dependency closes the session on exit, which
    # rolls back uncommitted changes — commit here or the snapshot silently
    # never persists (API returns 201 but writes nothing).
    await session.commit()
    return result
