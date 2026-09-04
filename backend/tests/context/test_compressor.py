"""Tests for context/compressor.py."""

import os

import pytest

os.environ.setdefault("AUTH_MODE", "legacy")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("KEY_VAULT_SECRET", "0123456789abcdef0123456789abcdef")
os.environ.setdefault("AUTH_ENABLED", "0")
os.environ.setdefault("RATE_LIMIT", "9999")
os.environ.setdefault("CHECKPOINTER_BACKEND", "memory")
os.environ.setdefault("DATABASE_POOL_SIZE", "0")

from unittest.mock import AsyncMock, MagicMock

from context.compressor import (
    CompressionResult,
    CompressionStrategy,
    ContextCompressor,
)


# ---------------------------------------------------------------------------
# CompressionStrategy enum
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestCompressionStrategy:
    def test_values(self):
        assert CompressionStrategy.SUMMARY.value == "summary"
        assert CompressionStrategy.TRUNCATE.value == "truncate"
        assert CompressionStrategy.DEDUPLICATE.value == "deduplicate"
        assert CompressionStrategy.EXTRACT_KEY.value == "extract_key"
        assert CompressionStrategy.CHUNK.value == "chunk"


# ---------------------------------------------------------------------------
# CompressionResult dataclass
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestCompressionResult:
    def test_creation(self):
        r = CompressionResult(
            compressed_content="hello",
            original_tokens=100,
            compressed_tokens=50,
            compression_ratio=0.5,
            strategy_used=CompressionStrategy.TRUNCATE,
        )
        assert r.compressed_content == "hello"
        assert r.compression_ratio == 0.5
        assert r.metadata is None

    def test_with_metadata(self):
        r = CompressionResult(
            compressed_content="x",
            original_tokens=10,
            compressed_tokens=5,
            compression_ratio=0.5,
            strategy_used=CompressionStrategy.EXTRACT_KEY,
            metadata={"extracted_sentences": 3},
        )
        assert r.metadata is not None
        assert r.metadata.get("extracted_sentences") == 3


# ---------------------------------------------------------------------------
# ContextCompressor init
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestContextCompressorInit:
    def test_defaults(self):
        c = ContextCompressor()
        assert c.max_tokens == 4000
        assert c.target_compression_ratio == 0.5
        assert c.enable_deduplication is True
        assert c.enable_summarization is True

    def test_custom(self):
        c = ContextCompressor(max_tokens=2000, enable_deduplication=False)
        assert c.max_tokens == 2000
        assert c.enable_deduplication is False


# ---------------------------------------------------------------------------
# estimate_tokens
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestEstimateTokens:
    def test_empty(self):
        c = ContextCompressor()
        assert c.estimate_tokens("") == 0

    def test_pure_english(self):
        c = ContextCompressor()
        # "hello" = 5 chars → 5/4 ≈ 1.25 → max(1, 1) = 1
        assert c.estimate_tokens("hello") == 1

    def test_pure_chinese(self):
        c = ContextCompressor()
        # "你好世界" = 4 Chinese chars → 4/1.5 ≈ 2.67 → 2
        assert c.estimate_tokens("你好世界") == 2

    def test_mixed(self):
        c = ContextCompressor()
        tokens = c.estimate_tokens("hello你好")
        assert tokens >= 1

    def test_long_text(self):
        c = ContextCompressor()
        text = "a" * 1000
        tokens = c.estimate_tokens(text)
        assert tokens == 250  # 1000/4


# ---------------------------------------------------------------------------
# deduplicate_messages
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestDeduplicateMessages:
    def test_no_duplicates(self):
        c = ContextCompressor()
        msgs = [
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi"},
        ]
        result = c.deduplicate_messages(msgs)
        assert len(result) == 2

    def test_removes_duplicates(self):
        c = ContextCompressor()
        msgs = [
            {"role": "user", "content": "hello"},
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi"},
        ]
        result = c.deduplicate_messages(msgs)
        assert len(result) == 2

    def test_same_content_different_role_not_deduped(self):
        c = ContextCompressor()
        msgs = [
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hello"},
        ]
        result = c.deduplicate_messages(msgs)
        assert len(result) == 2

    def test_dedup_disabled(self):
        c = ContextCompressor(enable_deduplication=False)
        msgs = [
            {"role": "user", "content": "hello"},
            {"role": "user", "content": "hello"},
        ]
        result = c.deduplicate_messages(msgs)
        assert len(result) == 2

    def test_empty_list(self):
        c = ContextCompressor()
        assert c.deduplicate_messages([]) == []

    def test_missing_content_key(self):
        c = ContextCompressor()
        msgs = [{"role": "user"}, {"role": "user"}]
        result = c.deduplicate_messages(msgs)
        # Both have empty content → same hash → deduped to 1
        assert len(result) == 1


