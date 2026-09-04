"""PostgreSQL 支撑的可观测性事件存储（可选后端）。

通过 ``OBSERVABILITY_BACKEND=postgres`` 选择；缺省为 SQLite。与 SQLite 存储
（见 ``store.py``）共享相同的查询契约，使调用方（router/analyzer）与后端解耦。

设计说明：
- 写入被入队到后台线程，该线程驱动自己的 asyncio 事件循环（asyncpg 仅支持
  异步）——日志处理器的同步 ``write()`` 绝不阻塞 I/O，与 SQLite 存储的队列
  语义一致。
- 查询每次调用开启一个短生命周期连接池；结果返回纯 dict，形状与 SQLite 存储一致。
"""

import asyncio
import os
import queue
import threading
import time
from typing import Any

from observability.schema import Event
from observability.store_protocol import EventStoreProtocol

logger = None  # 惰性设置以避免模块加载时的循环导入


def _log() -> Any:
    global logger
    if logger is None:
        from core.infra.logging_config import get_logger

        logger = get_logger(__name__)
    return logger


# PG 后端必须显式配置（OBSERVABILITY_PG_DSN）；回退到 DATABASE_URL 不安全，
# 因为在测试或其他嵌入场景中它可能是 SQLite DSN。默认指向项目本地 PG 实例。
_OBSERVABILITY_PG_DSN = os.environ.get(
    "OBSERVABILITY_PG_DSN",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/backend",
)

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS observability_events (
    id BIGSERIAL PRIMARY KEY,
    timestamp DOUBLE PRECISION NOT NULL,
    trace_id TEXT NOT NULL,
    span_id TEXT NOT NULL DEFAULT '',
    parent_span_id TEXT NOT NULL DEFAULT '',
    level TEXT NOT NULL,
    logger TEXT NOT NULL,
    message TEXT NOT NULL,
    error_type TEXT NOT NULL DEFAULT '',
    error_stack TEXT NOT NULL DEFAULT '',
    duration_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '{}',
    event_type TEXT NOT NULL DEFAULT 'log'
);
CREATE INDEX IF NOT EXISTS idx_obs_events_ts ON observability_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_obs_events_trace ON observability_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_obs_events_level ON observability_events(level);
CREATE INDEX IF NOT EXISTS idx_obs_events_error ON observability_events(error_type) WHERE error_type != '';
"""


def _dsn_for_asyncpg(dsn: str) -> str:
    """将 SQLAlchemy 风格的 DSN 规范化为 asyncpg 可连接的格式。

    对非 PostgreSQL 协议抛出 ValueError，使配置错误的后端 fail-loud 而非静默连不上。
    """
    if dsn.startswith("postgresql+asyncpg://"):
        return dsn.replace("postgresql+asyncpg://", "postgresql://", 1)
    if dsn.startswith(("postgresql://", "postgres://")):
        return dsn
    raise ValueError(f"OBSERVABILITY_PG_DSN must be a PostgreSQL DSN, got: {dsn[:40]}")


class PgEventStore(EventStoreProtocol):
    """PostgreSQL 支撑的线程安全、非阻塞事件存储。

    写入被卸载到运行 asyncio 循环的后台线程，使同步日志处理器绝不阻塞 PG I/O。
    """

    def __init__(self, dsn: str = _OBSERVABILITY_PG_DSN) -> None:
        self._dsn = _dsn_for_asyncpg(dsn)
        self._queue: queue.SimpleQueue[dict[str, Any]] = queue.SimpleQueue()
        self._closed = False
        self._write_errors = 0
        self._last_heartbeat = 0.0

        # 确保 schema 存在（尽力而为；可观测性不得破坏启动）。
        try:
            asyncio.run(self._init_schema())
        except Exception:
            _log().warning("PG observability schema init failed — store will retry writes", exc_info=True)

        self._loop = asyncio.new_event_loop()
        self._writer = threading.Thread(
            target=_run_loop, args=(self._loop, self._drain), daemon=True
        )
        self._writer.start()

    async def _init_schema(self) -> None:
        import asyncpg

        conn = await asyncpg.connect(self._dsn)
        try:
            await conn.execute(_SCHEMA_SQL)
        finally:
            await conn.close()

    async def _drain(self) -> None:
        """在后台循环中排空队列并批量插入 PG。"""
        import asyncpg

        while True:
            try:
                conn = await asyncpg.connect(self._dsn)
                try:
                    while True:
                        rows = []
                        while not self._queue.empty():
                            rows.append(self._queue.get_nowait())
                        if rows:
                            await conn.executemany(
                                """INSERT INTO observability_events
                                   (timestamp,trace_id,span_id,parent_span_id,level,logger,
                                    message,error_type,error_stack,duration_ms,tags,event_type)
                                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)""",
                                [
                                    (
                                        r["timestamp"], r["trace_id"], r["span_id"],
                                        r["parent_span_id"], r["level"], r["logger"],
                                        r["message"], r["error_type"], r["error_stack"],
                                        r["duration_ms"], r["tags"], r["event_type"],
                                    )
                                    for r in rows
                                ],
                            )
                            self._last_heartbeat = time.time()
                        # 让出事件循环——阻塞的 get() 会卡住所有
                        # run_coroutine_threadsafe() 调用方（如 cleanup()）。
                        await asyncio.sleep(0.05)
                finally:
                    await conn.close()
            except Exception:
                self._write_errors += 1
                await asyncio.sleep(0.2)

    def write(self, event: Event) -> None:
        """将事件入队以进行后台持久化。"""
        if self._closed:
            self._write_errors += 1
            return
        try:
            self._queue.put(event.to_row(), block=False)
        except queue.Full:
            self._write_errors += 1

    def self_check(self) -> dict[str, Any]:
        """返回内部健康指标（队列大小、错误、writer 状态）。

        契约与 SQLite 存储一致：健康路由读取 ``disk_errors``——PG 恒为 0
        （无本地磁盘保护）。
        """
        return {
            "queue_size": self._queue.qsize(),
            "write_errors": self._write_errors,
            "disk_errors": 0,
            "writer_alive": self._writer.is_alive(),
            "closed": self._closed,
            "last_heartbeat": self._last_heartbeat,
            "db_path": self._dsn,
        }

    def _query(self, sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
        """同步执行只读查询并以 dict 列表返回结果。

        查询失败返回 []——可观测性绝不破坏它所服务的 API。
        """
        try:
            return asyncio.run(self._query_async(sql, params or []))
        except Exception:
            _log().warning("PG observability query failed", exc_info=True)
            return []

    async def _query_async(self, sql: str, params: list[Any]) -> list[dict[str, Any]]:
        import asyncpg

        conn = await asyncpg.connect(self._dsn)
        try:
            rows = await conn.fetch(sql, *params)
            return [dict(r) for r in rows]
        finally:
            await conn.close()

    def by_trace(self, trace_id: str, limit: int = 200) -> list[dict[str, Any]]:
        return self._query(
            "SELECT * FROM observability_events WHERE trace_id=$1 ORDER BY timestamp ASC LIMIT $2",
            [trace_id, limit],
        )

    def recent_errors(self, seconds: int = 300, limit: int = 50) -> list[dict[str, Any]]:
        cutoff = time.time() - seconds
        return self._query(
            """SELECT * FROM observability_events
               WHERE timestamp >= $1 AND error_type != ''
               ORDER BY timestamp DESC LIMIT $2""",
            [cutoff, limit],
        )

    def slow_events(self, min_ms: float = 1000, seconds: int = 3600, limit: int = 50) -> list[dict[str, Any]]:
        cutoff = time.time() - seconds
        return self._query(
            """SELECT * FROM observability_events
               WHERE timestamp >= $1 AND duration_ms >= $2
               ORDER BY duration_ms DESC LIMIT $3""",
            [cutoff, min_ms, limit],
        )

    def search(self, query: str, limit: int = 50) -> list[dict[str, Any]]:
        like = f"%{query}%"
        return self._query(
            """SELECT * FROM observability_events
               WHERE message LIKE $1 OR error_type LIKE $2 OR logger LIKE $3 OR trace_id LIKE $4
               ORDER BY timestamp DESC LIMIT $5""",
            [like, like, like, like, limit],
        )

    def recent(self, seconds: int = 300, limit: int = 50) -> list[dict[str, Any]]:
        cutoff = time.time() - seconds
        return self._query(
            """SELECT * FROM observability_events
               WHERE timestamp >= $1
               ORDER BY timestamp DESC LIMIT $2""",
            [cutoff, limit],
        )

    def count(self) -> int:
        rows = self._query("SELECT COUNT(*) as cnt FROM observability_events")
        return rows[0]["cnt"] if rows else 0

    def stats(self, seconds: int = 300) -> dict[str, Any]:
        cutoff = time.time() - seconds
        data = self._query(
            "SELECT level, COUNT(*) as cnt FROM observability_events WHERE timestamp >= $1 GROUP BY level",
            [cutoff],
        )
        by_level = {r["level"]: r["cnt"] for r in data}
        error_rows = self._query(
            "SELECT COUNT(*) as cnt FROM observability_events WHERE timestamp >= $1 AND error_type != ''",
            [cutoff],
        )
        error_count = error_rows[0]["cnt"] if error_rows else 0
        return {"window_seconds": seconds, "by_level": by_level, "errors": error_count}

    def error_trace_ids(self, seconds: int = 300, limit: int = 20) -> list[dict[str, Any]]:
        cutoff = time.time() - seconds
        # PG（不同于 SQLite）要求每个非聚合 SELECT 列都出现在 GROUP BY 中——
        # 通过对 MAX(timestamp) 自连接选取每个 trace 的最新事件，
        # 而非简单的 GROUP BY trace_id。
        return self._query(
            """SELECT e.trace_id, e.error_type, e.message, e.timestamp
               FROM observability_events e
               JOIN (
                   SELECT trace_id, MAX(timestamp) AS ts
                   FROM observability_events
                   WHERE timestamp >= $1 AND error_type != ''
                   GROUP BY trace_id
               ) latest ON latest.trace_id = e.trace_id AND latest.ts = e.timestamp
               ORDER BY e.timestamp DESC
               LIMIT $2""",
            [cutoff, limit],
        )

    def cleanup(self, retention_days: int = 30) -> int:
        if retention_days <= 0:
            return 0
        cutoff = time.time() - retention_days * 86400
        # 在后台循环上调度——若保留策略在应用自身事件循环内触发时，
        # 此处调用 asyncio.run() 会抛出"cannot be called from a running event loop"
        # （见 app_lifespan._periodic_retention）。
        try:
            fut = asyncio.run_coroutine_threadsafe(
                self._cleanup_async(cutoff), self._loop
            )
            return fut.result(timeout=30)
        except Exception:
            _log().warning("PG observability cleanup failed", exc_info=True)
            return -1

    async def _cleanup_async(self, cutoff: float) -> int:
        import asyncpg

        conn = await asyncpg.connect(self._dsn)
        try:
            status = await conn.execute(
                "DELETE FROM observability_events WHERE timestamp < $1", cutoff
            )
            # asyncpg 对 DELETE 语句返回 "DELETE <n>"。
            try:
                return int(status.split()[-1])
            except (ValueError, IndexError):
                return 0
        finally:
            await conn.close()

    def close(self) -> None:
        """将存储标记为已关闭，拒绝后续写入。"""
        self._closed = True


def _run_loop(loop: asyncio.AbstractEventLoop, drain: Any) -> None:
    """运行后台事件循环，承载 drain 协程。
    drain 任务在其被设为当前循环后、于该循环自身线程内创建——若从构造器线程
    用 ``run_coroutine_threadsafe`` 调度，会与 ``run_forever`` 启动竞争，
    可能导致任务整个丢失。
    """
    asyncio.set_event_loop(loop)
    loop.create_task(drain())
    loop.run_forever()


def _backend_enabled() -> bool:
    """当选中可选 PG 可观测性后端时返回 True。"""
    return os.environ.get("OBSERVABILITY_BACKEND", "sqlite").lower() == "postgres"
