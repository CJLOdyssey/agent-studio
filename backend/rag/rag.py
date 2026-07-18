"""RAG pipeline: chunking, embedding, vector store, and retrieval."""

from backend.rag.rag_chunking import Chunk, semantic_chunk  # noqa: F401
from backend.rag.rag_embedding import EmbeddingProvider  # noqa: F401
from backend.rag.rag_pipeline import (  # noqa: F401
    ensure_embedding_provider,
    get_rag_pipeline,
    ingest_session_messages,
    retrieve_context,
)
from backend.rag.rag_store import PgVectorStore  # noqa: F401
