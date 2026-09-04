"""ResponseCache 单元测试"""

import pytest

from context.response_cache import ResponseCache, clear_all_caches, get_response_cache


class TestNormalizePrompt:
    def test_lowercase_and_strip(self) -> None:
        c = ResponseCache()
        assert c._normalize_prompt("  Hello World  ") == "hello world"

    def test_extra_whitespace(self) -> None:
        c = ResponseCache()
        assert c._normalize_prompt("hello   world") == "hello world"


class TestSimpleSimilarity:
    def test_identical(self) -> None:
        c = ResponseCache()
        assert c._simple_similarity("a b c", "a b c") == 1.0

    def test_disjoint(self) -> None:
        c = ResponseCache()
        assert c._simple_similarity("a b", "c d") == 0.0

    def test_partial(self) -> None:
        c = ResponseCache()
        sim = c._simple_similarity("a b c", "b c d")
        assert 0.0 < sim < 1.0

    def test_empty(self) -> None:
        c = ResponseCache()
        assert c._simple_similarity("", "hello") == 0.0
        assert c._simple_similarity("hello", "") == 0.0


class TestGetAndCacheResponse:
    def test_direct_hit(self) -> None:
        c = ResponseCache()
        c.cache_response("hello", "world")
        assert c.get_response("hello") == "world"

    def test_miss(self) -> None:
        c = ResponseCache()
        assert c.get_response("nothing") is None

    def test_with_model(self) -> None:
        c = ResponseCache(similarity_threshold=1.0)
        c.cache_response("hello", "world", model="gpt4")
        assert c.get_response("hello", model="gpt4") == "world"
        assert c.get_response("hello", model="other") is None

    def test_similar_prompt_hit(self) -> None:
        c = ResponseCache(similarity_threshold=0.5)
        c.cache_response("the quick brown fox", "answer1")
        # Very similar prompt should get cached response
        result = c.get_response("the quick brown fox jumps")
        assert result == "answer1"

    def test_dissimilar_no_hit(self) -> None:
        c = ResponseCache(similarity_threshold=0.99)
        c.cache_response("completely different topic", "answer1")
        assert c.get_response("totally unrelated text") is None


class TestGetStats:
    def test_stats(self) -> None:
        c = ResponseCache()
        c.cache_response("q", "a")
        c.get_response("q")
        stats = c.get_stats()
        assert stats["hits"] >= 1


class TestGlobalFunctions:
    def test_get_response_cache(self) -> None:
        c = get_response_cache()
        assert isinstance(c, ResponseCache)

    def test_clear_all_caches(self) -> None:
        c = get_response_cache()
        c.cache_response("test_clear", "value")
        clear_all_caches()
        assert c.get_response("test_clear") is None
