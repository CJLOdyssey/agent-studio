import json
import os
import sys
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).parent))

from virtual_team.celery_app import celery_app
from virtual_team.config import load_config as load_team_config
from virtual_team.database import init_db
from virtual_team.logging_config import get_logger
from virtual_team.redis_client import publish_run_message, subscribe_run
from virtual_team.repository import (
    get_messages,
    get_run,
    get_runs,
    get_agent_configs,
    get_agent_config_by_role,
    create_agent_config,
    update_agent_config,
    delete_agent_config,
    seed_default_agents,
    # Session + Memory
    create_session,
    get_session,
    get_sessions,
    get_session_runs,
    get_session_memories,
    create_memory_entry,
    delete_memory_entry,
    update_session_title,
    delete_session,
)

logger = get_logger(__name__)

MAX_REQUIREMENT_LENGTH = 2000


class RunRequest(BaseModel):
    requirement: str = Field(..., min_length=1, max_length=MAX_REQUIREMENT_LENGTH)
    session_id: str | None = None


class RunResponse(BaseModel):
    run_id: str
    status: str


class SessionCreateRequest(BaseModel):
    title: str = "新对话"


class SessionUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=256)


class AgentCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    role_identifier: str = Field(..., min_length=1, max_length=32, pattern=r'^[a-z_]+$')
    system_prompt: str = Field(..., min_length=1)
    model: str | None = None
    temperature: float | None = Field(default=None, ge=0.0, le=1.0)
    order: int = 0
    is_active: bool = True
    is_approver: bool = False
    icon: str = "🤖"


