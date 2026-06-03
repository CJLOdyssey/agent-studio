"""Run API routes: create, list, detail, and WebSocket streaming."""

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from virtual_team.auth import get_user_id
from virtual_team.broker import subscribe_run
from virtual_team.logging_config import get_logger
from virtual_team.models import RunDetail, RunSummary
from virtual_team.repository import (
    get_messages, get_run, get_runs, update_run_status,
    create_session, get_session, update_session_title,
    get_api_key_for_use, get_default_api_key,
)

logger = get_logger(__name__)
router = APIRouter(tags=["runs"])

from virtual_team.config import load_config

_MAX_REQUIREMENT_LENGTH = 2000


class RunRequest(BaseModel):
    requirement: str = Field(..., min_length=1, max_length=_MAX_REQUIREMENT_LENGTH)
    session_id: str | None = None
    key_id: str | None = Field(default=None, description="Vaulted API key ID — server resolves key, never exposes it")
    model: str | None = None


class RunResponse(BaseModel):
    run_id: str
    status: str


@router.post("/api/runs", response_model=RunResponse)
async def create_run(req: RunRequest, request: Request):
    from virtual_team.repository import create_run as db_create_run

    requirement = req.requirement.strip()
    config = load_config()
    if len(requirement) > config.max_requirement_length:
        raise HTTPException(status_code=400, detail=f"需求不能超过 {config.max_requirement_length} 字")
    if not requirement:
        raise HTTPException(status_code=400, detail="需求不能为空")

    session_id = req.session_id
    if session_id is None:
        sess = await create_session(title=requirement[:64])
        session_id = sess.id

    # ── Resolve API credentials from the enterprise key vault ──────────────
    user_id = get_user_id(request)
    api_key = None
    api_base = None
    effective_model = req.model or config.model

    try:
        if req.key_id:
            key_cfg = await get_api_key_for_use(req.key_id, user_id)
            if key_cfg:
                api_key = key_cfg["api_key"]
                api_base = key_cfg["base_url"]
        else:
            # No key_id specified — use user's default key
            default_key = await get_default_api_key(user_id)
            if default_key:
                api_key = default_key["api_key"]
                api_base = default_key["base_url"]
    except Exception:
        logger.warning("Key vault lookup failed — falling back to server env var")

    # Fallback to server environment variables
    if not api_key:
        api_key = config.api_key
        api_base = config.api_base

    try:
        run_id = await db_create_run(requirement, session_id=session_id)
    except Exception as e:
        logger.error("Failed to create run: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建失败: {e}")

    try:
        sess = await get_session(session_id)
        if sess:
            await update_session_title(session_id, sess.title)
    except Exception:
        pass

    try:
        from virtual_team.tasks import run_agent
        run_agent.delay(
            requirement=requirement,
            run_id=run_id,
            session_id=session_id,
            api_key=api_key,
            api_base=api_base,
            model=effective_model,
        )
        logger.info("Task enqueued | run_id=%s | session_id=%s | model=%s", run_id, session_id, effective_model)
    except Exception as e:
        logger.error("Failed to enqueue task: %s", e, exc_info=True)
        await update_run_status(run_id, "error")

    return RunResponse(run_id=run_id, status="pending")


@router.get("/api/runs/{run_id}", response_model=RunDetail)
async def get_run_detail(run_id: str):
    try:
        run = await get_run(run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="未找到该次讨论")
        messages = await get_messages(run_id)
        return {
            "id": run.id,
            "session_id": run.session_id,
            "requirement": run.requirement,
            "pm_document": run.pm_document,
            "code": run.code,
            "review": run.review,
            "approved": run.approved,
            "status": run.status,
            "created_at": run.created_at.isoformat() if run.created_at else None,
            "updated_at": run.updated_at.isoformat() if run.updated_at else None,
            "messages": [
                {
                    "id": m.id,
                    "role": m.role,
                    "agent_name": m.agent_name,
                    "content": m.content,
                    "round_number": m.round_number,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in messages
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching run %s: %s", run_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/runs", response_model=list[RunSummary])
async def list_runs(limit: int = 20):
    try:
        runs = await get_runs(limit=min(limit, 100))
        return [
            {
                "id": r.id,
                "session_id": r.session_id,
                "requirement": r.requirement,
                "pm_document": r.pm_document,
                "code": r.code,
                "review": r.review,
                "approved": r.approved,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in runs
        ]
    except Exception as e:
        logger.error("Error listing runs: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/ws/runs/{run_id}")
async def run_websocket(websocket: WebSocket, run_id: str):
    await websocket.accept()
    logger.info("WebSocket connected | run_id=%s", run_id)
    try:
        await websocket.send_json({"type": "status", "status": "connected"})
        try:
            async for message in subscribe_run(run_id):
                try:
                    await websocket.send_json(message)
                except WebSocketDisconnect:
                    logger.info("WebSocket disconnected | run_id=%s", run_id)
                    return
                except Exception as e:
                    logger.warning("WebSocket send error: %s", e)
                    return
        except Exception as e:
            logger.error("Redis subscribe error: %s", e, exc_info=True)
            try:
                await websocket.send_json({"type": "status", "status": "error", "error": str(e)})
            except Exception:
                pass
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected gracefully | run_id=%s", run_id)
    except Exception as e:
        logger.error("WebSocket error | run_id=%s | error=%s", run_id, e, exc_info=True)
