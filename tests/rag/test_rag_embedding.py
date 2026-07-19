"""Tests for RAG embedding provider (backend/rag/rag_embedding.py)."""

import pytest
from unittest.mock import patch

from backend.rag.rag_embedding import EMBEDDING_DIM, EmbeddingProvider, _fallback_embed


class TestEmbeddingProvider:
    def test_init_defaults(self):
        p = EmbeddingProvider(api_key="sk-test")
        assert p.api_key == "sk-test"
        assert p.model == "text-embedding-v3"

    def test_init_custom_model(self):
        p = EmbeddingProvider(api_key="sk", model="custom-model")
        assert p.model == "custom-model"

    @pytest.mark.asyncio
    async def test_embed_no_api_key_fallback(self):
        p = EmbeddingProvider(api_key="")
        result = await p.embed(["hello", "world"])
        assert len(result) == 2
        assert len(result[0]) == EMBEDDING_DIM
        assert result[0] == [0.0] * EMBEDDING_DIM

    @pytest.mark.asyncio
    async def test_embed_query_no_api_key(self):
        p = EmbeddingProvider(api_key="")
        result = await p.embed_query("hello")
        assert len(result) == EMBEDDING_DIM

    def test__fallback_embed(self):
        result = _fallback_embed(["a", "b"])
        assert len(result) == 2
        assert len(result[0]) == EMBEDDING_DIM

    def test__fallback_embed_empty(self):
        result = _fallback_embed([])
        assert result == []

    @pytest.mark.asyncio
    async def test_embed_falls_back_on_exception(self):
        p = EmbeddingProvider(api_key="sk-test")
        with patch.object(p, "_embed_sync", side_effect=Exception("API down")):
            result = await p.embed(["test"])
            assert len(result) == 1
            assert result[0] == [0.0] * EMBEDDING_DIM
