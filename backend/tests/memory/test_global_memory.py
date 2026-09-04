"""GlobalMemoryEntry / GlobalMemoryStore 单元测试"""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from memory.global_memory import GlobalMemoryEntry, GlobalMemoryStore, get_global_memory_store


class TestGlobalMemoryEntry:
    def test_to_dict(self) -> None:
        entry = GlobalMemoryEntry(
            id="1", user_id="u", key="k", value="v",
            confidence=0.9, source_sessions=["s1"],
            created_at=1.0, last_accessed=2.0, access_count=3,
            decay_rate=0.05, metadata={"m": 1},
        )
        d = entry.to_dict()
        assert d["id"] == "1"
        assert d["confidence"] == 0.9
        assert d["source_sessions"] == ["s1"]

    def test_from_dict(self) -> None:
        data = {
            "id": "1", "user_id": "u", "key": "k", "value": "v",
            "confidence": 0.8, "source_sessions": [],
            "created_at": 0.0, "last_accessed": 0.0,
            "access_count": 0, "decay_rate": 0.01, "metadata": {},
        }
        entry = GlobalMemoryEntry.from_dict(data)
        assert entry.id == "1"
        assert entry.confidence == 0.8


class TestGetGlobalMemoryStore:
    def test_singleton(self) -> None:
        import memory.global_memory as mod
        mod._global_memory_store = None
        s1 = get_global_memory_store()
        s2 = get_global_memory_store()
        assert s1 is s2
        mod._global_memory_store = None


class TestGlobalMemoryStoreDBToEntry:
    def test_conversion(self) -> None:
        store = GlobalMemoryStore()
        db_obj = MagicMock()
        db_obj.id = "id1"
        db_obj.user_id = "u1"
        db_obj.key = "k1"
        db_obj.value = '{"a": 1}'
        db_obj.confidence = 0.95
        db_obj.source_sessions = ["s1"]
        db_obj.created_at = 100.0
        db_obj.last_accessed = 200.0
        db_obj.access_count = 5
        db_obj.decay_rate = 0.02
        db_obj.metadata_json = {"meta": True}

        entry = store._db_to_entry(db_obj)
        assert entry.id == "id1"
        assert entry.value == {"a": 1}
        assert entry.confidence == 0.95
        assert entry.metadata == {"meta": True}

    def test_none_value(self) -> None:
        store = GlobalMemoryStore()
        db_obj = MagicMock()
        db_obj.value = None
        db_obj.source_sessions = None
        db_obj.metadata_json = None
        entry = store._db_to_entry(db_obj)
        assert entry.value is None
        assert entry.source_sessions == []
        assert entry.metadata == {}


def _make_mock_session(execute_result: MagicMock | None = None, scalar_result: MagicMock | None = None, rowcount: int = 0) -> AsyncMock:
    """Helper to build a properly mocked async session with context manager."""
    mock_session = AsyncMock()
    if execute_result is not None:
        mock_execute_result = execute_result
    else:
        mock_execute_result = MagicMock()
    mock_execute_result.scalar_one_or_none.return_value = scalar_result
    mock_execute_result.rowcount = rowcount
    mock_session.execute = AsyncMock(return_value=mock_execute_result)
    return mock_session


def _make_mock_factory(mock_session: AsyncMock) -> MagicMock:
    """Return a factory callable that yields mock_session as async context manager."""
    mock_cm = AsyncMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
    mock_cm.__aexit__ = AsyncMock(return_value=False)
    factory = MagicMock(return_value=mock_cm)
    return factory


@pytest.mark.asyncio
class TestStore:
    async def test_new_entry(self) -> None:
        store = GlobalMemoryStore()
        mock_session = _make_mock_session(scalar_result=None)

        with patch("memory.global_memory.get_session_factory", return_value=_make_mock_factory(mock_session)):
            entry = await store.store("u1", "key1", "value1", "s1", confidence=0.9)
            assert entry.user_id == "u1"
            assert entry.key == "key1"
            mock_session.add.assert_called_once()
            mock_session.commit.assert_awaited()

    async def test_update_existing(self) -> None:
        store = GlobalMemoryStore()
        mock_existing = MagicMock()
        mock_existing.value = "old"
        mock_existing.confidence = 0.5
        mock_existing.source_sessions = ["s1"]
        mock_existing.metadata_json = {"old": True}

        mock_session = _make_mock_session(scalar_result=mock_existing)

        with patch("memory.global_memory.get_session_factory", return_value=_make_mock_factory(mock_session)):
            entry = await store.store("u1", "key1", "new_val", "s2", confidence=0.8, metadata={"new": True})
            assert mock_existing.confidence == 0.8
            assert "s2" in mock_existing.source_sessions
            assert mock_existing.metadata_json == {"old": True, "new": True}


