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
    remove_team_member,
    reorder_team_members,
    update_team,
)

logger = get_logger(__name__)
router = APIRouter(tags=["teams"])


class TeamCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)


class TeamUpdateRequest(BaseModel):
    name: str | None = None
    order: int | None = None
    is_expanded: bool | None = None


class MemberAddRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    role: str = "待配置角色"


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
                "order": t["order"],
                "is_expanded": t["is_expanded"],
                "agents": t["agents"],
                "created_at": t["created_at"],
            }
            for t in teams
        ]
    except Exception as e:
        logger.error("Error listing teams: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/teams", status_code=201)
async def add_team(req: TeamCreateRequest):
    try:
        team = await create_team(name=req.name)
        return {
            "id": team.id,
            "name": team.name,
            "order": team.order,
            "is_expanded": team.is_expanded,
            "agents": [],
        }
    except Exception as e:
        logger.error("Error creating team: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
            order=req.order,
            is_expanded=req.is_expanded,
        )
        if not team:
            raise HTTPException(status_code=404, detail="团队不存在")
        return {"id": team.id, "name": team.name, "order": team.order, "is_expanded": team.is_expanded}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating team: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/teams/{team_id}/members", status_code=201)
async def add_member(team_id: str, req: MemberAddRequest):
    try:
        member = await add_team_member(
            team_id=team_id,
            name=req.name,
            role=req.role,
        )
        if not member:
            raise HTTPException(status_code=404, detail="团队不存在")
        return member
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error adding member: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/teams/{team_id}/members/reorder")
async def reorder_members(team_id: str, req: ReorderRequest):
    try:
        await reorder_team_members(team_id, req.member_ids)
        return {"ok": True}
    except Exception as e:
        logger.error("Error reordering members: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
