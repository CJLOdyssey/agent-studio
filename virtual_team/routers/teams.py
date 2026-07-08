"""Team API routes: CRUD and member management."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from virtual_team.logging_config import get_logger
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
async def list_teams():
    try:
        teams = await get_teams()
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
        raise HTTPException(status_code=500, detail=str(e)) from e


async def _snapshot_team(resource_id: str, session=None):
    """Create a version snapshot after team save."""
    try:
        if session is None:
            from virtual_team.database import get_session_factory
            factory = get_session_factory()
            async with factory() as s:
                await _do_snapshot_team(resource_id, s)
                await s.commit()
        else:
            await _do_snapshot_team(resource_id, session)
    except Exception:
        logger.warning("Version snapshot failed for team %s", resource_id, exc_info=True)


async def _do_snapshot_team(resource_id: str, session):
    from virtual_team.repository.versions import create_version as _cv
    from virtual_team.repository.teams import get_team
    item = await get_team(resource_id)
    if not item:
        return
    snapshot = {k: getattr(item, k, None) for k in item.__table__.columns.keys() if not k.startswith('_')}
    if "id" in snapshot:
        del snapshot["id"]
    if "created_at" in snapshot:
        snapshot["created_at"] = str(snapshot["created_at"])
    if "updated_at" in snapshot:
        snapshot["updated_at"] = str(snapshot["updated_at"])
    await _cv(session, "team", resource_id, snapshot, "system")

@router.post("/api/teams", status_code=201)
async def add_team(req: TeamCreateRequest):
    try:
        team = await create_team(name=req.name, description=req.description, status=req.status)
        if team is None:
            raise HTTPException(status_code=409, detail="团队名称已存在")
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
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/api/teams/{team_id}")
async def get_team_detail(team_id: str):
    team = await get_team(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="团队不存在")
    return team


@router.put("/api/teams/{team_id}")
async def update_team_endpoint(team_id: str, req: TeamUpdateRequest):
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
            raise HTTPException(status_code=404, detail="团队不存在")
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
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/api/teams/{team_id}")
async def delete_team_endpoint(team_id: str):
    try:
        deleted = await delete_team(team_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="团队不存在")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting team: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/api/teams/{team_id}/members", status_code=201)
async def add_member(team_id: str, req: MemberAddRequest):
    try:
        member = await add_team_member(
            team_id=team_id,
            name=req.name,
            role=req.role,
            agent_config_id=req.agent_config_id,
        )
        if not member:
            raise HTTPException(status_code=404, detail="团队不存在")
        return member
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error adding member: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/api/teams/{team_id}/members/{member_id}")
async def remove_member(team_id: str, member_id: str):
    try:
        deleted = await remove_team_member(team_id, member_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="成员不存在")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error removing member: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/api/teams/{team_id}/members/reorder")
async def reorder_members(team_id: str, req: ReorderRequest):
    try:
        await reorder_team_members(team_id, req.member_ids)
        return {"ok": True}
    except Exception as e:
        logger.error("Error reordering members: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


class LinkAgentRequest(BaseModel):
    agent_config_id: str


@router.put("/api/teams/{team_id}/members/{member_id}/link-agent")
async def link_agent(team_id: str, member_id: str, req: LinkAgentRequest):
    try:
        ok = await link_agent_config(member_id, req.agent_config_id)
        if not ok:
            raise HTTPException(status_code=404, detail="成员不存在")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error linking agent: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e
