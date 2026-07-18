"""Team API routes: CRUD and member management."""

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from virtual_team.core.audit import log_audit
from virtual_team.auth import get_user_id
from virtual_team.core.error_codes import ErrorCode, error_response
from virtual_team.core.logging_config import get_logger
from virtual_team.repository import (
    add_team_member,
    create_team,
    delete_team,
    get_team,
    get_teams,
    link_agent_config,
    remove_team_member,
    reorder_team_members,
    update_team,
)

logger = get_logger(__name__)
router = APIRouter(tags=["teams"])


class TeamCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    description: str | None = None
    status: str | None = None


class TeamUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    order: int | None = None
    is_expanded: bool | None = None


class MemberAddRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    role: str = "待配置角色"
    agent_config_id: str | None = None


class ReorderRequest(BaseModel):
    member_ids: list[str]


@router.get("/api/teams")
async def list_teams(request: Request) -> Any:
    try:
        user_id = get_user_id(request)
        teams = await get_teams(user_id=user_id)
        return [
            {
                "id": t["id"],
                "name": t["name"],
                "description": t.get("description"),
                "status": t.get("status", "active"),
                "order": t["order"],
                "is_expanded": t["is_expanded"],
                "agents": t["agents"],
                "created_at": t["created_at"],
            }
            for t in teams
        ]
    except Exception as e:
        logger.error("Error listing teams: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


async def _snapshot_team(resource_id: str, session: AsyncSession | None = None) -> Any:
    """Create a version snapshot after team save."""
    try:
        from virtual_team.repository.snapshot_helper import build_table_snapshot, with_session
        from virtual_team.repository.versions import create_version as _cv

        async def _save(s: Any, rt: str, rid: str, **kw: Any) -> None:
            from virtual_team.repository.teams import get_team
            item = await get_team(rid)
            if not item:
                return
            snapshot = build_table_snapshot(item)
            await _cv(s, rt, rid, snapshot, "system")

        await with_session(
            _save,
            resource_type="team",
            resource_id=resource_id,
            session=session,
        )
    except Exception:
        logger.warning("Version snapshot failed for team %s", resource_id, exc_info=True)

@router.post("/api/teams", status_code=201)
async def add_team(req: TeamCreateRequest) -> Any:
    try:
        team = await create_team(name=req.name, description=req.description, status=req.status)
        if team is None:
            raise error_response(ErrorCode.TEAM_CONFLICT, detail="团队名称已存在")
        await log_audit("create", "team", req.name, "创建成功")
        return {
            "id": team.id,
            "name": team.name,
            "description": team.description,
            "status": team.status,
            "order": team.order,
            "is_expanded": team.is_expanded,
            "agents": [],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating team: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.get("/api/teams/{team_id}")
async def get_team_detail(team_id: str) -> Any:
    team = await get_team(team_id)
    if not team:
        raise error_response(ErrorCode.TEAM_NOT_FOUND, detail="团队不存在")
    return team


@router.put("/api/teams/{team_id}")
async def update_team_endpoint(team_id: str, req: TeamUpdateRequest) -> Any:
    try:
        team = await update_team(
            team_id=team_id,
            name=req.name,
            description=req.description,
            status=req.status,
            order=req.order,
            is_expanded=req.is_expanded,
        )
        if not team:
            raise error_response(ErrorCode.TEAM_NOT_FOUND, detail="团队不存在")
        await log_audit("update", "team", team.name, "更新成功")
        return {
            "id": team.id,
            "name": team.name,
            "description": team.description,
            "status": team.status,
            "order": team.order,
            "is_expanded": team.is_expanded,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating team: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.delete("/api/teams/{team_id}")
async def delete_team_endpoint(team_id: str) -> Any:
    try:
        from virtual_team.repository import get_team
        team = await get_team(team_id)
        team_name = team["name"] if team else team_id
        deleted = await delete_team(team_id)
        if not deleted:
            raise error_response(ErrorCode.TEAM_NOT_FOUND, detail="团队不存在")
        await log_audit("delete", "team", team_name, "删除成功")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting team: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.post("/api/teams/{team_id}/members", status_code=201)
async def add_member(team_id: str, req: MemberAddRequest) -> Any:
    try:
        member = await add_team_member(
            team_id=team_id,
            name=req.name,
            role=req.role,
            agent_config_id=req.agent_config_id,
        )
        if not member:
            raise error_response(ErrorCode.TEAM_NOT_FOUND, detail="团队不存在")
        return member
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error adding member: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.delete("/api/teams/{team_id}/members/{member_id}")
async def remove_member(team_id: str, member_id: str) -> Any:
    try:
        deleted = await remove_team_member(team_id, member_id)
        if not deleted:
            raise error_response(ErrorCode.TEAM_MEMBER_NOT_FOUND, detail="成员不存在")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error removing member: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.put("/api/teams/{team_id}/members/reorder")
async def reorder_members(team_id: str, req: ReorderRequest) -> Any:
    try:
        await reorder_team_members(team_id, req.member_ids)
        return {"ok": True}
    except Exception as e:
        logger.error("Error reordering members: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


class LinkAgentRequest(BaseModel):
    agent_config_id: str


@router.put("/api/teams/{team_id}/members/{member_id}/link-agent")
async def link_agent(team_id: str, member_id: str, req: LinkAgentRequest) -> Any:
    try:
        ok = await link_agent_config(member_id, req.agent_config_id)
        if not ok:
            raise error_response(ErrorCode.TEAM_MEMBER_NOT_FOUND, detail="成员不存在")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error linking agent: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e
