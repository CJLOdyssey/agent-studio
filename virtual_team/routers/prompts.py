"""Prompt CRUD API routes."""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from virtual_team.audit import log_audit
from virtual_team.error_codes import ErrorCode, error_response
from virtual_team.logging_config import get_logger
from virtual_team.repository import create_prompt, delete_prompt, get_prompts_as_dicts, update_prompt

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
async def list_prompts(category: str | None = None) -> Any:
    try:
        prompts = await get_prompts_as_dicts()
        if category:
            prompts = [p for p in prompts if p["category"] == category]
        return prompts
    except Exception as e:
        logger.error("Error listing prompts: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


async def _snapshot_prompt(resource_id: str, session: AsyncSession | None = None) -> Any:
    """Create a version snapshot after prompt save."""
    try:
        from virtual_team.repository.snapshot_helper import build_table_snapshot, with_session
        from virtual_team.repository.versions import create_version as _cv

        async def _save(s: Any, rt: str, rid: str, **kw: Any) -> None:
            from virtual_team.repository.prompts import get_prompt
            item = await get_prompt(rid)
            if not item:
                return
            snapshot = build_table_snapshot(item)
            await _cv(s, rt, rid, snapshot, "system")

        await with_session(
            _save,
            resource_type="prompt",
            resource_id=resource_id,
            session=session,
        )
    except Exception:
        logger.warning("Version snapshot failed for prompt %s", resource_id, exc_info=True)

@router.post("/api/prompts", status_code=201)
async def add_prompt(req: PromptCreate) -> Any:
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
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.put("/api/prompts/{prompt_id}")
async def edit_prompt(prompt_id: str, req: PromptUpdate) -> Any:
    try:
        p = await update_prompt(prompt_id, req.model_dump(exclude_unset=True))
        if not p:
            raise error_response(ErrorCode.PROMPT_NOT_FOUND, detail="Prompt not found")
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
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.delete("/api/prompts/{prompt_id}", status_code=204)
async def remove_prompt(prompt_id: str) -> None:
    try:
        from virtual_team.repository import get_prompts
        prompts = await get_prompts()
        target = next((p for p in prompts if p.id == prompt_id), None)
        prompt_name = target.name if target else prompt_id
        ok = await delete_prompt(prompt_id)
        if not ok:
            raise error_response(ErrorCode.PROMPT_NOT_FOUND, detail="Prompt not found")
        await log_audit("delete", "prompt", prompt_name, "删除成功")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting prompt: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e
