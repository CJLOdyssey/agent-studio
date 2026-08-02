"""Team API routes: CRUD and member management."""

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_user_id
from core.audit import log_audit
from core.error_codes import ErrorCode, error_response
from core.infra.logging_config import get_logger
from repository import (
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
    category: str | None = None


class TeamUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    category: str | None = None
    order: int | None = None
    is_expanded: bool | None = None


class MemberAddRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    role: str = "待配置角色"
    agent_config_id: str | None = None


class ReorderRequest(BaseModel):
    member_ids: list[str]


@router.get("/api/teams/categories")
async def list_categories() -> Any:
    return [
        {"value": "dev", "label": "开发"},
        {"value": "ops", "label": "运维"},
        {"value": "test", "label": "测试"},
    ]


@router.get("/api/teams")
async def list_teams(request: Request) -> Any:
    """List all teams for the current user."""
    try:
        user_id = get_user_id(request)
        teams = await get_teams(user_id=user_id)
        return [
            {
                "id": t["id"],
                "name": t["name"],
                "description": t.get("description"),
                "status": t.get("status", "active"),
                "category": t.get("category", "dev"),
                "order": t["order"],
                "is_expanded": t["is_expanded"],
                "agents": t["agents"],
                "created_at": t["created_at"],
            }
            for t in teams
        ]
    except Exception as e:
        logger.error("Error listing teams: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


async def _snapshot_team(resource_id: str, session: AsyncSession | None = None) -> Any:
    """Create a version snapshot after team save."""
    try:
        from repository.snapshot_helper import create_snapshot_from_dict, with_session

        from repository.teams import get_team

        async def _save(s: Any, rt: str, rid: str, **kw: Any) -> None:
            item = await get_team(rid)
            if not item:
                return
            snapshot = {
                "name": item["name"],
                "description": item["description"],
                "status": item["status"],
                "category": item["category"],
                "order": item.get("order"),
                "is_expanded": item.get("is_expanded"),
                "member_count": len(item.get("agents") or []),
            }
            await create_snapshot_from_dict(
                rt, rid, snapshot, created_by="system", session=s,
            )

        await with_session(
            _save,
            resource_type="team",
            resource_id=resource_id,
            session=session,
        )
    except Exception:
        logger.warning("Version snapshot failed for team %s", resource_id, exc_info=True)

@router.post("/api/teams", status_code=201)
async def add_team(req: TeamCreateRequest, request: Request) -> Any:
    """Create a new team."""
    try:
        user_id = get_user_id(request)
        team = await create_team(
            name=req.name, description=req.description,
            status=req.status, category=req.category,
            owner_id=user_id,
        )
        if team is None:
            raise error_response(ErrorCode.TEAM_CONFLICT, detail="团队名称已存在")
        await _snapshot_team(team.id)
        await log_audit("create", "team", req.name, "创建成功")
        return {
            "id": team.id,
            "name": team.name,
            "description": team.description,
            "status": team.status,
            "category": team.category,
            "order": team.order,
            "is_expanded": team.is_expanded,
            "agents": [],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating team: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.get("/api/teams/{team_id}")
async def get_team_detail(team_id: str) -> Any:
    """Get detailed information for a specific team."""
    team = await get_team(team_id)
    if not team:
        raise error_response(ErrorCode.TEAM_NOT_FOUND, detail="团队不存在")
    return team


@router.put("/api/teams/{team_id}")
async def update_team_endpoint(team_id: str, req: TeamUpdateRequest) -> Any:
    """Update a team's properties."""
    try:
        team = await update_team(
            team_id=team_id,
            name=req.name,
            description=req.description,
            status=req.status,
            category=req.category,
            order=req.order,
            is_expanded=req.is_expanded,
        )
        if not team:
            raise error_response(ErrorCode.TEAM_NOT_FOUND, detail="团队不存在")
        await _snapshot_team(team_id)
        await log_audit("update", "team", team.name, "更新成功")
        return {
            "id": team.id,
            "name": team.name,
            "description": team.description,
            "status": team.status,
            "category": team.category,
            "order": team.order,
            "is_expanded": team.is_expanded,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating team: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.delete("/api/teams/{team_id}")
async def delete_team_endpoint(team_id: str) -> Any:
    """Delete a team by ID."""
    try:
        from repository import get_team
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
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.post("/api/teams/{team_id}/members", status_code=201)
async def add_member(team_id: str, req: MemberAddRequest) -> Any:
    """Add a member to a team."""
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
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.delete("/api/teams/{team_id}/members/{member_id}")
async def remove_member(team_id: str, member_id: str) -> Any:
    """Remove a member from a team."""
    try:
        deleted = await remove_team_member(team_id, member_id)
        if not deleted:
            raise error_response(ErrorCode.TEAM_MEMBER_NOT_FOUND, detail="成员不存在")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error removing member: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.put("/api/teams/{team_id}/members/reorder")
async def reorder_members(team_id: str, req: ReorderRequest) -> Any:
    """Reorder members within a team."""
    try:
        await reorder_team_members(team_id, req.member_ids)
        return {"ok": True}
    except Exception as e:
        logger.error("Error reordering members: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


class LinkAgentRequest(BaseModel):
    agent_config_id: str


@router.put("/api/teams/{team_id}/members/{member_id}/link-agent")
async def link_agent(team_id: str, member_id: str, req: LinkAgentRequest) -> Any:
    """Link an agent configuration to a team member."""
    try:
        ok = await link_agent_config(member_id, req.agent_config_id)
        if not ok:
            raise error_response(ErrorCode.TEAM_MEMBER_NOT_FOUND, detail="成员不存在")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error linking agent: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e
