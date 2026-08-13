"""RAG pipeline: analysis → chunking → embedding → vector store → retrieval.

Steps 8-15 of the single-agent template:
  8.  Analyze & preprocess session content
  9.  Semantic chunking
  10. Text vectorization (DashScope text-embedding-v3, 1024d)
  11. Store in pgvector
  12. On new input: vectorize query
  13. Hybrid retrieval (tag match + cosine similarity via pgvector)
  14. Inject results into LLM context

Production stack:
  - Embedding: Alibaba DashScope (text-embedding-v3)
  - Vector DB: PostgreSQL + pgvector extension
"""

import os
from difflib import SequenceMatcher
from typing import Any

from core.infra.logging_config import get_logger
from rag.rag_chunking import semantic_chunk
from rag.rag_embedding import EMBEDDING_MODEL, EmbeddingProvider
from rag.rag_store import PgVectorStore

logger = get_logger(__name__)

# ── Retrieval policy ─────────────────────────────────────────────────────────

# Chunks scoring below this similarity are noise, not context (env-tunable).
DEFAULT_MIN_SCORE = float(os.environ.get("RAG_MIN_SCORE", "0.25"))
# Overfetch before dedup so dropping near-duplicates can refill up to top_k.
DEDUP_OVERFETCH = 3
# Adjacent sliding-window chunks overlap ~12%; anything above this ratio is a duplicate.
DEDUP_RATIO = 0.85
# Candidate pool fed to the cross-encoder reranker, which narrows to top_k.
RERANK_CANDIDATES = 20

# ── Global state ─────────────────────────────────────────────────────────────

_embedding_provider: EmbeddingProvider | None = None
_vector_store = PgVectorStore()


def get_rag_pipeline() -> tuple[EmbeddingProvider | None, PgVectorStore]:
    return _embedding_provider, _vector_store


def ensure_embedding_provider(
    api_key: str | None = None,
    model: str | None = None,
    base_url: str | None = None,
) -> None:
    global _embedding_provider
    _embedding_provider = (
        EmbeddingProvider(
            api_key=api_key, model=model or EMBEDDING_MODEL, base_url=base_url
        )
        if api_key
        else None
    )


async def ingest_session_messages(
    session_id: str,
    run_id: str,
    messages: list[dict[str, Any]],
) -> None:
    """Steps 8-11: Ingest conversation messages into pgvector.

    1. Concatenate messages → text
    2. Chunk semantically
    3. Embed with DashScope
    4. Store in pgvector
    """
    text = "\n".join(m.get("content", "") for m in messages if m.get("content"))
    if not text.strip():
        return

    chunks = semantic_chunk(text, session_id=session_id, run_id=run_id)
    if not chunks:
        return

    if _embedding_provider is None:
        logger.warning("Embedding provider not configured — skipping RAG ingestion")
        return
    texts = [c.text for c in chunks]
    embeddings = await _embedding_provider.embed(texts)
    for chunk, emb in zip(chunks, embeddings, strict=False):
        chunk.embedding = emb

    await _vector_store.add(chunks)
    logger.info("RAG: ingested %d chunks for session %s", len(chunks), session_id)


async def retrieve_context(
    query: str,
    session_id: str | None = None,
    tags: list[str] | None = None,
    top_k: int = 5,
    min_score: float | None = None,
    rerank: bool = False,
) -> str:
    """Steps 13-14: Retrieve relevant context for a user query.

    1. Embed query with DashScope
    2. Hybrid search via pgvector (BM25 + cosine, RRF-fused; tag filter + floor)
    3. Optional cross-encoder rerank of candidates down to top_k
    4. Drop near-duplicate chunks, then format context for LLM
    """
    if _embedding_provider is None:
        return ""
    query_embedding = await _embedding_provider.embed_query(query)
    candidate_k = RERANK_CANDIDATES if rerank else top_k * DEDUP_OVERFETCH
    results = await _vector_store.search_hybrid(
        query,
        query_embedding,
        session_id=session_id,
        tag_filter=tags,
        top_k=candidate_k,
        min_score=min_score if min_score is not None else DEFAULT_MIN_SCORE,
    )

    if not results:
        return ""

    deduped = _dedup_chunks(results, candidate_k if rerank else top_k)
    if not deduped:
        return ""

    if rerank and len(deduped) > top_k:
        deduped = await _rerank_results(query, deduped, top_k)

    parts = []
    for r in deduped[:top_k]:
        tag_str = f" [{', '.join(r['tags'])}]" if r["tags"] else ""
        parts.append(f"--- [相似度: {r['score']:.2f}]{tag_str} ---\n{r['text']}")

    return "\n\n".join(parts)


async def _rerank_results(
    query: str, results: list[dict[str, Any]], top_k: int
) -> list[dict[str, Any]]:
    """Reorder results with the configured cross-encoder; no-op if unavailable."""
    from rag.rag_rerank import RerankProvider
    from repository.keys import get_rerank_config

    cfg = await get_rerank_config()
    if cfg is None or cfg["api_key"] is None:
        return results
    provider = RerankProvider(
        api_key=cfg["api_key"], base_url=cfg["base_url"], model=cfg["model"]
    )
    indices = await provider.rerank(query, [r["text"] for r in results], top_n=top_k)
    by_index = {i: results[i] for i in range(len(results))}
    reranked: list[dict[str, Any]] = []
    for idx in indices:
        if idx in by_index:
            reranked.append(by_index[idx])
    return reranked


def _dedup_chunks(
    results: list[dict[str, Any]], top_k: int
) -> list[dict[str, Any]]:
    """Drop chunks that are near-duplicates of an already-accepted one.

    Overlapping sliding windows produce near-identical texts; keeping both
    wastes context. Results arrive score-descending, so the first copy wins.
    """
    accepted: list[dict[str, Any]] = []
    for r in results:
        if any(
            SequenceMatcher(None, r["text"], a["text"]).ratio() >= DEDUP_RATIO
            for a in accepted
        ):
            continue
        accepted.append(r)
        if len(accepted) >= top_k:
            break
    return accepted
