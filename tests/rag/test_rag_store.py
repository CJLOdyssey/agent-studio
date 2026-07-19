"""Tests for RAG vector store (backend/rag/rag_store.py)."""

from backend.rag.rag_store import PgVectorStore


class TestPgVectorStore:
    def test_init(self):
        store = PgVectorStore()
        assert hasattr(store, "_initialized")
        assert store._initialized is False

    def test_ensure_table_exists(self):
        store = PgVectorStore()
        assert callable(store._ensure_table)


class TestSearchFormat:
    def test_dimension_constant(self):
        from backend.rag.rag_embedding import EMBEDDING_DIM
        assert EMBEDDING_DIM == 1024
