"""Prompt CRUD API routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from virtual_team.database import log_audit
from virtual_team.logging_config import get_logger
from virtual_team.repository import create_prompt, delete_prompt, get_prompts, update_prompt

logger = get_logger(__name__)
router = APIRouter(tags=["prompts"])


class PromptCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    category: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    model: str | None = None


class PromptUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    content: str | None = None
    model: str | None = None
    status: str | None = None


@router.get("/api/prompts")
async def list_prompts(category: str | None = None):
    try:
        prompts = await get_prompts()
        if category:
            prompts = [p for p in prompts if p.get("category") == category]
        return prompts
    except Exception as e:
        logger.error("Error listing prompts: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


async def _snapshot_prompt(resource_id: str, session=None):
    """Create a version snapshot after prompt save."""
    try:
        if session is None:
            from virtual_team.database import get_session_factory
            factory = get_session_factory()
            async with factory() as s:
                await _do_snapshot_prompt(resource_id, s)
                await s.commit()
        else:
            await _do_snapshot_prompt(resource_id, session)
    except Exception:
        logger.warning("Version snapshot failed for prompt %s", resource_id, exc_info=True)


async def _do_snapshot_prompt(resource_id: str, session):
    from virtual_team.repository.prompts import get_prompt
    from virtual_team.repository.versions import create_version as _cv
    item = await get_prompt(resource_id)
    if not item:
        return
    snapshot = {k: getattr(item, k, None) for k in item.__table__.columns if not k.startswith('_')}
    if "id" in snapshot:
        del snapshot["id"]
    if "created_at" in snapshot:
        snapshot["created_at"] = str(snapshot["created_at"])
    if "updated_at" in snapshot:
        snapshot["updated_at"] = str(snapshot["updated_at"])
    await _cv(session, "prompt", resource_id, snapshot, "system")

@router.post("/api/prompts", status_code=201)
async def add_prompt(req: PromptCreate):
    try:
        p = await create_prompt(req.model_dump())
        await log_audit("create", "prompt", p.name, "创建成功")
        return {
            "id": p.id,
            "name": p.name,
            "category": p.category,
            "content": p.content,
            "model": p.model,
            "status": p.status,
            "version": p.version,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
    except Exception as e:
        logger.error("Error creating prompt: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/api/prompts/{prompt_id}")
async def edit_prompt(prompt_id: str, req: PromptUpdate):
    try:
        p = await update_prompt(prompt_id, req.model_dump(exclude_unset=True))
        if not p:
            raise HTTPException(status_code=404, detail="Prompt not found")
        await log_audit("update", "prompt", p.name, "更新成功")
        return {
            "id": p.id,
            "name": p.name,
            "category": p.category,
            "content": p.content,
            "status": p.status,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating prompt: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/api/prompts/{prompt_id}", status_code=204)
async def remove_prompt(prompt_id: str):
    try:
        from virtual_team.repository import get_prompts
        prompts = await get_prompts()
        target = next((p for p in prompts if p["id"] == prompt_id), None)
        prompt_name = target["name"] if target else prompt_id
        ok = await delete_prompt(prompt_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Prompt not found")
        await log_audit("delete", "prompt", prompt_name, "删除成功")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting prompt: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e
