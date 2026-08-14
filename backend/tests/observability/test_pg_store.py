"""Tests for the optional PostgreSQL observability backend (observability/pg_store.py).

Integration tests hit the local agent-studio-db (postgres:postgres@localhost:
5432/backend) and skip when it is unreachable; unit tests cover DSN
normalization and the backend selector without a live DB.
"""

import time
from unittest.mock import patch

import pytest

from observability.pg_store import PgEventStore, _backend_enabled, _dsn_for_asyncpg
from observability.schema import Event

PG_DSN = "postgresql://postgres:postgres@localhost:5432/backend"


def _pg_available() -> bool:
    try:
        import asyncio

        import asyncpg

        async def _probe() -> bool:
            try:
                conn = await asyncpg.connect(PG_DSN, timeout=3)
                await conn.close()
                return True
            except Exception:
                return False

        return asyncio.run(_probe())
    except Exception:
        return False


PG_UP = _pg_available()


class TestDsnNormalization:
    def test_asyncpg_prefix_stripped(self):
        assert _dsn_for_asyncpg("postgresql+asyncpg://u:p@h:5432/db") == "postgresql://u:p@h:5432/db"

    def test_plain_pg_dsn_unchanged(self):
        assert _dsn_for_asyncpg("postgresql://u:p@h:5432/db") == "postgresql://u:p@h:5432/db"

    def test_non_pg_scheme_rejected(self):
        with pytest.raises(ValueError, match="PostgreSQL"):
            _dsn_for_asyncpg("sqlite+aiosqlite:///:memory:")


class TestBackendSelector:
    def test_default_is_sqlite(self, monkeypatch):
        monkeypatch.delenv("OBSERVABILITY_BACKEND", raising=False)
        assert _backend_enabled() is False

    def test_postgres_enabled(self, monkeypatch):
        monkeypatch.setenv("OBSERVABILITY_BACKEND", "postgres")
        assert _backend_enabled() is True

    def test_get_store_switches_backend(self, monkeypatch):
        monkeypatch.setenv("OBSERVABILITY_BACKEND", "postgres")
        import observability.store as store_mod

        store_mod._store = None
        with patch("observability.pg_store.asyncio.run"), \
             patch("observability.pg_store.asyncio.new_event_loop"):
            store = store_mod.get_store()
        assert isinstance(store, PgEventStore)
        store_mod._store = None  # reset singleton for other tests


@pytest.mark.skipif(not PG_UP, reason="PostgreSQL not reachable")
class TestPgEventStoreIntegration:
    @pytest.fixture
    def store(self):
        s = PgEventStore(dsn=PG_DSN)
        # Clean any leftover rows from previous runs.
        s._query("DELETE FROM observability_events WHERE trace_id LIKE 'pgtest-%'")
        yield s
        s._query("DELETE FROM observability_events WHERE trace_id LIKE 'pgtest-%'")
        s.close()

    def test_write_and_query(self, store):
        evt = Event(
            trace_id="pgtest-1", level="INFO", message="pg write",
            logger="test", timestamp=time.time(),
        )
        store.write(evt)
        # Give the background drain thread a moment to flush.
        deadline = time.time() + 5
        rows = []
        while time.time() < deadline:
            rows = store.by_trace("pgtest-1")
            if rows:
                break
            time.sleep(0.2)
        assert len(rows) == 1
        assert rows[0]["message"] == "pg write"

    def test_stats_counts_levels(self, store):
        now = time.time()
        for lvl in ("INFO", "ERROR"):
            store.write(Event(trace_id="pgtest-stats", level=lvl, message=f"{lvl} msg", logger="t", timestamp=now))
        deadline = time.time() + 5
        stats = {}
        while time.time() < deadline:
            stats = store.stats(seconds=600)
            if stats["by_level"].get("INFO") and stats["by_level"].get("ERROR"):
                break
            time.sleep(0.2)
        assert stats["by_level"].get("INFO", 0) >= 1
        assert stats["by_level"].get("ERROR", 0) >= 1

    def test_recent_errors_filters(self, store):
        now = time.time()
        store.write(Event(trace_id="pgtest-err", level="ERROR", message="boom", logger="t",
                          timestamp=now, error_type="RuntimeError"))
        store.write(Event(trace_id="pgtest-ok", level="INFO", message="fine", logger="t", timestamp=now))
        deadline = time.time() + 5
        errs = []
        while time.time() < deadline:
            errs = store.recent_errors(seconds=600, limit=50)
            if any(r["trace_id"] == "pgtest-err" for r in errs):
                break
            time.sleep(0.2)
        trace_ids = [r["trace_id"] for r in errs]
        assert "pgtest-err" in trace_ids
        assert "pgtest-ok" not in trace_ids

    def test_cleanup_deletes_old(self, store):
        store.write(Event(trace_id="pgtest-old", level="INFO", message="old", logger="t",
                          timestamp=time.time() - 90000))
        # Newer row must survive.
        store.write(Event(trace_id="pgtest-new", level="INFO", message="new", logger="t", timestamp=time.time()))
        deadline = time.time() + 5
        while time.time() < deadline:
            if store.by_trace("pgtest-new"):
                break
            time.sleep(0.2)
        deleted = store.cleanup(retention_days=1)
        assert deleted >= 1
        assert store.by_trace("pgtest-old") == []
        assert len(store.by_trace("pgtest-new")) == 1

    def test_self_check_has_disk_errors_key(self, store):
        """Health router reads self_check['disk_errors'] — contract must match SQLite store."""
        check = store.self_check()
        assert "disk_errors" in check
        assert check["disk_errors"] == 0

    def test_error_trace_ids_returns_latest_per_trace(self, store):
        """PG requires non-aggregated SELECT columns in GROUP BY — the rewritten
        self-join must return the latest error event per trace, not fail."""
        now = time.time()
        store.write(Event(trace_id="pgtest-err2", level="ERROR", message="first", logger="t",
                          timestamp=now - 10, error_type="ValueError"))
        store.write(Event(trace_id="pgtest-err2", level="ERROR", message="latest", logger="t",
                          timestamp=now, error_type="ValueError"))
        store.write(Event(trace_id="pgtest-ok2", level="INFO", message="fine", logger="t", timestamp=now))
        deadline = time.time() + 5
        rows = []
        while time.time() < deadline:
            rows = store.error_trace_ids(seconds=600, limit=20)
            if any(r["trace_id"] == "pgtest-err2" for r in rows):
                break
            time.sleep(0.2)
        err2 = [r for r in rows if r["trace_id"] == "pgtest-err2"]
        assert len(err2) == 1
        assert err2[0]["message"] == "latest"
        assert not any(r["trace_id"] == "pgtest-ok2" for r in rows)
