"""FastAPI application entry point: setup, lifespan, health check, and error handling."""

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

sys.path.insert(0, str(Path(__file__).parent.parent))

from virtual_team.broker import get_redis
from virtual_team.config import load_config
from virtual_team.database import get_async_engine, init_db
from virtual_team.logging_config import get_logger
from virtual_team.routers import admin, agents, attachments, commands, keys, mcps, models, prompts, runs, sessions, skills, system_team, teams, tools

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up — initializing configuration...")
    load_config()

    logger.info("Starting up — initializing database...")
    try:
        await init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.warning("Database init skipped (might not be available): %s", e)

    yield
    logger.info("Shutting down")


app = FastAPI(title="虚拟软件外包团队", lifespan=lifespan)

# ── Rate limiting ───────────────────────────────────────────────────────────
from virtual_team.rate_limit import RateLimitMiddleware

app.add_middleware(
    RateLimitMiddleware,
    rate=int(os.environ.get("RATE_LIMIT", "60")),
    window_seconds=int(os.environ.get("RATE_LIMIT_WINDOW", "60")),
)

# ── Authentication ──────────────────────────────────────────────────────────
from virtual_team.auth import AuthMiddleware

app.add_middleware(AuthMiddleware)

_cors_origins = [
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081",
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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    if isinstance(exc, HTTPException):
        raise exc
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误，请查看日志了解详情"},
    )


@app.get("/api/metrics")
async def metrics():
    from virtual_team.metrics import metrics_endpoint
    return metrics_endpoint()


@app.get("/api/health")
async def health():
    status = {"status": "ok", "database": "unknown", "redis": "unknown"}
    try:
        from sqlalchemy import text
        engine = get_async_engine()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        status["database"] = "connected"
    except Exception as e:
        status["database"] = f"disconnected: {e}"
        status["status"] = "degraded"

    try:
        r = get_redis()
        await r.ping()
        status["redis"] = "connected"
    except Exception as e:
        status["redis"] = f"disconnected: {e}"
        status["status"] = "degraded"

    return status


app.include_router(runs.router)
app.include_router(sessions.router)
app.include_router(agents.router)
app.include_router(attachments.router)
app.include_router(commands.router)
app.include_router(models.router)
app.include_router(keys.router)
app.include_router(teams.router)
app.include_router(tools.router)
app.include_router(skills.router)
app.include_router(prompts.router)
app.include_router(mcps.router)
app.include_router(admin.router)
app.include_router(system_team.router)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
