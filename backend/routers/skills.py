"""Skill CRUD API routes."""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.audit import log_audit
from backend.core.error_codes import ErrorCode, error_response
from backend.core.infra.logging_config import get_logger
from backend.repository import create_skill as repo_create_skill
from backend.repository import delete_skill, update_skill
from backend.repository import get_skills as repo_get_skills
from backend.repository import get_skills_as_dicts as repo_get_skills_as_dicts

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
    version: str = "v1.0.0"
    author: str = ""
    status: str = "active"


class SkillUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    instructions: str | None = None
    prompt_id: str | None = None
    tool_names: list[str] | None = None
    output_constraint: str | None = None
    version: str | None = None
    author: str | None = None
    status: str | None = None


@router.get("/api/skills")
async def list_skills() -> Any:
    """List all skill configurations."""
    try:
        return await repo_get_skills_as_dicts()
    except Exception as e:
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.get("/api/skills/{skill_id}")
async def get_skill(skill_id: str) -> Any:
    """Get a single skill by ID."""
    try:
        skills = await repo_get_skills()
        s = next((sk for sk in skills if sk.id == skill_id), None)
        if not s:
            raise error_response(ErrorCode.SKILL_NOT_FOUND, detail="Skill not found")
        return {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "content": s.content,
            "author": s.author,
            "version": s.version,
            "status": s.status,
            "instructions": s.instructions,
            "prompt_id": s.prompt_id,
            "tool_names": s.tool_names,
            "output_constraint": s.output_constraint,
            "created_at": str(s.created_at) if s.created_at else None,
            "updated_at": str(s.updated_at) if s.updated_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


async def _snapshot_skill(resource_id: str, session: AsyncSession | None = None) -> Any:
    """Create a version snapshot after skill save."""
    try:
        from backend.repository.snapshot_helper import build_table_snapshot, with_session
        from backend.repository.versions import create_version as _cv

        async def _save(s: Any, rt: str, rid: str, **kw: Any) -> None:
            from backend.repository.skills import get_skills as _gskills
            all_items = await _gskills()
            item = next((sk for sk in all_items if sk.id == rid), None)
            if not item:
                return
            snapshot = build_table_snapshot(item)
            await _cv(s, rt, rid, snapshot, "system")

        await with_session(
            _save,
            resource_type="skill",
            resource_id=resource_id,
            session=session,
        )
    except Exception:
        logger.warning("Version snapshot failed for skill %s", resource_id, exc_info=True)


@router.post("/api/skills", status_code=201)
async def add_skill(req: SkillCreate) -> Any:
    """Create a new skill."""
    try:
        data = req.model_dump()
        data["content"] = data.pop("description", "")
        s = await repo_create_skill(data)
        await log_audit("create", "skill", s.name, "创建成功")
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
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.put("/api/skills/{skill_id}")
async def edit_skill(skill_id: str, req: SkillUpdate) -> Any:
    """Update an existing skill."""
    try:
        data = req.model_dump(exclude_unset=True)
        if "description" in data:
            data["content"] = data.pop("description")
        s = await update_skill(skill_id, data)
        if not s:
            raise error_response(ErrorCode.SKILL_NOT_FOUND, detail="Skill not found")
        await log_audit("update", "skill", s.name, "更新成功")
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
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.delete("/api/skills/{skill_id}", status_code=204)
async def remove_skill(skill_id: str) -> None:
    """Delete a skill by ID."""
    try:
        from backend.repository.skills import get_skills as _gskills
        all_items = await _gskills()
        target = next((s for s in all_items if s.id == skill_id), None)
        skill_name = target.name if target else skill_id
        ok = await delete_skill(skill_id)
        if not ok:
            raise error_response(ErrorCode.SKILL_NOT_FOUND, detail="Skill not found")
        await log_audit("delete", "skill", skill_name, "删除成功")
    except HTTPException:
        raise
    except Exception as e:
        raise error_response(ErrorCode.INTERNAL_ERROR) from e
