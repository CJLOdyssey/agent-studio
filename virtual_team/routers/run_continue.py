"""Run continuation API — "继续生成" feature, runs directly in uvicorn process."""

import asyncio

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from virtual_team.auth import get_user_id
from virtual_team.broker import buffer_run_messages
from virtual_team.config import load_config
from virtual_team.logging_config import get_logger
from virtual_team.repository import (
    create_run as db_create_run,
)
from virtual_team.repository import (
    create_session,
    get_default_api_key,
    update_run_status,
)
from virtual_team.routers.runs import RunResponse

logger = get_logger(__name__)
router = APIRouter(tags=["runs"])


class CompleteRunRequest(BaseModel):
    content: str = Field(default="")
    session_id: str | None = None
    thinking: str | None = None


@router.post("/api/runs/complete", response_model=RunResponse)
async def create_complete_run(req: CompleteRunRequest, request: Request):
    """Create a continuation run — streams raw LLM output without thinking/tools.

    Used by the frontend "继续生成" feature to append content to an interrupted
    agent message without triggering the LangGraph pipeline (no thinking_stream,
    no tool calls, no chat history).
    """
    config = load_config()
    content = (req.content or "").strip()

    session_id = req.session_id
    user_id = get_user_id(request)
    if session_id is None:
        title = content[:64] if content else "续写"
        sess = await create_session(title=title, user_id=user_id)
        session_id = sess.id

    # Resolve API credentials (same pattern as create_run)
    api_key: str | None = None
    api_base: str | None = None
    effective_model = config.model

    try:
        default_key = await get_default_api_key(user_id)
        if default_key:
            api_key = default_key["api_key"]
            api_base = default_key["base_url"]
    except Exception:
        logger.warning("Key vault lookup failed in complete_run — using env var fallback")

    if not api_key:
        raise HTTPException(status_code=400, detail="请先在设置中配置 API Key")

    # Create the new run
    run_id = await db_create_run(content, session_id=session_id)

    # Subscribe to Redis before the task starts
    await buffer_run_messages(run_id)

    async def _run_pipeline():
        """Run completion pipeline in background so HTTP returns immediately.
        Streaming output goes through Redis → WebSocket."""
        try:
            from virtual_team.tasks import _complete_pipeline

            await _complete_pipeline(
                content=content,
                run_id=run_id,
                api_key=api_key,
                api_base=api_base,
                model=effective_model,
                thinking=req.thinking,
            )
        except Exception:
            logger.exception("Complete pipeline failed for run=%s", run_id)
            await update_run_status(run_id, "error")

    asyncio.create_task(_run_pipeline())

    return RunResponse(run_id=run_id, status="running", session_id=session_id)
