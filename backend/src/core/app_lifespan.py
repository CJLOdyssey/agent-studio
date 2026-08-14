"""Application lifespan — startup tasks, database init, seed tools, and graceful shutdown."""

from __future__ import annotations

import asyncio
import contextlib
import gc
import os
import platform
from typing import TYPE_CHECKING, Any, cast

from broker import BROKER_URL, REDIS_URL, close_redis, get_redis
from core.config import load_config
from core.infra.database import DATABASE_URL, get_session_factory, init_db
from core.infra.events import Events, bus
from core.infra.logging_config import get_logger
from observability.startup_guard import mark_started, mark_stopped, record_crash

if TYPE_CHECKING:
    from fastapi import FastAPI

logger = get_logger(__name__)


# ── Helpers ─────────────────────────────────────────────────────────


def _mask_url(url: str) -> str:
    """Mask credentials in a connection URL."""
    if "@" in url:
        userinfo, rest = url.split("@", 1)
        return f"{userinfo.split(':')[0]}:***@{rest}"
    return url


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _add(lines: list[str], fmt: str, *args: object) -> None:
    lines.append("[LIFECYCLE] " + (fmt % args))


# ── Startup report ──────────────────────────────────────────────────


def _startup_report() -> list[str]:
    lines: list[str] = []
    lines.append("[LIFECYCLE] === Application Starting ===")
    _add(
        lines,
        "runtime: python=%s | platform=%s | pid=%d",
        platform.python_version(),
        platform.platform(terse=True),
        os.getpid(),
    )
    _add(lines, "auth: mode=%s | enabled=%s", _env("AUTH_MODE", "legacy"), _env("AUTH_ENABLED", "0"))
    _user_rate = _env("RATE_LIMIT_USER", "none")
    _add(
        lines, "rate_limit: %s req/%ss | user=%s",
        _env("RATE_LIMIT", "60"), _env("RATE_LIMIT_WINDOW", "60"), _user_rate,
    )
    _add(lines, "cors_origin: %s", _env("CORS_ORIGIN", "not set (dev defaults)"))
    _add(
        lines, "model: %s | base_url: %s", _env("OPENAI_MODEL", "deepseek-v4-flash"), _env("OPENAI_BASE_URL", "not set")
    )
    _add(lines, "database_url: %s", _mask_url(DATABASE_URL))
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


# ── Database init ───────────────────────────────────────────────────


async def _do_init_db() -> None:
    await init_db()
    from sqlalchemy import text

    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(text("SELECT 1"))
        result.scalar()
        logger.info("[LIFECYCLE] database connection verified")


async def _init_database() -> None:
    logger.info("[LIFECYCLE] initializing database...")
    try:
        await _do_init_db()
    except Exception as e:
        logger.warning("[LIFECYCLE] database init skipped: %s", e)


async def _check_redis() -> None:
    logger.info("[LIFECYCLE] verifying Redis connection...")
    try:
        r = get_redis()
        pong: bool = bool(await cast(Any, r.ping()))
        logger.info("[LIFECYCLE] redis ping=%s", pong)
    except Exception as e:
        logger.warning("[LIFECYCLE] redis unavailable (pub/sub will fail): %s", e)