class AgentUpdateRequest(BaseModel):
    name: str | None = None
    system_prompt: str | None = None
    order: int | None = None
    is_active: bool | None = None
    is_approver: bool | None = None
    icon: str | None = None
    model: str | None = None
    temperature: float | None = Field(default=None, ge=0.0, le=1.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up — validating configuration...")
    cfg = load_team_config(validate=True)
    if not cfg.api_key:
        logger.warning("=" * 60)
        logger.warning("  API Key 未配置！请设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 环境变量")
        logger.warning("  讨论功能将无法正常使用")
        logger.warning("=" * 60)

    logger.info("Starting up — initializing database...")
    try:
        await init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.warning("Database init skipped (might not be available): %s", e)

    logger.info("Starting up — seeding default agent configs...")
    try:
        await seed_default_agents()
        logger.info("Default agent configs seeded")
    except Exception as e:
        logger.warning("Agent seeding skipped: %s", e)

    yield
    logger.info("Shutting down")


app = FastAPI(title="虚拟软件外包团队", lifespan=lifespan)

_cors_origins = [
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
]
_prod_origin = os.environ.get("CORS_ORIGIN")
if _prod_origin:
    _cors_origins.append(_prod_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/runs", response_model=RunResponse)
async def create_run(req: RunRequest):
    from virtual_team.repository import create_run as db_create_run

    requirement = req.requirement.strip()
    if not requirement:
        raise HTTPException(status_code=400, detail="需求不能为空")

    # Auto-create session if not provided
    session_id = req.session_id
    if session_id is None:
        sess = await create_session(title=requirement[:64])
        session_id = sess.id

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
        from virtual_team.tasks import run_discussion
        run_discussion.delay(requirement=requirement, run_id=run_id, session_id=session_id)
        logger.info("Task enqueued | run_id=%s | session_id=%s", run_id, session_id)
    except Exception as e:
        logger.error("Failed to enqueue task: %s", e, exc_info=True)
        from virtual_team.repository import update_run_status
        await update_run_status(run_id, "error")

    return RunResponse(run_id=run_id, status="pending")


@app.get("/api/runs/{run_id}")
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


@app.get("/api/runs")
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


@app.websocket("/ws/runs/{run_id}")
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


@app.get("/api/health")
async def health():
    status = {"status": "ok", "database": "unknown", "redis": "unknown"}
    try:
        from sqlalchemy import text
        from virtual_team.database import get_async_engine
        engine = get_async_engine()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        status["database"] = "connected"
    except Exception as e:
        status["database"] = f"disconnected: {e}"
        status["status"] = "degraded"

    try:
        from virtual_team.redis_client import get_redis
        r = get_redis()
        await r.ping()
        status["redis"] = "connected"
    except Exception as e:
        status["redis"] = f"disconnected: {e}"
        status["status"] = "degraded"

    return status


# ---- Session Routes ----

@app.get("/api/sessions")
async def list_sessions(limit: int = 50):
    try:
        sessions = await get_sessions(limit=min(limit, 100))
        result = []
        for s in sessions:
            runs = await get_session_runs(s.id)
            result.append({
                "id": s.id,
                "title": s.title,
                "run_count": len(runs),
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            })
        return result
    except Exception as e:
        logger.error("Error listing sessions: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sessions", status_code=201)
async def add_session(req: SessionCreateRequest):
    try:
        sess = await create_session(title=req.title)
        return {
            "id": sess.id,
            "title": sess.title,
            "created_at": sess.created_at.isoformat() if sess.created_at else None,
            "updated_at": sess.updated_at.isoformat() if sess.updated_at else None,
        }
    except Exception as e:
        logger.error("Error creating session: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{session_id}")
async def get_session_detail(session_id: str):
    try:
        sess = await get_session(session_id)
        if not sess:
            raise HTTPException(status_code=404, detail="未找到该对话")

        runs = await get_session_runs(session_id)
        memories = await get_session_memories(session_id)

        return {
            "id": sess.id,
            "title": sess.title,
            "created_at": sess.created_at.isoformat() if sess.created_at else None,
            "updated_at": sess.updated_at.isoformat() if sess.updated_at else None,
            "runs": [
                {
                    "id": r.id,
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
            ],
            "memories": [
                {
                    "id": m.id,
                    "agent_role": m.agent_role,
                    "content_type": m.content_type,
                    "summary": m.summary,
                    "details": m.details,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in memories
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting session %s: %s", session_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/sessions/{session_id}")
async def rename_session(session_id: str, req: SessionUpdateRequest):
    try:
        sess = await update_session_title(session_id, req.title)
        if not sess:
            raise HTTPException(status_code=404, detail="未找到该对话")
        return {"id": sess.id, "title": sess.title, "status": "updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error renaming session %s: %s", session_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/sessions/{session_id}")
async def remove_session(session_id: str):
    try:
        deleted = await delete_session(session_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="未找到该对话")
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting session %s: %s", session_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{session_id}/memories")
async def list_session_memories(session_id: str):
    try:
        sess = await get_session(session_id)
        if not sess:
            raise HTTPException(status_code=404, detail="未找到该对话")
        memories = await get_session_memories(session_id)
        return [
            {
                "id": m.id,
                "agent_role": m.agent_role,
                "content_type": m.content_type,
                "summary": m.summary,
                "details": m.details,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in memories
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error listing memories for %s: %s", session_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/memories/{memory_id}")
async def delete_session_memory(memory_id: str):
    try:
        deleted = await delete_memory_entry(memory_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="未找到该记忆")
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting memory %s: %s", memory_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{session_id}/memories/export")
async def export_session_memories(session_id: str, format: str = "json"):
    try:
        if format not in ("json", "md"):
            raise HTTPException(status_code=400, detail="format 参数必须为 json 或 md")

        sess = await get_session(session_id)
        if not sess:
            raise HTTPException(status_code=404, detail="未找到该对话")

        memories = await get_session_memories(session_id)
        items = [
            {
                "id": m.id,
                "agent_role": m.agent_role,
                "content_type": m.content_type,
                "summary": m.summary,
                "details": m.details,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in memories
        ]

        if format == "json":
            content = json.dumps(items, ensure_ascii=False, default=str, indent=2)
            return Response(
                content=content,
                media_type="application/json",
                headers={"Content-Disposition": f"attachment; filename=memories_{session_id}.json"},
            )

        # Markdown
        md_lines = [f"# Session Memories ({session_id})\n"]
        for m in memories:
            md_lines.append(f"## Memory: {m.content_type}")
            md_lines.append(f"**Agent**: {m.agent_role} | **Created**: {m.created_at.isoformat() if m.created_at else 'N/A'}")
            md_lines.append("")
            md_lines.append(f"**Summary**: {m.summary}")
            md_lines.append("")
            md_lines.append(f"**Details**:")
            md_lines.append(m.details or "(无详情)")
            md_lines.append("")
            md_lines.append("---")
            md_lines.append("")
        return Response(
            content="\n".join(md_lines),
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename=memories_{session_id}.md"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error exporting memories for %s: %s", session_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ---- Agent Config Routes ----

@app.get("/api/agents")
async def list_agents():
    try:
        configs = await get_agent_configs()
        return [
            {
                "id": c.id,
                "name": c.name,
                "role_identifier": c.role_identifier,
                "system_prompt": c.system_prompt,
                "model": c.model,
                "temperature": c.temperature,
                "order": c.order,
                "is_active": c.is_active,
                "is_approver": c.is_approver,
                "icon": c.icon,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in configs
        ]
    except Exception as e:
        logger.error("Error listing agents: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agents", status_code=201)
async def add_agent(req: AgentCreateRequest):
    existing = await get_agent_config_by_role(req.role_identifier)
    if existing:
        raise HTTPException(status_code=409, detail=f"角色标识 '{req.role_identifier}' 已存在")
    try:
        created = await create_agent_config(
            name=req.name,
            role_identifier=req.role_identifier,
            system_prompt=req.system_prompt,
            order=req.order,
            is_active=req.is_active,
            is_approver=req.is_approver,
            icon=req.icon,
            model=req.model,
            temperature=req.temperature,
        )
        return {"id": created.id, "status": "created"}
    except Exception as e:
        logger.error("Error creating agent: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/agents/{agent_id}")
async def edit_agent(agent_id: str, req: AgentUpdateRequest):
    updated = await update_agent_config(
        id=agent_id,
        name=req.name,
        system_prompt=req.system_prompt,
        order=req.order,
        is_active=req.is_active,
        is_approver=req.is_approver,
        icon=req.icon,
        model=req.model,
        temperature=req.temperature,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="未找到该 agent 配置")
    return {"id": updated.id, "status": "updated"}


@app.delete("/api/agents/{agent_id}")
async def remove_agent(agent_id: str):
    # Prevent deleting last approver
    configs = await get_agent_configs()
    target = next((c for c in configs if c.id == agent_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="未找到该 agent 配置")
    if target.is_approver:
        approvers = [c for c in configs if c.is_approver and c.id != agent_id]
        if not approvers:
            raise HTTPException(status_code=400, detail="不能删除唯一的审批者，请先设置其他审批者")
    deleted = await delete_agent_config(agent_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="未找到该 agent 配置")
    return {"status": "deleted"}


@app.put("/api/agents/{agent_id}/toggle")
async def toggle_agent(agent_id: str):
    configs = await get_agent_configs()
    target = next((c for c in configs if c.id == agent_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="未找到该 agent 配置")
    if target.is_active and target.is_approver:
        active_approvers = [c for c in configs if c.is_approver and c.is_active and c.id != agent_id]
        if not active_approvers:
            raise HTTPException(status_code=400, detail="不能停用唯一的活跃审批者")
    updated = await update_agent_config(id=agent_id, is_active=not target.is_active)
    return {"id": updated.id, "is_active": updated.is_active}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
