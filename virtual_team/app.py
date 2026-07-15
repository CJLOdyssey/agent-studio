"""FastAPI application entry point: setup, lifespan, health check, and error handling."""

import contextlib
import os
import platform
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

sys.path.insert(0, str(Path(__file__).parent.parent))

from virtual_team.broker import get_redis  # noqa: E402
from virtual_team.config import load_config  # noqa: E402
from virtual_team.database import init_db  # noqa: E402
from virtual_team.logging_config import get_logger  # noqa: E402
from virtual_team.routers import (  # noqa: E402, F401
    admin,
    agents,
    attachments,
    auth,
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
    workflows,
)

logger = get_logger(__name__)


def _mask_url(url: str) -> str:
    """Mask credentials in a connection URL (e.g. postgresql://user:***@host/db)."""
    if "@" in url:
        userinfo, rest = url.split("@", 1)
        return f"{userinfo.split(':')[0]}:***@{rest}"
    return url


def _mask_key(key: str, keep: int = 4) -> str:
    if len(key) <= keep + 4:
        return "***"
    return key[:4] + "***" + key[-keep:]


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    import gc

    load_config()
    startup_log = _startup_report()
    for line in startup_log:
        logger.info("%s", line)

    # ── Periodic GC ──────────────────────────────────────────────────────────
    gc.set_threshold(1000, 10, 10)
    if hasattr(gc, "enable"):
        gc.enable()

    async def _periodic_gc():
        while True:
            await asyncio.sleep(int(_env("GC_INTERVAL", "60")))
            collected = gc.collect()
            if collected:
                logger.info("GC collected %d objects", collected)

    gc_task = asyncio.create_task(_periodic_gc())

    # ── Database ─────────────────────────────────────────────────────────────
    _init_database()
    await _check_redis()

    yield
    gc_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await gc_task
    logger.info("[LIFECYCLE] shutting down — app=%s | pid=%d", __name__, os.getpid())


def _startup_report() -> list[str]:
    """Build a multi-line startup report, one string per line."""
    lines: list[str] = []
    lines.append("[LIFECYCLE] === Application Starting ===")
    _add(lines, "runtime: python=%s | platform=%s | pid=%d",
         platform.python_version(), platform.platform(terse=True), os.getpid())
    _add(lines, "auth: mode=%s | enabled=%s", _env("AUTH_MODE", "legacy"), _env("AUTH_ENABLED", "0"))
    _add(lines, "rate_limit: %s req/%ss", _env("RATE_LIMIT", "60"), _env("RATE_LIMIT_WINDOW", "60"))
    _add(lines, "cors_origin: %s", _env("CORS_ORIGIN", "not set (dev defaults)"))
    _add(lines, "model: %s | base_url: %s",
         _env("OPENAI_MODEL", "deepseek-v4-flash"), _env("OPENAI_BASE_URL", "not set"))
    from virtual_team.database import DATABASE_URL
    _add(lines, "database_url: %s", _mask_url(DATABASE_URL))
    from virtual_team.broker import BROKER_URL, REDIS_URL
    _add(lines, "redis_url: %s", _mask_url(REDIS_URL))
    _add(lines, "celery_broker: %s", _mask_url(BROKER_URL))
    _add(lines, "email: backend=%s | from=%s", _env("EMAIL_BACKEND", "log"), _env("EMAIL_FROM", "not set"))
    _add(lines, "upload_dir: %s", _env("UPLOAD_DIR", "./uploads"))
    _add(lines, "logging: format=%s | level=%s", _env("LOG_FORMAT", "text"), _env("LOG_LEVEL", "INFO"))
    has_deepseek = bool(_env("DEEPSEEK_API_KEY"))
    has_openai = bool(_env("OPENAI_API_KEY"))
    if has_deepseek or has_openai:
        _add(lines, "api_key: configured (deepseek=%s | openai=%s)", has_deepseek, has_openai)
    else:
        lines.append("[LIFECYCLE] api_key: not set (BYOK)")
    lines.append("[LIFECYCLE] === Startup config complete ===")
    return lines


def _add(lines: list[str], fmt: str, *args: object) -> None:
    lines.append("[LIFECYCLE] " + (fmt % args))


def _init_database():
    logger.info("[LIFECYCLE] initializing database...")
    import asyncio

    try:
        asyncio.run(_do_init_db())
    except Exception as e:
        logger.warning("[LIFECYCLE] database init skipped: %s", e)


async def _do_init_db():
    await init_db()
    await seed_default_tools()
    # Verify connection by running a minimal query
    from sqlalchemy import text

    from virtual_team.database import get_session_factory

    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(text("SELECT 1"))
        result.scalar()
        logger.info("[LIFECYCLE] database connection verified")


async def _check_redis():
    logger.info("[LIFECYCLE] verifying Redis connection...")

    try:
        r = get_redis()
        pong = await r.ping()
        logger.info("[LIFECYCLE] redis ping=%s", pong)
    except Exception as e:
        logger.warning("[LIFECYCLE] redis unavailable (pub/sub will fail): %s", e)


async def seed_default_tools():
    from sqlalchemy import select

    from virtual_team.database import RegisteredToolDB, get_session_factory

    factory = get_session_factory()
    async with factory() as session:
        existing = await session.execute(select(RegisteredToolDB).limit(1))
        if existing.scalar_one_or_none():
            return

        seed_data = [
            {"name": "web_search", "category": "builtin", "description": "Search the web for current information.", "endpoint": "builtin://web_search"},
            {"name": "calculator", "category": "builtin", "description": "Evaluate math expressions: +, -, *, /, **, %, sqrt, sin, cos.", "endpoint": "builtin://calculator"},
            {"name": "fetch_page", "category": "builtin", "description": "Fetch and read the content of a web page.", "endpoint": "builtin://fetch_page"},
        ]
        for data in seed_data:
            session.add(RegisteredToolDB(**data))
        await session.commit()
        logger.info("[LIFECYCLE] seeded %d default tools", len(seed_data))


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


# ── Request logging (outermost — catches everything including rejected requests)
from virtual_team.request_logger import RequestLogMiddleware  # noqa: E402

app.add_middleware(RequestLogMiddleware)


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
    return await metrics_endpoint()


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/version")
async def version():
    from virtual_team import __version__
    return {"version": __version__}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8080"))
    logger.info("Starting uvicorn on 0.0.0.0:%d", port)
    uvicorn.run("virtual_team.app:app", host="0.0.0.0", port=port, reload=True)
