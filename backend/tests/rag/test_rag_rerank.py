"""Tests for cross-encoder reranking (backend/rag/rag_rerank.py + pipeline hook)."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from rag import rag_pipeline
from rag.rag_rerank import RERANK_MODEL, RerankProvider


def _mock_response(payload: dict) -> MagicMock:
    resp = MagicMock()
    resp.read.return_value = json.dumps(payload).encode("utf-8")
    resp.__enter__ = MagicMock(return_value=resp)
    resp.__exit__ = MagicMock(return_value=False)
    return resp


class TestRerankProvider:
    def test_rerank_request_shape(self):
        p = RerankProvider(api_key="sk", base_url="https://api.siliconflow.cn/v1")
        resp = _mock_response({"results": [{"index": 1, "relevance_score": 0.9}]})
        with patch("rag.rag_rerank.urllib.request.urlopen", return_value=resp) as mock_urlopen:
            indices = p._rerank_sync("q", ["a", "b"], top_n=1)
        assert indices == [1]
        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "https://api.siliconflow.cn/v1/rerank"
        body = json.loads(req.data.decode("utf-8"))
        assert body["model"] == RERANK_MODEL
        assert body["query"] == "q"
        assert body["documents"] == ["a", "b"]
        assert body["top_n"] == 1

    def test_rerank_missing_results_raises(self):
        p = RerankProvider(api_key="sk", base_url="https://x/v1")
        resp = _mock_response({"results": []})
        with patch("rag.rag_rerank.urllib.request.urlopen", return_value=resp):
            with pytest.raises(RuntimeError, match="missing results"):
                p._rerank_sync("q", ["a"], 1)

    @pytest.mark.asyncio
    async def test_rerank_empty_documents_noop(self):
        p = RerankProvider(api_key="sk", base_url="https://x/v1")
        assert await p.rerank("q", [], 5) == []

    @pytest.mark.asyncio
    async def test_rerank_base_url_rstrip(self):
        p = RerankProvider(api_key="sk", base_url="https://x/v1/")
        assert p.base_url == "https://x/v1"


class TestPipelineRerank:
    @pytest.mark.asyncio
    async def test_rerank_results_reorders(self):
        results = [
            {"text": "a", "score": 0.9, "tags": []},
            {"text": "b", "score": 0.8, "tags": []},
            {"text": "c", "score": 0.7, "tags": []},
        ]
        cfg = {
            "api_key": "sk",
            "base_url": "https://api.siliconflow.cn/v1",
            "model": "BAAI/bge-reranker-v2-m3",
        }
        with (
            patch("repository.keys.get_rerank_config", AsyncMock(return_value=cfg)),
            patch("rag.rag_rerank.RerankProvider") as provider_cls,
        ):
            provider_cls.return_value.rerank = AsyncMock(return_value=[2, 0])
            out = await rag_pipeline._rerank_results("q", results, top_k=2)
        assert [r["text"] for r in out] == ["c", "a"]

    @pytest.mark.asyncio
    async def test_rerank_no_config_keeps_order(self):
        results = [{"text": "a", "score": 0.9, "tags": []}, {"text": "b", "score": 0.8, "tags": []}]
        with patch("repository.keys.get_rerank_config", AsyncMock(return_value=None)):
            out = await rag_pipeline._rerank_results("q", results, top_k=1)
        assert [r["text"] for r in out] == ["a", "b"]

    @pytest.mark.asyncio
    async def test_retrieve_with_rerank_overfetches(self):
        provider = MagicMock()
        provider.embed_query = AsyncMock(return_value=[0.1] * 1024)
        with patch.object(rag_pipeline, "_embedding_provider", provider):
            with patch.object(rag_pipeline._vector_store, "search_hybrid", new_callable=AsyncMock, return_value=[]) as mock_search:
                await rag_pipeline.retrieve_context("query", rerank=True)
                call_kwargs = mock_search.call_args[1]
                assert call_kwargs["top_k"] == rag_pipeline.RERANK_CANDIDATES

    @pytest.mark.asyncio
    async def test_retrieve_rerank_reorders_output(self):
        provider = MagicMock()
        provider.embed_query = AsyncMock(return_value=[0.1] * 1024)
        search_results = [
            {"text": "a", "score": 0.9, "tags": [], "session_id": "s1", "run_id": "r1"},
            {"text": "b", "score": 0.8, "tags": [], "session_id": "s1", "run_id": "r1"},
            {"text": "c", "score": 0.7, "tags": [], "session_id": "s1", "run_id": "r1"},
            {"text": "d", "score": 0.6, "tags": [], "session_id": "s1", "run_id": "r1"},
        ]
        cfg = {
            "api_key": "sk",
            "base_url": "https://api.siliconflow.cn/v1",
            "model": "BAAI/bge-reranker-v2-m3",
        }
        with (
            patch.object(rag_pipeline, "_embedding_provider", provider),
            patch.object(rag_pipeline._vector_store, "search_hybrid", new_callable=AsyncMock, return_value=search_results),
            patch("repository.keys.get_rerank_config", AsyncMock(return_value=cfg)),
            patch("rag.rag_rerank.RerankProvider") as provider_cls,
        ):
            provider_cls.return_value.rerank = AsyncMock(return_value=[3, 2, 0])
            result = await rag_pipeline.retrieve_context("query", top_k=3, rerank=True)
        assert result.index("d") < result.index("c") < result.index("a")
        assert "b" not in result
