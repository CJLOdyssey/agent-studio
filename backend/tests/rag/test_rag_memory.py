"""Tests for P1 session long-term memory (rag/rag_memory.py + pipeline rollup)."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from rag import rag_memory


def _mem(id_: str, summary: str, content_type: str = "code") -> SimpleNamespace:
    return SimpleNamespace(
        id=id_, summary=summary, content_type=content_type,
        agent_role="agent", run_id=f"run-{id_}",
    )


class TestBuildSessionContextWindow:
    """窗口裁剪：只注入最近 N 条（对标 Dify/n8n 窗口）。"""

    @patch("tasks.pipeline_utils.MEMORY_MAX_INJECT", 2)
    def test_trims_oldest_beyond_window(self):
        from tasks.pipeline_utils import _build_session_context
        mems = [_mem("1", "first"), _mem("2", "second"), _mem("3", "third")]
        result = _build_session_context(mems)
        assert "first" not in result
        assert "second" in result and "third" in result

    def test_empty(self):
        from tasks.pipeline_utils import _build_session_context
        assert _build_session_context([]) == ""

    def test_all_within_window(self):
        from tasks.pipeline_utils import _build_session_context
        mems = [_mem("1", "a"), _mem("2", "b")]
        result = _build_session_context(mems)
        assert "a" in result and "b" in result


class TestRollupMemories:
    """滚动总结：超阈值时最旧一半合并为 rollup 条目（对标 Open WebUI review）。"""

    @patch("tasks.pipeline_utils.get_session_memories", new_callable=AsyncMock)
    @patch("tasks.pipeline_utils.create_memory_entry", new_callable=AsyncMock)
    @patch("tasks.pipeline_utils.delete_memory_entry", new_callable=AsyncMock)
    @patch("tasks.pipeline_utils.MEMORY_ROLLUP_THRESHOLD", 4)
    async def test_rolls_up_oldest_half(self, mock_del, mock_create, mock_get):
        from tasks.pipeline_utils import _maybe_rollup_memories
        mems = [_mem(f"{i}", f"entry {i}") for i in range(6)]
        mock_get.return_value = mems
        await _maybe_rollup_memories("sess-1")
        # 6 条 > 阈值 4 → 最旧 3 条合并，创建 1 条 rollup + 删 3 条
        assert mock_create.awaited
        kwargs = mock_create.call_args[1]
        assert kwargs["content_type"] == "rollup"
        assert "entry 0" in kwargs["details"]
        assert mock_del.await_count == 3

    @patch("tasks.pipeline_utils.get_session_memories", new_callable=AsyncMock)
    @patch("tasks.pipeline_utils.create_memory_entry", new_callable=AsyncMock)
    @patch("tasks.pipeline_utils.MEMORY_ROLLUP_THRESHOLD", 10)
    async def test_no_rollup_below_threshold(self, mock_create, mock_get):
        from tasks.pipeline_utils import _maybe_rollup_memories
        mock_get.return_value = [_mem("1", "a"), _mem("2", "b")]
        await _maybe_rollup_memories("sess-1")
        mock_create.assert_not_called()

    @patch("tasks.pipeline_utils.get_session_memories", new_callable=AsyncMock)
    @patch("tasks.pipeline_utils.create_memory_entry", new_callable=AsyncMock)
    @patch("tasks.pipeline_utils.delete_memory_entry", new_callable=AsyncMock)
    @patch("tasks.pipeline_utils.MEMORY_ROLLUP_THRESHOLD", 3)
    async def test_existing_rollup_folded_in(self, mock_del, mock_create, mock_get):
        from tasks.pipeline_utils import _maybe_rollup_memories
        rollup = _mem("old-rollup", "previous summary", content_type="rollup")
        rollup.details = "previous details"
        mems = [rollup] + [_mem(f"{i}", f"entry {i}") for i in range(5)]
        mock_get.return_value = mems
        await _maybe_rollup_memories("sess-1")
        assert mock_create.awaited
        assert "previous details" in mock_create.call_args[1]["details"]
        # 旧 rollup 本身也被删除（被新 rollup 取代）
        assert mock_del.await_count == 3


class TestSummarizeRollup:
    """LLM 总结可选：无 key 降级截断，有 key 走 ChatOpenAI。"""

    @pytest.mark.asyncio
    @patch("core.config.load_config")
    @patch("repository.keys.get_api_key_for_model", new_callable=AsyncMock)
    async def test_falls_back_without_key(self, mock_key, mock_cfg):
        mock_cfg.return_value = SimpleNamespace(model="some-model")
        mock_key.return_value = None
        text = await rag_memory.summarize_rollup("x" * 800)
        assert len(text) == 500  # 截断降级

    @pytest.mark.asyncio
    @patch("core.config.load_config")
    @patch("repository.keys.get_api_key_for_model", new_callable=AsyncMock)
    @patch("langchain_openai.ChatOpenAI")
    async def test_llm_summary_used_when_configured(self, mock_llm_cls, mock_key, mock_cfg):
        mock_cfg.return_value = SimpleNamespace(model="cfg-model")
        mock_key.return_value = {"api_key": "sk-1", "base_url": "https://api.example.com/v1"}
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=SimpleNamespace(content="压缩后的摘要"))
        mock_llm_cls.return_value = mock_llm
        text = await rag_memory.summarize_rollup("merge me")
        assert text == "压缩后的摘要"
        # 模型名来自配置，不硬编码
        assert mock_llm_cls.call_args[1]["model"] == "cfg-model"


class TestRetrieveRelevant:
    """检索注入：有 embedding 按相关度排序，无 embedding 取最新 N 条。"""

    @pytest.mark.asyncio
    async def test_empty(self):
        assert await rag_memory.retrieve_relevant("q", []) == []

    @pytest.mark.asyncio
    @patch("repository.keys.get_embedding_config", new_callable=AsyncMock, return_value=None)
    async def test_fallback_newest_without_embedding(self, mock_cfg):
        mems = [_mem("1", "a"), _mem("2", "b"), _mem("3", "c")]
        out = await rag_memory.retrieve_relevant("q", mems, top_k=2)
        assert [m.id for m in out] == ["2", "3"]

    @pytest.mark.asyncio
    @patch("repository.keys.get_embedding_config", new_callable=AsyncMock)
    @patch("rag.rag_embedding.EmbeddingProvider")
    async def test_ranks_by_cosine(self, mock_provider_cls, mock_cfg):
        mock_cfg.return_value = {"api_key": "sk", "model": "m", "base_url": None}
        provider = MagicMock()
        provider.embed_query = AsyncMock(return_value=[1.0, 0.0])
        provider.embed = AsyncMock(return_value=[[0.9, 0.1], [0.1, 0.9], [0.8, 0.2]])
        mock_provider_cls.return_value = provider
        mems = [_mem("1", "python code"), _mem("2", "unrelated"), _mem("3", "python too")]
        out = await rag_memory.retrieve_relevant("python", mems, top_k=2)
        assert [m.id for m in out] == ["1", "3"]

    @pytest.mark.asyncio
    @patch("repository.keys.get_embedding_config", new_callable=AsyncMock)
    @patch("rag.rag_embedding.EmbeddingProvider")
    async def test_embedding_error_falls_back(self, mock_provider_cls, mock_cfg):
        mock_cfg.return_value = {"api_key": "sk", "model": "m", "base_url": None}
        provider = MagicMock()
        provider.embed_query = AsyncMock(side_effect=RuntimeError("embedding down"))
        mock_provider_cls.return_value = provider
        mems = [_mem("1", "a"), _mem("2", "b"), _mem("3", "c")]
        out = await rag_memory.retrieve_relevant("q", mems, top_k=2)
        assert [m.id for m in out] == ["2", "3"]  # 降级最新优先
