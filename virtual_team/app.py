"""FastAPI application entry point: setup, lifespan, health check, and error handling."""

import contextlib
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

sys.path.insert(0, str(Path(__file__).parent.parent))

from virtual_team.broker import get_redis  # noqa: E402
from virtual_team.config import load_config  # noqa: E402
from virtual_team.database import get_async_engine, init_db  # noqa: E402
from virtual_team.logging_config import get_logger  # noqa: E402
from virtual_team.routers import (  # noqa: E402
    admin,
    agents,
    attachments,
    commands,
    keys,
    mcps,
    models,
    prompts,
    providers,
    runs,
    sessions,
    skills,
    system_team,
    teams,
    tools,
    versions,
)

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    import gc
    import os

    logger.info("Starting up — initializing configuration...")
    load_config()

    gc.set_threshold(1000, 10, 10)
    if hasattr(gc, "enable"):
        gc.enable()
    logger.info("GC thresholds: %s", gc.get_threshold())

    async def _periodic_gc():
        while True:
            await asyncio.sleep(int(os.environ.get("GC_INTERVAL", "60")))
            collected = gc.collect()
            if collected:
                logger.info("GC collected %d objects", collected)

    gc_task = asyncio.create_task(_periodic_gc())

    logger.info("Starting up — initializing database...")
    try:
        await init_db()
        await seed_default_tools()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.warning("Database init skipped (might not be available): %s", e)

    yield
    gc_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await gc_task
    logger.info("Shutting down")


async def seed_default_tools():
    from sqlalchemy import select

    from virtual_team.database import RegisteredToolDB, get_session_factory

    factory = get_session_factory()
    async with factory() as session:
        existing = await session.execute(select(RegisteredToolDB).limit(1))
        if existing.scalar_one_or_none():
            return  # already seeded

        seed_data = [
            {"name": "web_search", "category": "builtin", "description": "Search the web for current information.", "endpoint": "builtin://web_search"},  # noqa: E501
            {"name": "calculator", "category": "builtin", "description": "Evaluate math expressions: +, -, *, /, **, %, sqrt, sin, cos.", "endpoint": "builtin://calculator"},  # noqa: E501
            {"name": "fetch_page", "category": "builtin", "description": "Fetch and read the content of a web page.", "endpoint": "builtin://fetch_page"},  # noqa: E501
        ]
        for data in seed_data:
            session.add(RegisteredToolDB(**data))
        await session.commit()
        logger.info("Seeded %d default tools", len(seed_data))


app = FastAPI(title="AgentStudio", lifespan=lifespan)

# ── Rate limiting ───────────────────────────────────────────────────────────
from virtual_team.rate_limit import RateLimitMiddleware  # noqa: E402

app.add_middleware(
    RateLimitMiddleware,
    rate=int(os.environ.get("RATE_LIMIT", "60")),
    window_seconds=int(os.environ.get("RATE_LIMIT_WINDOW", "60")),
)

# ── Authentication ──────────────────────────────────────────────────────────
from virtual_team.auth import AuthMiddleware  # noqa: E402

app.add_middleware(AuthMiddleware)

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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True
    )
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
        await r.ping()  # type: ignore[misc]
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
app.include_router(providers.router)
app.include_router(versions.router)
app.include_router(system_team.router)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
