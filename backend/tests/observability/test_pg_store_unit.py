"""PgEventStore 单元测试 — mock asyncpg，不依赖真实 PG"""

import queue
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from observability.pg_store import PgEventStore


class TestWrite:
    def test_write_success(self) -> None:
        with patch.object(PgEventStore, "__init__", lambda self, **kw: None):
            store = PgEventStore()
        store._dsn = "postgresql://u:p@localhost/db"
        store._queue = MagicMock()
        store._closed = False
        store._write_errors = 0

        event = MagicMock()
        event.to_row.return_value = {"trace_id": "t1"}
        store.write(event)
        store._queue.put.assert_called_once()

    def test_write_closed(self) -> None:
        with patch.object(PgEventStore, "__init__", lambda self, **kw: None):
            store = PgEventStore()
        store._closed = True
        store._write_errors = 0
        store._queue = MagicMock()

        event = MagicMock()
        store.write(event)
        assert store._write_errors == 1
        store._queue.put.assert_not_called()

    def test_write_queue_full(self) -> None:
        with patch.object(PgEventStore, "__init__", lambda self, **kw: None):
            store = PgEventStore()
        store._closed = False
        store._write_errors = 0
        store._queue = MagicMock()
        store._queue.put.side_effect = queue.Full

        event = MagicMock()
        event.to_row.return_value = {}
        store.write(event)
        assert store._write_errors == 1


class TestSelfCheck:
    def test_keys(self) -> None:
        with patch.object(PgEventStore, "__init__", lambda self, **kw: None):
            store = PgEventStore()
        store._queue = MagicMock()
        store._queue.qsize.return_value = 0
        store._closed = False
        store._write_errors = 0
        store._last_heartbeat = 0.0
        store._writer = MagicMock()
        store._writer.is_alive.return_value = True
        store._dsn = "postgresql://u:p@localhost/db"

        result = store.self_check()
        assert "queue_size" in result
        assert "write_errors" in result
        assert "disk_errors" in result
        assert "writer_alive" in result
        assert "closed" in result
        assert "last_heartbeat" in result
        assert "db_path" in result
        assert result["disk_errors"] == 0


class TestClose:
    def test_sets_closed(self) -> None:
        with patch.object(PgEventStore, "__init__", lambda self, **kw: None):
            store = PgEventStore()
        store._closed = False
        store.close()
        assert store._closed is True


def _make_store() -> PgEventStore:
    with patch.object(PgEventStore, "__init__", lambda self, **kw: None):
        store = PgEventStore()
    store._dsn = "postgresql://u:p@localhost/db"
    store._queue = MagicMock()
    store._queue.qsize.return_value = 0
    store._closed = False
    store._write_errors = 0
    store._last_heartbeat = 0.0
    store._loop = MagicMock()
    store._writer = MagicMock()
    store._writer.is_alive.return_value = True
    return store


class TestQuery:
    def test_query_success(self) -> None:
        store = _make_store()
        mock_result = [{"level": "INFO", "cnt": 5}]
        with patch.object(store, "_query_async", new_callable=AsyncMock, return_value=mock_result):
            result = store._query("SELECT ...")
            assert result == mock_result

    def test_query_exception_returns_empty(self) -> None:
        store = _make_store()
        with patch.object(store, "_query_async", new_callable=AsyncMock, side_effect=RuntimeError("fail")):
            result = store._query("SELECT ...")
            assert result == []


class TestByTrace:
    def test_delegates_to_query(self) -> None:
        store = _make_store()
        with patch.object(store, "_query", return_value=[{"trace_id": "t1"}]):
            result = store.by_trace("t1", limit=10)
            assert len(result) == 1


class TestRecentErrors:
    def test_delegates_to_query(self) -> None:
        store = _make_store()
        with patch.object(store, "_query", return_value=[{"error_type": "ERR"}]):
            result = store.recent_errors(seconds=60)
            assert len(result) == 1


class TestSlowEvents:
    def test_delegates_to_query(self) -> None:
        store = _make_store()
        with patch.object(store, "_query", return_value=[{"duration_ms": 2000}]):
            result = store.slow_events(min_ms=1000)
            assert len(result) == 1


class TestSearch:
    def test_delegates_to_query(self) -> None:
        store = _make_store()
        with patch.object(store, "_query", return_value=[{"message": "found"}]):
            result = store.search("found")
            assert len(result) == 1


class TestRecent:
    def test_delegates_to_query(self) -> None:
        store = _make_store()
        with patch.object(store, "_query", return_value=[{"ts": 1.0}]):
            result = store.recent(seconds=300)
            assert len(result) == 1


class TestCount:
    def test_returns_count(self) -> None:
        store = _make_store()
        with patch.object(store, "_query", return_value=[{"cnt": 42}]):
            assert store.count() == 42

    def test_empty_returns_zero(self) -> None:
        store = _make_store()
        with patch.object(store, "_query", return_value=[]):
            assert store.count() == 0


class TestStats:
    def test_returns_stats(self) -> None:
        store = _make_store()
        with patch.object(store, "_query", side_effect=[
            [{"level": "INFO", "cnt": 10}],
            [{"cnt": 3}],
        ]):
            result = store.stats(seconds=60)
            assert result["by_level"]["INFO"] == 10
            assert result["errors"] == 3

    def test_empty_stats(self) -> None:
        store = _make_store()
        with patch.object(store, "_query", return_value=[]):
            result = store.stats()
            assert result["by_level"] == {}
            assert result["errors"] == 0


class TestErrorTraceIds:
    def test_delegates_to_query(self) -> None:
        store = _make_store()
        with patch.object(store, "_query", return_value=[{"trace_id": "t1"}]):
            result = store.error_trace_ids(seconds=60)
            assert len(result) == 1


class TestCleanup:
    def test_cleanup_success(self) -> None:
        store = _make_store()
        future = MagicMock()
        future.result.return_value = 5
        with patch("observability.pg_store.asyncio.run_coroutine_threadsafe", return_value=future):
            result = store.cleanup(retention_days=30)
            assert result == 5

    def test_cleanup_failure(self) -> None:
        store = _make_store()
        with patch("observability.pg_store.asyncio.run_coroutine_threadsafe", side_effect=RuntimeError("fail")):
            result = store.cleanup(retention_days=30)
            assert result == -1

    def test_cleanup_zero_retention(self) -> None:
        store = _make_store()
        result = store.cleanup(retention_days=0)
        assert result == 0