# ---------------------------------------------------------------------------
# truncate_content
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestTruncateContent:
    def test_short_content_unchanged(self):
        c = ContextCompressor()
        assert c.truncate_content("short", 100) == "short"

    def test_long_content_truncated(self):
        c = ContextCompressor()
        text = "a" * 2000
        result = c.truncate_content(text, 1000)
        assert len(result) < 2000
        assert "[truncated]" in result

    def test_exact_length_unchanged(self):
        c = ContextCompressor()
        text = "x" * 100
        assert c.truncate_content(text, 100) == text


# ---------------------------------------------------------------------------
# extract_key_sentences
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestExtractKeySentences:
    def test_empty(self):
        c = ContextCompressor()
        assert c.extract_key_sentences("") == []

    def test_single_sentence(self):
        c = ContextCompressor()
        result = c.extract_key_sentences("Hello world.")
        assert len(result) == 1
        assert "Hello world." in result[0]

    def test_keywords_boost_score(self):
        c = ContextCompressor()
        text = "This is important. The weather is nice today."
        result = c.extract_key_sentences(text, max_sentences=2)
        # "This is important." should rank higher due to keyword
        assert any("important" in s for s in result)

    def test_numbers_boost_score(self):
        c = ContextCompressor()
        text = "There are 42 items. The color is blue."
        result = c.extract_key_sentences(text, max_sentences=2)
        assert any("42" in s for s in result)

    def test_max_sentences_limit(self):
        c = ContextCompressor()
        text = "First sentence. Second sentence. Third sentence. Fourth sentence."
        result = c.extract_key_sentences(text, max_sentences=2)
        assert len(result) <= 2

    def test_chinese_keywords(self):
        c = ContextCompressor()
        text = "这是重要的信息。天气很好。"
        result = c.extract_key_sentences(text, max_sentences=2)
        assert any("重要" in s for s in result)


# ---------------------------------------------------------------------------
# compress — TRUNCATE strategy
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestCompressTruncate:
    async def test_short_string(self):
        c = ContextCompressor()
        result = await c.compress("hello", strategy=CompressionStrategy.TRUNCATE)
        assert isinstance(result, CompressionResult)
        assert result.compressed_content == "hello"
        assert result.strategy_used == CompressionStrategy.TRUNCATE

    async def test_long_string(self):
        c = ContextCompressor(max_tokens=100)
        text = "word " * 5000
        result = await c.compress(text, strategy=CompressionStrategy.TRUNCATE)
        assert "[truncated]" in result.compressed_content
        assert result.compression_ratio <= 1.0

    async def test_empty_string(self):
        c = ContextCompressor()
        result = await c.compress("", strategy=CompressionStrategy.TRUNCATE)
        assert result.compressed_content == ""

    async def test_message_list(self):
        c = ContextCompressor()
        msgs = [
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi there"},
        ]
        result = await c.compress(msgs, strategy=CompressionStrategy.TRUNCATE)
        assert "user: hello" in result.compressed_content
        assert "assistant: hi there" in result.compressed_content


# ---------------------------------------------------------------------------
# compress — DEDUPLICATE strategy
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestCompressDeduplicate:
    async def test_string_dedup_lines(self):
        c = ContextCompressor()
        text = "line1\nline1\nline2"
        result = await c.compress(text, strategy=CompressionStrategy.DEDUPLICATE)
        assert result.compressed_content.count("line1") == 1

    async def test_message_list_dedup(self):
        c = ContextCompressor()
        msgs = [
            {"role": "user", "content": "dup"},
            {"role": "user", "content": "dup"},
            {"role": "assistant", "content": "ok"},
        ]
        result = await c.compress(msgs, strategy=CompressionStrategy.DEDUPLICATE)
        assert result.compressed_content.count("user: dup") == 1


