"""Skill CRUD API routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from virtual_team.logging_config import get_logger
from virtual_team.repository import create_skill as repo_create_skill
from virtual_team.repository import delete_skill, update_skill
from virtual_team.repository import get_skills as repo_get_skills

logger = get_logger(__name__)
router = APIRouter(tags=["skills"])


class SkillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    category: str = Field(..., min_length=1, max_length=32)
    description: str = ""
    instructions: str = ""
    prompt_id: str | None = None
    tool_names: list[str] = []
    output_constraint: str = ""


class SkillUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    instructions: str | None = None
    prompt_id: str | None = None
    tool_names: list[str] | None = None
    output_constraint: str | None = None
    status: str | None = None


@router.get("/api/skills")
async def list_skills():
    try:
        return await repo_get_skills()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/api/skills/{skill_id}")
async def get_skill(skill_id: str):
    try:
        skills = await repo_get_skills()
        s = next((sk for sk in skills if sk["id"] == skill_id), None)
        if not s:
            raise HTTPException(status_code=404, detail="Skill not found")
        return s
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


async def _snapshot_skill(resource_id: str, session=None):
    """Create a version snapshot after skill save."""
    try:
        if session is None:
            from virtual_team.database import get_session_factory

            factory = get_session_factory()
            async with factory() as s:
                await _do_snapshot_skill(resource_id, s)
                await s.commit()
        else:
            await _do_snapshot_skill(resource_id, session)
    except Exception:
        logger.warning("Version snapshot failed for skill %s", resource_id, exc_info=True)


async def _do_snapshot_skill(resource_id: str, session):
    from virtual_team.repository.skills import get_skill
    from virtual_team.repository.versions import create_version as _cv

    item = await get_skill(resource_id)
    if not item:
        return
    snapshot = {k: getattr(item, k, None) for k in item.__table__.columns if not k.startswith("_")}
    if "id" in snapshot:
        del snapshot["id"]
    if "created_at" in snapshot:
        snapshot["created_at"] = str(snapshot["created_at"])
    if "updated_at" in snapshot:
        snapshot["updated_at"] = str(snapshot["updated_at"])
    await _cv(session, "skill", resource_id, snapshot, "system")


@router.post("/api/skills", status_code=201)
async def add_skill(req: SkillCreate):
    try:
        data = req.model_dump()
        data["content"] = data.pop("description", "")
        s = await repo_create_skill(data)
        return {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "status": s.status,
            "prompt_id": s.prompt_id,
            "tool_names": s.tool_names,
            "output_constraint": s.output_constraint,
            "instructions": s.instructions,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/api/skills/{skill_id}")
async def edit_skill(skill_id: str, req: SkillUpdate):
    try:
        data = req.model_dump(exclude_unset=True)
        if "description" in data:
            data["content"] = data.pop("description")
        s = await update_skill(skill_id, data)
        if not s:
            raise HTTPException(status_code=404, detail="Skill not found")
        return {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "status": s.status,
            "prompt_id": s.prompt_id,
            "tool_names": s.tool_names,
            "output_constraint": s.output_constraint,
            "instructions": s.instructions,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/api/skills/{skill_id}", status_code=204)
async def remove_skill(skill_id: str):
    try:
        ok = await delete_skill(skill_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Skill not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
