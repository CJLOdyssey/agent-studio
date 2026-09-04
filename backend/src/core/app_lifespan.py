"""应用生命周期 —— 启动任务、数据库初始化、工具种子与优雅关闭。"""

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


# ── 辅助函数 ─────────────────────────────────────────────────────────


def _mask_url(url: str) -> str:
    """对连接 URL 中的凭据做脱敏。"""
    if "@" in url:
        userinfo, rest = url.split("@", 1)
        return f"{userinfo.split(':')[0]}:***@{rest}"
    return url


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _add(lines: list[str], fmt: str, *args: object) -> None:
    lines.append("[LIFECYCLE] " + (fmt % args))


# ── 启动报告 ──────────────────────────────────────────────────


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
        lines,
        "rate_limit: %s req/%ss | user=%s",
        _env("RATE_LIMIT", "60"),
        _env("RATE_LIMIT_WINDOW", "60"),
        _user_rate,
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


# ── 数据库初始化 ───────────────────────────────────────────────────


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
    """在启动时预热 run 管线，避免重启后首次 POST /api/runs 出现约 10s 冷启动
    （惰性导入 + checkpointer 建表 + 图编译），导致前端 10s axios 超时。

    run_service/tasks 内的惰性导入保持惰性 —— 本函数在启动期显式拉取整条依赖链。
    """
    import time

    # 测试环境下跳过：TestClient 每个测试都会触发完整生命周期，
    # 预热会重复执行导入链（及其 checkpointer/图初始化）几十次却毫无收益。
    if ":memory:" in DATABASE_URL:
        return

    t0 = time.time()

    # 1. create_run / continue_run / team runs 使用的惰性导入链。
    #    导入 ``tasks`` 会连带 agent_pipeline → graph.graph →
    #    streaming.llm_stream → langchain/langgraph/httpx，以及 team pipeline 和 registry。
    # 2. Checkpointer 建表 —— create_checkpointer_async() 执行 CREATE TABLE
    #    （AsyncSqliteSaver.setup / AsyncPostgresSaver.setup）。在此预先创建
    #    可把该成本从首次 run 移出。反正每次 run 都会新建 checkpointer；
    #    这个仅用于预热，用完立即关闭。
    from checkpoint import close_checkpointer, create_checkpointer_async
    from tasks import (  # noqa: F401
        _complete_pipeline,
        _run_agent_pipeline,
        registry,
    )
    from tasks.team_pipeline import _run_team_pipeline  # noqa: F401

    warm_ckpt = await create_checkpointer_async()
    await close_checkpointer(warm_ckpt)

    # 3. 编译一次 LangGraph 状态图（每次 run 编译结果相同，仅 checkpointer/tools 不同）。
    #    MemorySaver 避免仅为预热打开真实连接。
    from langgraph.checkpoint.memory import MemorySaver

    from graph.graph import SingleAgentGraph

    SingleAgentGraph(
        model="warmup",
        api_key="warmup",
        base_url=None,
        checkpointer=MemorySaver(),
    )

    logger.info("[LIFECYCLE] pipeline prewarmed in %.2fs", time.time() - t0)


# ── 生命周期 ────────────────────────────────────────────────────────


async def startup(app: FastAPI) -> None:
    """应用启动时执行 —— 配置、GC、数据库、Redis。"""
    load_config()

    # NOTE: 移除了 PR_SET_PDEATHSIG，因为它会在父 shell 退出时（`nohup uvicorn ... &`
    # 或 Makefile 目标之后）杀死后端。改用外部清理（启动脚本的 pkill、
    # _kill_stuck_child_processes）处理孤儿进程。

    import thinking_tree.tools  # noqa: F401

    startup_log = _startup_report()
    for line in startup_log:
        logger.info("%s", line)

    # 事件总线可观测性 —— 以 DEBUG 级别记录每个事件
    def _log_event(event: str, **kw: object) -> None:
        logger.debug("[EVENT] %s %s", event, kw)

    for ev in (Events.RUN_CREATED, Events.AGENT_CONFIG_CHANGED, Events.KEY_CREATED, Events.KEY_DELETED):
        bus.on(ev, _log_event)

    # 周期性 GC
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

    # 周期性清理可观测性事件（按保留期）
    _retention_days = int(_env("OBSERVABILITY_RETENTION_DAYS", "30"))

    async def _periodic_retention() -> None:
        from observability.store import get_store

        while True:
            try:
                await asyncio.sleep(3600)  # 每小时运行一次
                store = get_store()
                deleted = store.cleanup(retention_days=_retention_days)
                if deleted > 0:
                    logger.info(
                        "[RETENTION] cleaned up %d observability events older than %d days",
                        deleted,
                        _retention_days,
                    )
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Observability retention cleanup failed, continuing...")

    app.state.retention_task = asyncio.create_task(_periodic_retention())

    # 数据库 + Redis
    try:
        await _init_database()
        await _check_redis()
    except Exception as exc:
        record_crash(exc)
        raise

    # 预热 run 管线（惰性导入 + checkpointer 建表 + 图编译），
    # 避免重启后首次请求出现约 10s 冷启动。尽力而为：预热失败不得阻塞服务。
    try:
        await _prewarm_pipeline()
    except Exception:
        logger.exception("[LIFECYCLE] pipeline prewarm failed — first run will pay cold-start cost")

    mark_started()


async def shutdown(app: FastAPI) -> None:
    """应用关闭时执行 —— 取消 GC + 保留期清理，写入停止标记。"""
    for attr in ("gc_task", "retention_task"):
        task = getattr(app.state, attr, None)
        if isinstance(task, asyncio.Task):
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError, asyncio.TimeoutError):
                await asyncio.wait_for(task, timeout=5)
    # 取消进行中的后台密钥连通性刷新
    pending = getattr(app.state, "pending_key_tasks", None)
    if pending:
        for task in list(pending):
            task.cancel()
        for task in list(pending):
            with contextlib.suppress(asyncio.CancelledError, asyncio.TimeoutError):
                await asyncio.wait_for(task, timeout=3)
    from observability.store import get_store

    get_store().close()
    from core.infra.database import dispose_engine

    dispose_engine()
    await close_redis()
    mark_stopped()
    logger.info("[LIFECYCLE] shutting down — app=%s | pid=%d", app.title, os.getpid())
