"""Prompt CRUD API routes."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
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
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/prompts", status_code=201)
async def add_prompt(req: PromptCreate):
    try:
        p = await create_prompt(req.model_dump())
        return {"id": p.id, "name": p.name, "category": p.category, "content": p.content, "model": p.model, "status": p.status, "version": p.version, "created_at": p.created_at.isoformat() if p.created_at else None}
    except Exception as e:
        logger.error("Error creating prompt: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/prompts/{prompt_id}")
async def edit_prompt(prompt_id: str, req: PromptUpdate):
    try:
        p = await update_prompt(prompt_id, req.model_dump(exclude_unset=True))
        if not p:
            raise HTTPException(status_code=404, detail="Prompt not found")
        return {"id": p.id, "name": p.name, "category": p.category, "content": p.content, "status": p.status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating prompt: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/prompts/{prompt_id}", status_code=204)
async def remove_prompt(prompt_id: str):
    try:
        ok = await delete_prompt(prompt_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Prompt not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting prompt: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