async def _prewarm_pipeline() -> None:
    """Warm the run pipeline at boot so the first POST /api/runs after a
    restart isn't a 10s cold start (lazy imports + checkpointer schema +
    graph compilation) that trips the frontend's 10s axios timeout.

    Lazy imports stay lazy inside run_service/tasks — this function
    explicitly pulls the whole chain in during startup instead.
    """
    import time

    # Skip under the test harness: TestClient triggers the full lifespan
    # per test, so prewarming would repeat the import chain (and its
    # checkpointer/graph setup) dozens of times for zero benefit.
    if ":memory:" in DATABASE_URL:
        return

    t0 = time.time()

    # 1. Lazy-import chain used by create_run / continue_run / team runs.
    #    Importing ``tasks`` pulls agent_pipeline → graph.graph →
    #    streaming.llm_stream → langchain/langgraph/httpx, plus the team
    #    pipeline and registry.
    # 2. Checkpointer schema — create_checkpointer_async() runs CREATE TABLE
    #    (AsyncSqliteSaver.setup / AsyncPostgresSaver.setup). Pre-creating it
    #    here moves that cost out of the first run. A fresh checkpointer is
    #    created per run anyway; this one is only for the warmup and is closed
    #    immediately.
    from checkpoint import close_checkpointer, create_checkpointer_async
    from tasks import (  # noqa: F401
        _complete_pipeline,
        _run_agent_pipeline,
        registry,
    )
    from tasks.team_pipeline import _run_team_pipeline  # noqa: F401

    warm_ckpt = await create_checkpointer_async()
    await close_checkpointer(warm_ckpt)

    # 3. Compile the LangGraph state graph once (compilation is the same for
    #    every run; only checkpointer/tools differ). MemorySaver avoids
    #    opening a real connection just for warmup.
    from langgraph.checkpoint.memory import MemorySaver

    from graph.graph import SingleAgentGraph

    SingleAgentGraph(
        model="warmup",
        api_key="warmup",
        base_url=None,
        checkpointer=MemorySaver(),
    )

    logger.info("[LIFECYCLE] pipeline prewarmed in %.2fs", time.time() - t0)


# ── Lifespan ────────────────────────────────────────────────────────


async def startup(app: FastAPI) -> None:
    """Run on application startup — config, GC, DB, Redis."""
    load_config()

    # NOTE: PR_SET_PDEATHSIG was removed because it kills the backend when
    # the parent shell exits (after `nohup uvicorn ... &` or Makefile targets).
    # External cleanup (startup script's pkill, _kill_stuck_child_processes)
    # handles orphan processes instead.

    import thinking_tree.tools  # noqa: F401

    startup_log = _startup_report()
    for line in startup_log:
        logger.info("%s", line)

    # Event bus observability — log every event at DEBUG level
    def _log_event(event: str, **kw: object) -> None:
        logger.debug("[EVENT] %s %s", event, kw)

    for ev in (Events.RUN_CREATED, Events.AGENT_CONFIG_CHANGED, Events.KEY_CREATED, Events.KEY_DELETED):
        bus.on(ev, _log_event)

    # Periodic GC
    gc.set_threshold(1000, 10, 10)

    async def _periodic_gc() -> None:
        while True:
            try:
                await asyncio.sleep(int(_env("GC_INTERVAL", "60")))
                collected = gc.collect()
                if collected:
                    logger.info("GC collected %d objects", collected)
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Periodic GC failed, continuing...")

    app.state.gc_task = asyncio.create_task(_periodic_gc())

    # Periodic observability event retention cleanup
    _retention_days = int(_env("OBSERVABILITY_RETENTION_DAYS", "30"))

    async def _periodic_retention() -> None:
        from observability.store import get_store
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour
                store = get_store()
                deleted = store.cleanup(retention_days=_retention_days)
                if deleted > 0:
                    logger.info(
                        "[RETENTION] cleaned up %d observability events older than %d days",
                        deleted, _retention_days,
                    )
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Observability retention cleanup failed, continuing...")

    app.state.retention_task = asyncio.create_task(_periodic_retention())

    # Database + Redis
    try:
        await _init_database()
        await _check_redis()
    except Exception as exc:
        record_crash(exc)
        raise

    # Warm the run pipeline (lazy imports + checkpointer schema + graph
    # compilation) so the first request after a restart isn't a ~10s cold
    # start. Best-effort: a warmup failure must not block serving.
    try:
        await _prewarm_pipeline()
    except Exception:
        logger.exception("[LIFECYCLE] pipeline prewarm failed — first run will pay cold-start cost")

    mark_started()


async def shutdown(app: FastAPI) -> None:
    """Run on application shutdown — cancel GC + retention, stop marker."""
    for attr in ("gc_task", "retention_task"):
        task = getattr(app.state, attr, None)
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError, asyncio.TimeoutError):
                await asyncio.wait_for(task, timeout=5)
    from observability.store import get_store

    get_store().close()
    from core.infra.database import dispose_engine

    dispose_engine()
    await close_redis()
    mark_stopped()
    logger.info("[LIFECYCLE] shutting down — app=%s | pid=%d", app.title, os.getpid())
