"""PostgreSQL-backed observability event store (optional backend).

Selected via ``OBSERVABILITY_BACKEND=postgres``; defaults to SQLite. Shares
the same query contract as the SQLite store (see ``store.py``) so callers
(router/analyzer) stay backend-agnostic.

Design notes:
- Writes are enqueued to a background thread that drives its own asyncio
  loop (asyncpg is async-only) — the logging handler's sync ``write()``
  never blocks on I/O, mirroring the SQLite store's queue semantics.
- Queries open a short-lived connection pool per call; results are plain
  dicts, identical shape to the SQLite store.
"""

import asyncio
import json
import os
import queue
import threading
import time
from typing import Any

from observability.schema import Event

logger = None  # set lazily to avoid import cycle at module load


def _log() -> Any:
    global logger
    if logger is None:
        from core.infra.logging_config import get_logger

        logger = get_logger(__name__)
    return logger


# PG backend must be configured explicitly (OBSERVABILITY_PG_DSN); falling
# back to DATABASE_URL is unsafe because that may be a SQLite DSN in tests or
# other embedders. Default targets the project's local PG instance.
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
    """Normalize a SQLAlchemy-style DSN to one asyncpg can connect to.

    Raises ValueError for non-PostgreSQL schemes so a misconfigured backend
    fails loudly instead of silently connecting nowhere.
    """
    if dsn.startswith("postgresql+asyncpg://"):
        return dsn.replace("postgresql+asyncpg://", "postgresql://", 1)
    if dsn.startswith(("postgresql://", "postgres://")):
        return dsn
    raise ValueError(f"OBSERVABILITY_PG_DSN must be a PostgreSQL DSN, got: {dsn[:40]}")


class PgEventStore:
    """Thread-safe, non-blocking event store backed by PostgreSQL.

    Writes are offloaded to a background thread running an asyncio loop so
    the sync logging handler never blocks on PG I/O.
    """

    def __init__(self, dsn: str = _OBSERVABILITY_PG_DSN) -> None:
        self._dsn = _dsn_for_asyncpg(dsn)
        self._queue: queue.SimpleQueue[dict[str, Any]] = queue.SimpleQueue()
        self._closed = False
        self._write_errors = 0
        self._last_heartbeat = 0.0

        # Ensure schema exists (best-effort; observability must not break boot).
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
        """Drain the queue and batch-insert into PG inside the background loop."""
        import asyncpg

        while True:
            try:
                conn = await asyncpg.connect(self._dsn)
                try:
                    while True:
                        rows = []
                        rows.append(self._queue.get())
                        while not self._queue.empty() and len(rows) < 100:
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
                finally:
                    await conn.close()
            except Exception:
                self._write_errors += 1
                await asyncio.sleep(0.2)

    def write(self, event: Event) -> None:
        """Enqueue an event for background persistence."""
        if self._closed:
            self._write_errors += 1
            return
        try:
            self._queue.put(event.to_row(), block=False)
        except queue.Full:
            self._write_errors += 1

    def self_check(self) -> dict[str, Any]:
        """Return internal health metrics (queue size, errors, writer status)."""
        return {
            "queue_size": self._queue.qsize(),
            "write_errors": self._write_errors,
            "writer_alive": self._writer.is_alive(),
            "closed": self._closed,
            "last_heartbeat": self._last_heartbeat,
            "db_path": self._dsn,
        }

    def _query(self, sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
        """Run a read-only query and return results as dicts (synchronously).

        Query failures return [] — observability must never break the API it
        serves.
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
        return self._query(
            """SELECT trace_id, error_type, message, timestamp
               FROM observability_events
               WHERE timestamp >= $1 AND error_type != ''
               GROUP BY trace_id
               ORDER BY MAX(timestamp) DESC
               LIMIT $2""",
            [cutoff, limit],
        )

    def cleanup(self, retention_days: int = 30) -> int:
        if retention_days <= 0:
            return 0
        cutoff = time.time() - retention_days * 86400
        try:
            return asyncio.run(self._cleanup_async(cutoff))
        except Exception:
            return -1

    async def _cleanup_async(self, cutoff: float) -> int:
        import asyncpg

        conn = await asyncpg.connect(self._dsn)
        try:
            status = await conn.execute(
                "DELETE FROM observability_events WHERE timestamp < $1", cutoff
            )
            # asyncpg returns "DELETE <n>" for DELETE statements.
            try:
                return int(status.split()[-1])
            except (ValueError, IndexError):
                return 0
        finally:
            await conn.close()

    def close(self) -> None:
        """Mark the store as closed, rejecting future writes."""
        self._closed = True


def _run_loop(loop: asyncio.AbstractEventLoop, drain: Any) -> None:
    """Run the background event loop, hosting the drain coroutine.

    The drain task is created inside the loop's own thread after it is set as
    the current loop — scheduling it from the constructor thread with
    ``run_coroutine_threadsafe`` races ``run_forever`` startup and can drop
    the task entirely.
    """
    asyncio.set_event_loop(loop)
    loop.create_task(drain())
    loop.run_forever()


def _backend_enabled() -> bool:
    """True when the optional PG observability backend is selected."""
    return os.environ.get("OBSERVABILITY_BACKEND", "sqlite").lower() == "postgres"
