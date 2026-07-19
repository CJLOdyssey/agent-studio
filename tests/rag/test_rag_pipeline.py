"""Tests for RAG pipeline (backend/rag/rag_pipeline.py)."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.rag import rag_pipeline


class TestRagPipeline:
    def test_get_rag_pipeline(self):
        p, store = rag_pipeline.get_rag_pipeline()
        assert store is not None

    def test_ensure_embedding_provider_set(self):
        rag_pipeline.ensure_embedding_provider(api_key="sk-test")
        p, _ = rag_pipeline.get_rag_pipeline()
        assert p is not None
        # Cleanup
        rag_pipeline.ensure_embedding_provider(api_key=None)

    def test_ensure_embedding_provider_none(self):
        rag_pipeline.ensure_embedding_provider(api_key="sk")
        rag_pipeline.ensure_embedding_provider(api_key=None)
        p, _ = rag_pipeline.get_rag_pipeline()
        assert p is None

    @pytest.mark.asyncio
    async def test_ingest_empty_messages(self):
        with patch.object(rag_pipeline._vector_store, "add", new_callable=AsyncMock):
            await rag_pipeline.ingest_session_messages("s1", "r1", [])
            rag_pipeline._vector_store.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_ingest_no_embedding_provider(self):
        rag_pipeline.ensure_embedding_provider(api_key=None)
        with patch.object(rag_pipeline._vector_store, "add", new_callable=AsyncMock):
            await rag_pipeline.ingest_session_messages(
                "s1", "r1", [{"content": "hello"}]
            )
            rag_pipeline._vector_store.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_retrieve_no_embedding_provider(self):
        rag_pipeline.ensure_embedding_provider(api_key=None)
        result = await rag_pipeline.retrieve_context("query")
        assert result == ""

    @pytest.mark.asyncio
    async def test_retrieve_empty_results(self):
        provider = MagicMock()
        provider.embed_query = AsyncMock(return_value=[0.1] * 1024)
        with patch.object(rag_pipeline, "_embedding_provider", provider):
            with patch.object(rag_pipeline._vector_store, "search", new_callable=AsyncMock, return_value=[]):
                result = await rag_pipeline.retrieve_context("query")
                assert result == ""
