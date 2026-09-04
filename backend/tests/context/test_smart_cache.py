"""SmartCache 单元测试"""

import time

import pytest

from context.smart_cache import CacheEntry, SmartCache


class TestCacheEntry:
    def test_no_ttl_never_expires(self) -> None:
        e = CacheEntry(key="k", value="v", created_at=0.0, last_accessed=0.0, ttl=None)
        assert e.is_expired() is False

    def test_expired(self) -> None:
        e = CacheEntry(key="k", value="v", created_at=time.time() - 100, last_accessed=0.0, ttl=1.0)
        assert e.is_expired() is True

    def test_not_expired(self) -> None:
        e = CacheEntry(key="k", value="v", created_at=time.time(), last_accessed=0.0, ttl=100.0)
        assert e.is_expired() is False

    def test_touch(self) -> None:
        e = CacheEntry(key="k", value="v", created_at=0.0, last_accessed=0.0, access_count=0)
        e.touch()
        assert e.access_count == 1
        assert e.last_accessed > 0


class TestMakeKey:
    def test_string(self) -> None:
        c = SmartCache()
        assert c._make_key("hello") == c._make_key("hello")

    def test_dict(self) -> None:
        c = SmartCache()
        assert c._make_key({"a": 1}) == c._make_key({"a": 1})

    def test_list(self) -> None:
        c = SmartCache()
        assert c._make_key([1, 2]) == c._make_key([1, 2])

    def test_int(self) -> None:
        c = SmartCache()
        k = c._make_key(42)
        assert isinstance(k, str)


class TestEstimateTokens:
    def test_string(self) -> None:
        c = SmartCache()
        assert c._estimate_tokens("a" * 20) == 5

    def test_dict(self) -> None:
        c = SmartCache()
        assert c._estimate_tokens({"key": "value"}) >= 1

    def test_other(self) -> None:
        c = SmartCache()
        assert c._estimate_tokens(42) == 10


class TestSetAndGet:
    def test_hit(self) -> None:
        c = SmartCache()
        c.set("k", "v")
        assert c.get("k") == "v"
        assert c.hits == 1

    def test_miss(self) -> None:
        c = SmartCache()
        assert c.get("missing") is None
        assert c.misses == 1

    def test_expired_miss(self) -> None:
        c = SmartCache()
        c.set("k", "v", ttl=0.001)
        time.sleep(0.01)
        assert c.get("k") is None
        assert c.misses == 1

    def test_update_existing(self) -> None:
        c = SmartCache()
        c.set("k", "old")
        c.set("k", "new")
        assert c.get("k") == "new"
        assert len(c._cache) == 1


class TestDelete:
    def test_delete_existing(self) -> None:
        c = SmartCache()
        c.set("k", "v")
        assert c.delete("k") is True
        assert c.get("k") is None

    def test_delete_missing(self) -> None:
        c = SmartCache()
        assert c.delete("k") is False


class TestEviction:
    def test_lru_eviction(self) -> None:
        c = SmartCache(max_size=2)
        c.set("a", 1)
        c.set("b", 2)
        c.set("c", 3)  # evicts "a"
        assert c.get("a") is None
        assert c.evictions == 1

    def test_token_eviction(self) -> None:
        c = SmartCache(max_tokens=20)
        c.set("a", "x" * 40)  # ~10 tokens
        c.set("b", "y" * 40)  # ~10 tokens
        c.set("c", "z" * 40)  # triggers eviction
        assert c.evictions >= 1


class TestCleanupExpired:
    def test_cleanup(self) -> None:
        c = SmartCache()
        c.set("a", 1, ttl=0.001)
        c.set("b", 2, ttl=100)
        time.sleep(0.01)
        removed = c.cleanup_expired()
        assert removed == 1
        assert c.get("a") is None
        assert c.get("b") == 2


class TestClear:
    def test_clear(self) -> None:
        c = SmartCache()
        c.set("a", 1)
        c.set("b", 2)
        c.clear()
        assert c.get("a") is None
        assert c._current_tokens == 0


class TestGetStats:
    def test_stats(self) -> None:
        c = SmartCache()
        c.set("a", 1)
        c.get("a")
        c.get("missing")
        stats = c.get_stats()
        assert stats["size"] == 1
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["hit_rate"] == 0.5

    def test_empty_stats(self) -> None:
        c = SmartCache()
        stats = c.get_stats()
        assert stats["hit_rate"] == 0.0


class TestGetOrCompute:
    def test_cache_hit(self) -> None:
        c = SmartCache()
        c.set("k", "cached")
        result = c.get_or_compute("k", lambda: "computed")
        assert result == "cached"

    def test_cache_miss_computes(self) -> None:
        c = SmartCache()
        result = c.get_or_compute("k", lambda: "computed")
        assert result == "computed"
        assert c.get("k") == "computed"

    def test_custom_ttl(self) -> None:
        c = SmartCache()
        c.get_or_compute("k", lambda: "v", ttl=0.001)
        time.sleep(0.01)
        assert c.get("k") is None


class TestRemoveEntry:
    def test_remove_nonexistent(self) -> None:
        c = SmartCache()
        c._remove_entry("nope")  # should not raise
