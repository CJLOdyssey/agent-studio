"""RAG pipeline: chunking, embedding, vector store, and retrieval."""

from virtual_team.rag_chunking import Chunk, semantic_chunk  # noqa: F401
from virtual_team.rag_embedding import EmbeddingProvider  # noqa: F401
from virtual_team.rag_pipeline import (  # noqa: F401
    ensure_embedding_provider,
    get_rag_pipeline,
    ingest_session_messages,
    retrieve_context,
)
from virtual_team.rag_store import PgVectorStore  # noqa: F401
