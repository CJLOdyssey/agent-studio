"""EventStore — writes and queries observability events to SQLite.

High cohesion: single responsibility — persist and retrieve events.
Low coupling: callers pass Event objects, never touch SQL.
"""

import os
import queue
import sqlite3
import threading
import time
from pathlib import Path

from virtual_team.observability.schema import SCHEMA_SQL, Event

_DB_PATH = os.environ.get("OBSERVABILITY_DB", str(Path(__file__).parent / "events.db"))


class EventStore:
    """Thread-safe, non-blocking event store backed by SQLite (WAL mode).

    Writes are offloaded to a background thread via a queue so the caller
    (including sync logging handlers) never blocks on I/O.
    """

    def __init__(self, db_path: str = _DB_PATH) -> None:
        self._db_path = db_path
        self._queue: queue.SimpleQueue[dict] = queue.SimpleQueue()
        self._closed = False
        self._write_errors: int = 0
        self._last_heartbeat: float = 0.0

        conn = sqlite3.connect(db_path, timeout=5)
        conn.executescript(SCHEMA_SQL)
        conn.close()

        self._writer = threading.Thread(target=_writer_loop, args=(db_path, self._queue), daemon=True)
        self._writer.start()

    def write(self, event: Event) -> None:
        if self._closed:
            self._write_errors += 1
            return
        try:
            self._queue.put(event.to_row(), block=False)
            self._last_heartbeat = time.time()
        except queue.Full:
            self._write_errors += 1

    def self_check(self) -> dict:
        return {
            "queue_size": _writer_size(self._queue),
            "write_errors": self._write_errors,
            "writer_alive": self._writer.is_alive(),
            "closed": self._closed,
            "last_heartbeat": self._last_heartbeat,
            "db_path": self._db_path,
        }

    def _query(self, sql: str, params: tuple = ()) -> list[dict]:
        conn = sqlite3.connect(f"file:{self._db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        try:
            rows = conn.execute(sql, params).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def by_trace(self, trace_id: str, limit: int = 200) -> list[dict]:
        return self._query(
            "SELECT * FROM events WHERE trace_id=? ORDER BY timestamp ASC LIMIT ?",
            (trace_id, limit),
        )

    def recent_errors(self, seconds: int = 300, limit: int = 50) -> list[dict]:
        cutoff = time.time() - seconds
        return self._query(
            """SELECT * FROM events
               WHERE timestamp >= ? AND error_type != ''
               ORDER BY timestamp DESC LIMIT ?""",
            (cutoff, limit),
        )

    def slow_events(self, min_ms: float = 1000, seconds: int = 3600, limit: int = 50) -> list[dict]:
        cutoff = time.time() - seconds
        return self._query(
            """SELECT * FROM events
               WHERE timestamp >= ? AND duration_ms >= ?
               ORDER BY duration_ms DESC LIMIT ?""",
            (cutoff, min_ms, limit),
        )

    def search(self, query: str, limit: int = 50) -> list[dict]:
        like = f"%{query}%"
        return self._query(
            """SELECT * FROM events
               WHERE message LIKE ? OR error_type LIKE ? OR logger LIKE ? OR trace_id LIKE ?
               ORDER BY timestamp DESC LIMIT ?""",
            (like, like, like, like, limit),
        )

    def stats(self, seconds: int = 300) -> dict:
        cutoff = time.time() - seconds
        data = self._query(
            """SELECT level, COUNT(*) as cnt
               FROM events WHERE timestamp >= ?
               GROUP BY level""",
            (cutoff,),
        )
        by_level = {r["level"]: r["cnt"] for r in data}
        error_count = self._query(
            "SELECT COUNT(*) as cnt FROM events WHERE timestamp >= ? AND error_type != ''",
            (cutoff,),
        )[0]["cnt"]
        return {"window_seconds": seconds, "by_level": by_level, "errors": error_count}

    def error_trace_ids(self, seconds: int = 300, limit: int = 20) -> list[dict]:
        cutoff = time.time() - seconds
        return self._query(
            """SELECT trace_id, error_type, message, timestamp
               FROM events
               WHERE timestamp >= ? AND error_type != ''
               GROUP BY trace_id
               ORDER BY MAX(timestamp) DESC
               LIMIT ?""",
            (cutoff, limit),
        )

    def close(self) -> None:
        self._closed = True


def _writer_loop(db_path: str, q: "queue.SimpleQueue[dict]") -> None:
    conn = sqlite3.connect(db_path, timeout=10)
    conn.execute("PRAGMA synchronous=NORMAL")
    try:
        while True:
            rows = []
            rows.append(q.get())
            while not q.empty() and len(rows) < 100:
                rows.append(q.get_nowait())
            if rows:
                conn.executemany(
                    """INSERT INTO events
                       (timestamp,trace_id,span_id,parent_span_id,level,logger,
                        message,error_type,error_stack,duration_ms,tags,event_type)
                       VALUES (:timestamp,:trace_id,:span_id,:parent_span_id,:level,:logger,
                               :message,:error_type,:error_stack,:duration_ms,:tags,:event_type)""",
                    rows,
                )
                conn.commit()
    except Exception:
        pass
    finally:
        conn.close()


def _writer_size(q: "queue.SimpleQueue[dict]") -> int:
    return q.qsize()


# Module-level singleton — created on first use.
_store: EventStore | None = None


def get_store() -> EventStore:
    global _store
    if _store is None:
        _store = EventStore()
    return _store