# ---------------------------------------------------------------------------
# compress — EXTRACT_KEY strategy
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestCompressExtractKey:
    async def test_extracts_sentences(self):
        c = ContextCompressor()
        text = "This is important. The sun is hot. Critical information here."
        result = await c.compress(text, strategy=CompressionStrategy.EXTRACT_KEY)
        assert result.metadata is not None
        assert result.metadata is not None  # guaranteed by EXTRACT_KEY
        assert result.metadata.get("extracted_sentences", 0) >= 1

    async def test_empty_string(self):
        c = ContextCompressor()
        result = await c.compress("", strategy=CompressionStrategy.EXTRACT_KEY)
        assert result.compressed_content == ""


# ---------------------------------------------------------------------------
# compress — SUMMARY strategy
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestCompressSummary:
    async def test_no_llm_falls_back_to_truncate(self):
        c = ContextCompressor()
        result = await c.compress("hello", strategy=CompressionStrategy.SUMMARY, llm=None)
        assert result.metadata is not None
        assert result.metadata.get("summarized") is False

    async def test_llm_called(self):
        mock_llm = AsyncMock()
        mock_response = MagicMock()
        mock_response.content = "summarized text"
        mock_llm.ainvoke.return_value = mock_response

        c = ContextCompressor()
        result = await c.compress("some content", strategy=CompressionStrategy.SUMMARY, llm=mock_llm)
        assert result.metadata is not None
        assert result.metadata.get("summarized") is True
        assert result.compressed_content == "summarized text"
        mock_llm.ainvoke.assert_called_once()

    async def test_llm_exception_falls_back(self):
        mock_llm = AsyncMock()
        mock_llm.ainvoke.side_effect = RuntimeError("llm error")

        c = ContextCompressor()
        result = await c.compress("content here", strategy=CompressionStrategy.SUMMARY, llm=mock_llm)
        assert result.metadata is not None
        assert result.metadata.get("summarized") is False


# ---------------------------------------------------------------------------
# compress — CHUNK strategy
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestCompressChunk:
    async def test_short_content_unchanged(self):
        c = ContextCompressor(max_tokens=1000)
        result = await c.compress("short", strategy=CompressionStrategy.CHUNK)
        assert result.compressed_content == "short"

    async def test_long_content_chunked(self):
        c = ContextCompressor(max_tokens=10)
        text = "word. " * 200
        result = await c.compress(text, strategy=CompressionStrategy.CHUNK)
        assert "middle chunks omitted" in result.compressed_content
        assert result.metadata is not None
        assert result.metadata.get("total_chunks", 0) > 2


# ---------------------------------------------------------------------------
# _split_into_chunks
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestSplitIntoChunks:
    def test_single_chunk(self):
        c = ContextCompressor()
        chunks = c._split_into_chunks("short", 1000)
        assert len(chunks) == 1
        assert chunks[0] == "short"

    def test_multiple_chunks(self):
        c = ContextCompressor()
        text = "a" * 100
        chunks = c._split_into_chunks(text, 30)
        assert len(chunks) > 1
        assert "".join(chunks) == text


# ---------------------------------------------------------------------------
# compress_workflow_state
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestCompressWorkflowState:
    async def test_compresses_long_messages(self):
        c = ContextCompressor()
        messages = [{"role": "user", "content": f"msg {i}"} for i in range(20)]
        state = {"messages": messages}
        result = await c.compress_workflow_state(state, max_total_tokens=100)
        # Should have system summary + recent messages
        assert "messages" in result
        assert len(result["messages"]) < 20

    async def test_compresses_large_context_string(self):
        c = ContextCompressor()
        state = {"context": "x" * 20000}
        result = await c.compress_workflow_state(state, max_total_tokens=100)
        assert len(result["context"]) < 20000

    async def test_no_compression_needed(self):
        c = ContextCompressor()
        state = {"messages": [{"role": "user", "content": "hi"}]}
        result = await c.compress_workflow_state(state)
        assert result["messages"] == [{"role": "user", "content": "hi"}]

    async def test_preserves_other_keys(self):
        c = ContextCompressor()
        state = {"foo": "bar", "messages": [{"role": "user", "content": "hi"}]}
        result = await c.compress_workflow_state(state)
        assert result["foo"] == "bar"

    async def test_compresses_requirement_key(self):
        c = ContextCompressor()
        state = {"requirement": "y" * 20000}
        result = await c.compress_workflow_state(state, max_total_tokens=100)
        assert len(result["requirement"]) < 20000
