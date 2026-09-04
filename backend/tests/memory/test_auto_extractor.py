"""Tests for memory/auto_extractor.py — MemoryExtractor, HeuristicMemoryExtractor."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from memory.auto_extractor import (
    HeuristicMemoryExtractor,
    MemoryExtractor,
    get_heuristic_extractor,
    get_memory_extractor,
)


# ---------------------------------------------------------------------------
# MemoryExtractor (LLM-based)
# ---------------------------------------------------------------------------


class TestMemoryExtractorInit:
    def test_init_defaults(self):
        ext = MemoryExtractor()
        assert ext.llm is None
        assert ext.min_confidence == 0.6

    def test_init_with_custom_values(self):
        mock_llm = MagicMock()
        ext = MemoryExtractor(llm=mock_llm, min_confidence=0.8)
        assert ext.llm is mock_llm
        assert ext.min_confidence == 0.8


class TestExtractFromConversation:
    @pytest.mark.asyncio
    async def test_no_llm_returns_empty(self):
        ext = MemoryExtractor(llm=None)
        result = await ext.extract_from_conversation([], "u1", "s1")
        assert result == []

    @pytest.mark.asyncio
    async def test_short_conversation_skipped(self):
        mock_llm = AsyncMock()
        ext = MemoryExtractor(llm=mock_llm, min_confidence=0.0)
        from langchain_core.messages import HumanMessage

        messages = [HumanMessage(content="Hi")]
        result = await ext.extract_from_conversation(messages, "u1", "s1")
        assert result == []
        mock_llm.ainvoke.assert_not_called()

    @pytest.mark.asyncio
    async def test_successful_extraction(self):
        mock_llm = AsyncMock()
        mock_response = MagicMock()
        mock_response.content = '[{"key": "preference:lang", "value": "Python", "confidence": 0.9, "category": "preference"}]'
        mock_llm.ainvoke.return_value = mock_response

        ext = MemoryExtractor(llm=mock_llm, min_confidence=0.5)
        from langchain_core.messages import HumanMessage

        long_text = "This is a long conversation " * 10
        messages = [HumanMessage(content=long_text)]
        result = await ext.extract_from_conversation(messages, "u1", "s1")

        assert len(result) == 1
        assert result[0]["user_id"] == "u1"
        assert result[0]["session_id"] == "s1"
        assert result[0]["key"] == "preference:lang"

    @pytest.mark.asyncio
    async def test_low_confidence_filtered(self):
        mock_llm = AsyncMock()
        mock_response = MagicMock()
        mock_response.content = '[{"key": "x", "value": "y", "confidence": 0.1, "category": "fact"}]'
        mock_llm.ainvoke.return_value = mock_response

        ext = MemoryExtractor(llm=mock_llm, min_confidence=0.6)
        from langchain_core.messages import HumanMessage

        messages = [HumanMessage(content="A conversation that is long enough " * 10)]
        result = await ext.extract_from_conversation(messages, "u1", "s1")
        assert result == []

    @pytest.mark.asyncio
    async def test_llm_exception_returns_empty(self):
        mock_llm = AsyncMock()
        mock_llm.ainvoke.side_effect = Exception("LLM down")
        ext = MemoryExtractor(llm=mock_llm)
        from langchain_core.messages import HumanMessage

        messages = [HumanMessage(content="A conversation that is long enough " * 10)]
        result = await ext.extract_from_conversation(messages, "u1", "s1")
        assert result == []

    @pytest.mark.asyncio
    async def test_non_string_content_handled(self):
        mock_llm = AsyncMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="some content")]
        mock_llm.ainvoke.return_value = mock_response

        ext = MemoryExtractor(llm=mock_llm, min_confidence=0.0)
        from langchain_core.messages import HumanMessage

        messages = [HumanMessage(content="A conversation that is long enough " * 10)]
        result = await ext.extract_from_conversation(messages, "u1", "s1")
        # Non-string content gets str() which won't parse as JSON → empty
        assert result == []


class TestFormatMessages:
    def test_human_vs_assistant_role(self):
        from langchain_core.messages import AIMessage, HumanMessage

        ext = MemoryExtractor()
        msgs = [HumanMessage(content="hello"), AIMessage(content="hi")]
        result = ext._format_messages(msgs)
        assert "用户: hello" in result
        assert "助手: hi" in result

    def test_last_20_messages_only(self):
        from langchain_core.messages import HumanMessage

        ext = MemoryExtractor()
        msgs = [HumanMessage(content=f"msg_{i}") for i in range(30)]
        result = ext._format_messages(msgs)
        assert "msg_0" not in result
        assert "msg_10" in result
        assert "msg_29" in result


class TestParseJsonResponse:
    def test_valid_json_array(self):
        ext = MemoryExtractor()
        result = ext._parse_json_response('[{"key": "k", "value": "v"}]')
        assert len(result) == 1
        assert result[0]["key"] == "k"

    def test_json_embedded_in_text(self):
        ext = MemoryExtractor()
        result = ext._parse_json_response('Here is the result: [{"key": "k"}] done')
        assert len(result) == 1

    def test_invalid_json_returns_empty(self):
        ext = MemoryExtractor()
        result = ext._parse_json_response("not json at all")
        assert result == []

    def test_non_list_json_returns_empty(self):
        ext = MemoryExtractor()
        result = ext._parse_json_response('{"key": "value"}')
        assert result == []

    def test_malformed_json_in_array_returns_empty(self):
        ext = MemoryExtractor()
        result = ext._parse_json_response("prefix [{broken}] suffix")
        assert result == []


# ---------------------------------------------------------------------------
# HeuristicMemoryExtractor
# ---------------------------------------------------------------------------


class TestHeuristicMemoryExtractor:
    def test_extract_language_preference(self):
        ext = HeuristicMemoryExtractor()
        result = ext.extract("我喜欢用Python回答问题", "u1", "s1")
        assert len(result) >= 1
        assert any(r["key"] == "preference:language" for r in result)

    def test_extract_style_preference(self):
        ext = HeuristicMemoryExtractor()
        result = ext.extract("我喜欢简洁的回答风格", "u1", "s1")
        assert any(r["key"] == "preference:style" for r in result)

    def test_extract_occupation(self):
        ext = HeuristicMemoryExtractor()
        result = ext.extract("我是Python工程师", "u1", "s1")
        assert any(r["key"] == "fact:occupation" for r in result)

    def test_extract_multiple_matches(self):
        ext = HeuristicMemoryExtractor()
        result = ext.extract(
            "我是前端设计师 喜欢用TypeScript回答", "u1", "s1"
        )
        keys = {r["key"] for r in result}
        assert "fact:occupation" in keys
        assert "preference:language" in keys

    def test_no_matches(self):
        ext = HeuristicMemoryExtractor()
        result = ext.extract("Hello world", "u1", "s1")
        assert result == []

    def test_metadata_attached(self):
        ext = HeuristicMemoryExtractor()
        result = ext.extract("我喜欢用Go", "u1", "s1")
        assert result[0]["user_id"] == "u1"
        assert result[0]["session_id"] == "s1"
        assert result[0]["confidence"] == 0.7

    def test_style_variants(self):
        ext = HeuristicMemoryExtractor()
        for phrase in [
            "喜欢详细一点回答",
            "简洁回答",
            "请用正式回答",
            "随意一点回复",
        ]:
            result = ext.extract(phrase, "u1", "s1")
            assert len(result) >= 1, f"Failed to match: {phrase}"


# ---------------------------------------------------------------------------
# Singleton functions
# ---------------------------------------------------------------------------


class TestSingletons:
    def test_get_memory_extractor_singleton(self):
        ext1 = get_memory_extractor()
        ext2 = get_memory_extractor()
        assert ext1 is ext2

    def test_get_heuristic_extractor_singleton(self):
        ext1 = get_heuristic_extractor()
        ext2 = get_heuristic_extractor()
        assert ext1 is ext2

    def test_get_memory_extractor_with_llm(self):
        # Reset global singleton for this test
        import memory.auto_extractor as mod

        mod._extractor = None
        mock_llm = MagicMock()
        ext = get_memory_extractor(llm=mock_llm)
        assert ext.llm is mock_llm
        # Subsequent call returns same instance
        ext2 = get_memory_extractor(llm=None)
        assert ext2 is ext
        mod._extractor = None  # cleanup