@pytest.mark.asyncio
class TestDelete:
    async def test_delete_found(self) -> None:
        store = GlobalMemoryStore()
        mock_session = _make_mock_session(rowcount=1)

        with patch("memory.global_memory.get_session_factory", return_value=_make_mock_factory(mock_session)):
            assert await store.delete("u1", "key1") is True

    async def test_delete_not_found(self) -> None:
        store = GlobalMemoryStore()
        mock_session = _make_mock_session(rowcount=0)

        with patch("memory.global_memory.get_session_factory", return_value=_make_mock_factory(mock_session)):
            assert await store.delete("u1", "key1") is False


@pytest.mark.asyncio
class TestResolveConflicts:
    async def test_empty_returns_none(self) -> None:
        store = GlobalMemoryStore()
        with patch.object(store, "retrieve", new_callable=AsyncMock, return_value=[]):
            assert await store.resolve_conflicts("u1", "k") is None

    async def test_latest_strategy(self) -> None:
        store = GlobalMemoryStore()
        e1 = GlobalMemoryEntry(id="1", key="k", last_accessed=100, confidence=0.9)
        e2 = GlobalMemoryEntry(id="2", key="k", last_accessed=200, confidence=0.8)
        with patch.object(store, "retrieve", new_callable=AsyncMock, return_value=[e1, e2]):
            with patch.object(store, "delete", new_callable=AsyncMock, return_value=True):
                winner = await store.resolve_conflicts("u1", "k", strategy="latest")
                assert winner is not None
                assert winner.id == "2"

    async def test_highest_confidence_strategy(self) -> None:
        store = GlobalMemoryStore()
        e1 = GlobalMemoryEntry(id="1", key="k", last_accessed=100, confidence=0.6)
        e2 = GlobalMemoryEntry(id="2", key="k", last_accessed=200, confidence=0.95)
        with patch.object(store, "retrieve", new_callable=AsyncMock, return_value=[e1, e2]):
            with patch.object(store, "delete", new_callable=AsyncMock, return_value=True):
                winner = await store.resolve_conflicts("u1", "k", strategy="highest_confidence")
                assert winner.id == "2"

    async def test_merge_strategy(self) -> None:
        store = GlobalMemoryStore()
        e1 = GlobalMemoryEntry(id="1", key="k", value={"a": 1}, confidence=0.8)
        e2 = GlobalMemoryEntry(id="2", key="k", value={"b": 2}, confidence=0.6)
        with patch.object(store, "retrieve", new_callable=AsyncMock, return_value=[e1, e2]):
            with patch.object(store, "delete", new_callable=AsyncMock, return_value=True):
                winner = await store.resolve_conflicts("u1", "k", strategy="merge")
                assert winner.value == {"a": 1, "b": 2}

    async def test_unknown_strategy(self) -> None:
        store = GlobalMemoryStore()
        e1 = GlobalMemoryEntry(id="1", key="k")
        with patch.object(store, "retrieve", new_callable=AsyncMock, return_value=[e1]):
            with patch.object(store, "delete", new_callable=AsyncMock, return_value=True):
                winner = await store.resolve_conflicts("u1", "k", strategy="unknown")
                assert winner.id == "1"


@pytest.mark.asyncio
class TestCleanupExpired:
    async def test_cleanup(self) -> None:
        store = GlobalMemoryStore()
        mock_session = _make_mock_session(rowcount=3)

        with patch("memory.global_memory.get_session_factory", return_value=_make_mock_factory(mock_session)):
            count = await store.cleanup_expired(max_age_days=90)
            assert count == 3
