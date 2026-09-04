"""EventStore——向 SQLite 写入并查询可观测性事件。

高内聚：单一职责——持久化与检索事件。
低耦合：调用方传入 Event 对象，绝不接触 SQL。
"""

import os
import queue
import shutil
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

from observability.schema import SCHEMA_SQL, Event
from observability.store_protocol import EventStoreProtocol

_DB_PATH = os.environ.get("OBSERVABILITY_DB", str(Path(__file__).parent / "events.db"))

# 写入被拒绝前所需的最小磁盘剩余空间（字节）。
_DISK_MIN_FREE = int(os.environ.get("OBSERVABILITY_MIN_DISK_MB", "100")) * 1024 * 1024


class EventStore(EventStoreProtocol):
    """SQLite（WAL 模式）支撑的线程安全、非阻塞事件存储。

    写入经队列卸载到后台线程，使调用方（含同步日志处理器）绝不阻塞 I/O。
    """

    def __init__(self, db_path: str = _DB_PATH) -> None:
        self._db_path = db_path
        self._queue: queue.SimpleQueue[dict[str, Any]] = queue.SimpleQueue()
        self._closed = False
        self._write_errors: int = 0
        self._disk_errors: int = 0
        self._last_heartbeat: float = 0.0

        conn = sqlite3.connect(db_path, timeout=5)
        conn.executescript(SCHEMA_SQL)
        conn.close()

        self._writer = threading.Thread(target=_writer_loop, args=(db_path, self._queue), daemon=True)
        self._writer.start()

    def _disk_free(self) -> float:
        """返回磁盘剩余空间（字节），失败返回 -1。"""
        try:
            usage = shutil.disk_usage(self._db_path)
            return usage.free
        except OSError:
            return -1.0

    def write(self, event: Event) -> None:
        """将事件入队以进行后台持久化。"""
        if self._closed:
            self._write_errors += 1
            return
        free = self._disk_free()
        if 0 < free < _DISK_MIN_FREE:
            self._disk_errors += 1
            return
        try:
            self._queue.put(event.to_row(), block=False)
            self._last_heartbeat = time.time()
        except queue.Full:
            self._write_errors += 1

    def self_check(self) -> dict[str, Any]:
        """返回内部健康指标（队列大小、错误、磁盘、writer 状态）。"""
        free = self._disk_free()
        return {
            "queue_size": _writer_size(self._queue),
            "write_errors": self._write_errors,
            "disk_errors": self._disk_errors,
            "disk_free_mb": round(free / (1024 * 1024), 1) if free > 0 else free,
            "disk_min_free_mb": _DISK_MIN_FREE // (1024 * 1024),
            "writer_alive": self._writer.is_alive(),
            "closed": self._closed,
            "last_heartbeat": self._last_heartbeat,
            "db_path": self._db_path,
        }

    def _query(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        """执行只读查询并以 dict 列表返回结果。"""
        conn = sqlite3.connect(f"file:{self._db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        try:
            rows = conn.execute(sql, params).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def by_trace(self, trace_id: str, limit: int = 200) -> list[dict[str, Any]]:
        """返回给定 trace ID 的所有事件。"""
        return self._query(
            "SELECT * FROM events WHERE trace_id=? ORDER BY timestamp ASC LIMIT ?",
            (trace_id, limit),
        )

    def recent_errors(self, seconds: int = 300, limit: int = 50) -> list[dict[str, Any]]:
        """返回 error_type 非空的最近事件。"""
        cutoff = time.time() - seconds
        return self._query(
            """SELECT * FROM events
               WHERE timestamp >= ? AND error_type != ''
               ORDER BY timestamp DESC LIMIT ?""",
            (cutoff, limit),
        )

    def slow_events(self, min_ms: float = 1000, seconds: int = 3600, limit: int = 50) -> list[dict[str, Any]]:
        """返回超过最小时长阈值的事件。"""
        cutoff = time.time() - seconds
        return self._query(
            """SELECT * FROM events
               WHERE timestamp >= ? AND duration_ms >= ?
               ORDER BY duration_ms DESC LIMIT ?""",
            (cutoff, min_ms, limit),
        )

    def search(self, query: str, limit: int = 50) -> list[dict[str, Any]]:
        """跨 message、error_type、logger 与 trace_id 的全文搜索。"""
        like = f"%{query}%"
        return self._query(
            """SELECT * FROM events
               WHERE message LIKE ? OR error_type LIKE ? OR logger LIKE ? OR trace_id LIKE ?
               ORDER BY timestamp DESC LIMIT ?""",
            (like, like, like, like, limit),
        )

    def recent(self, seconds: int = 300, limit: int = 50) -> list[dict[str, Any]]:
        """返回时间窗口内的最新事件。"""
        cutoff = time.time() - seconds
        return self._query(
            """SELECT * FROM events
               WHERE timestamp >= ?
               ORDER BY timestamp DESC LIMIT ?""",
            (cutoff, limit),
        )

    def count(self) -> int:
        """返回已存储事件的总数。"""
        rows = self._query("SELECT COUNT(*) as cnt FROM events")
        return rows[0]["cnt"] if rows else 0

    def stats(self, seconds: int = 300) -> dict[str, Any]:
        """返回时间窗口内各级别事件计数与错误总数。"""
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

    def error_trace_ids(self, seconds: int = 300, limit: int = 20) -> list[dict[str, Any]]:
        """返回时间窗口内有错误的去重 trace ID。"""
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
        """将存储标记为已关闭，拒绝后续写入。"""
        self._closed = True

    def cleanup(self, retention_days: int = 30) -> int:
        """删除早于 `retention_days` 的事件并返回行数。

        内联执行（不经过后台 writer 队列），因此绝不与实时写入争抢队列槽位。
        """
        if retention_days <= 0:
            return 0
        cutoff = time.time() - retention_days * 86400
        try:
            conn = sqlite3.connect(self._db_path, timeout=10)
            conn.execute("PRAGMA synchronous=NORMAL")
            try:
                cursor = conn.execute(
                    "DELETE FROM events WHERE timestamp < ?", (cutoff,)
                )
                deleted = cursor.rowcount
                conn.commit()
                return deleted
            finally:
                conn.close()
        except Exception:
            return -1


def _writer_loop(db_path: str, q: "queue.SimpleQueue[dict[str, Any]]") -> None:
    """排空队列并批量插入 SQLite 的后台线程。"""
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


def _writer_size(q: "queue.SimpleQueue[dict[str, Any]]") -> int:
    """返回当前队列大小。"""
    return q.qsize()


# 模块级单例——首次使用时创建。
_store: Any = None


def get_store() -> EventStoreProtocol:
    """返回模块级事件存储单例。

    后端由 ``OBSERVABILITY_BACKEND`` 选择（默认 ``sqlite``；``postgres`` 启用
    可选的 PostgreSQL 存储）。调用方仅使用共享的 ``write``/查询契约，因此后端
    可随时替换。
    """
    global _store
    if _store is None:
        from observability.pg_store import PgEventStore, _backend_enabled

        _store = PgEventStore() if _backend_enabled() else EventStore()
    return _store  # type: ignore[no-any-return]
