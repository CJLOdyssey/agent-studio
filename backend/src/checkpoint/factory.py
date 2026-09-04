"""Checkpointer 工厂 —— 创建相应的后端 checkpointer。

支持的后端：
- ``memory``  — 内存（无持久化，用于测试 / CI）
- ``sqlite``  — 本地 SQLite 文件（默认）
- ``postgres`` — 通过 ``langgraph-checkpoint-postgres`` 使用 PostgreSQL
"""

import os
from typing import Any

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver

from core.infra.logging_config import get_logger

logger = get_logger(__name__)


def _resolve_backend(backend: str | None, dsn: str | None) -> tuple[str, str | None]:
    if backend is None:
        backend = os.environ.get("CHECKPOINTER_BACKEND", "sqlite")
    if dsn is None:
        dsn = os.environ.get("CHECKPOINTER_DSN")
    return backend, dsn


async def _create_checkpointer_async(backend: str, dsn: str | None) -> BaseCheckpointSaver[Any]:
    """根据后端配置创建 checkpointer。

    内部函数 —— 供两个入口共享的异步逻辑。
    """
    if backend == "postgres":
        if not dsn:
            raise ValueError("CHECKPOINTER_DSN is required for postgres backend")
        logger.info("Creating AsyncPostgresSaver checkpointer")
        try:
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        except ImportError as exc:
            raise ImportError(
                "Postgres checkpointer requires `langgraph-checkpoint-postgres` extra"
            ) from exc

        from psycopg import AsyncConnection
        from psycopg.rows import DictRow, dict_row

        conn = await AsyncConnection[DictRow].connect(
            dsn,
            autocommit=True,
            prepare_threshold=0,
            row_factory=dict_row,
        )
        saver = AsyncPostgresSaver(conn)
        await saver.setup()
        # 保留对底层连接的引用，使 close_checkpointer() 能释放它 —— 此前每次 run 都泄漏一个物理 PG 连接。
        setattr(saver, "_ckpt_conn", conn)  # noqa: B010 — BaseCheckpointSaver 上的动态属性
        return saver

    if backend == "sqlite":
        if not dsn:
            dsn = "checkpoints.db"
        logger.info("Creating AsyncSqliteSaver checkpointer (dsn=%s)", dsn)
        try:
            import aiosqlite
            from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
        except ImportError as exc:
            raise ImportError(
                "SQLite checkpointer requires `langgraph-checkpoint-sqlite` extra "
                "and `aiosqlite` package"
            ) from exc

        aconn = await aiosqlite.connect(dsn)
        sqlite_saver = AsyncSqliteSaver(aconn)
        setattr(sqlite_saver, "_ckpt_conn", aconn)  # noqa: B010 — BaseCheckpointSaver 上的动态属性
        return sqlite_saver

    logger.info("Creating MemorySaver checkpointer (in-memory, no persistence)")
    return MemorySaver()


def create_checkpointer(
    backend: str | None = None,
    dsn: str | None = None,
) -> BaseCheckpointSaver[Any]:
    """创建 checkpointer（同步封装 —— 适用于 CLI / 测试）。

    无参调用时从环境读取 ``CHECKPOINTER_BACKEND`` 与 ``CHECKPOINTER_DSN``，默认 SQLite。

    异步上下文（Celery worker、FastAPI lifespan）请改用 ``create_checkpointer_async``。
    """
    import asyncio
    import concurrent.futures

    backend, dsn = _resolve_backend(backend, dsn)
    logger.info("Creating checkpointer for backend=%s", backend)

    if backend == "memory":
        return MemorySaver()

    # 无循环在运行时，可安全调用 asyncio.run()。
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(_create_checkpointer_async(backend, dsn))

    # 已在运行中的循环内 —— 在另一线程的全新循环中运行。
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as _pool:
        return _pool.submit(asyncio.run, _create_checkpointer_async(backend, dsn)).result()


async def create_checkpointer_async(
    backend: str | None = None,
    dsn: str | None = None,
) -> BaseCheckpointSaver[Any]:
    """异步 checkpointer 工厂 —— 可在运行中的循环内安全 await。

    Celery 任务与其他异步上下文中优先于 ``create_checkpointer``，
    因为它避免了跨线程边界带来的开销与边界情况。
    """
    backend, dsn = _resolve_backend(backend, dsn)
    return await _create_checkpointer_async(backend, dsn)


async def close_checkpointer(saver: BaseCheckpointSaver[Any]) -> None:
    """若存在，关闭 checkpointer 的底层连接。

    管线每次 run 创建全新 checkpointer（LangGraph 图按 run 编译）；没有本函数，
    底层 psycopg/aiosqlite 连接会泄漏。``MemorySaver`` 无连接 —— 对其为空操作。
    """
    conn = getattr(saver, "_ckpt_conn", None)
    close = getattr(conn, "close", None) if conn is not None else None
    if close is None:
        return
    try:
        await close()
    except Exception:
        logger.debug("checkpointer close failed", exc_info=True)
