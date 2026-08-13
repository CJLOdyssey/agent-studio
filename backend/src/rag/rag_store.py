from typing import Any

"""pgvector vector store for RAG pipeline."""

from sqlalchemy import text

from core.infra.logging_config import get_logger
from rag.rag_chunking import Chunk
from rag.rag_embedding import EMBEDDING_DIM

logger = get_logger(__name__)

# Reciprocal Rank Fusion constant (standard k=60).
_RRF_K = 60

# Vector-only branch score floor when none is passed to search_hybrid.
DEFAULT_MIN_SCORE = 0.25


def _scope_clauses(
    session_id: str | None, tag_filter: list[str] | None
) -> tuple[list[str], dict[str, Any]]:
    """Shared session/tag WHERE clauses and bind params for both search branches."""
    where_clauses: list[str] = []
    params: dict[str, Any] = {}

    if session_id:
        where_clauses.append("session_id = :sid")
        params["sid"] = session_id

    if tag_filter:
        tag_conditions = []
        for i, tag in enumerate(tag_filter):
            param_name = f"tag{i}"
            tag_conditions.append(f":{param_name} = ANY(tags)")
            params[param_name] = tag.lower()
        where_clauses.append("(" + " OR ".join(tag_conditions) + ")")

    return where_clauses, params


def _rrf_fuse(
    vector_rows: list[Any], bm25_rows: list[Any], top_k: int
) -> list[dict[str, Any]]:
    """Reciprocal Rank Fusion over two ranked lists (same row shape).

    Row shape: (text, tags, session_id, run_id, score). Chunks appearing in
    both branches rank above single-branch hits; ties are stable by insertion.
    """
    fused: dict[str, float] = {}
    items: dict[str, dict[str, Any]] = {}
    for rows in (vector_rows, bm25_rows):
        for i, row in enumerate(rows):
            text = row[0]
            fused[text] = fused.get(text, 0.0) + 1.0 / (_RRF_K + i + 1)
            items.setdefault(
                text,
                {
                    "text": text,
                    "tags": row[1] if row[1] else [],
                    "session_id": row[2],
                    "run_id": row[3],
                },
            )
    ranked = sorted(fused.items(), key=lambda kv: kv[1], reverse=True)[:top_k]
    return [{**items[k], "score": round(s, 4)} for k, s in ranked]


class PgVectorStore:
    """PostgreSQL + pgvector vector store.

    Requires:
      CREATE EXTENSION IF NOT EXISTS vector;
      Table: vector_chunks (id, session_id, run_id, text, tags, embedding vector(1024))
      Index: CREATE INDEX ON vector_chunks USING hnsw (embedding vector_cosine_ops);
    """

    def __init__(self) -> None:
        self._initialized = False
        self._hybrid_ready = False

    async def _ensure_table(self) -> None:
        if self._initialized:
            return
        from core.infra.database import get_session_factory

        factory = get_session_factory()
        async with factory() as session:
            # Enable extension (requires superuser in production — run once manually)
            try:
                await session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            except Exception:
                logger.warning("pgvector extension not available — install it first")

            # Create table if not exists
            await session.execute(
                text(f"""
                CREATE TABLE IF NOT EXISTS vector_chunks (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    run_id TEXT,
                    text TEXT NOT NULL,
                    tags TEXT[] DEFAULT '{{}}',
                    embedding vector({EMBEDDING_DIM})
                )
            """)
            )

            # Create index if not exists
            try:
                await session.execute(
                    text("""
                    CREATE INDEX IF NOT EXISTS idx_vector_chunks_embedding
                    ON vector_chunks USING hnsw (embedding vector_cosine_ops)
                """)
                )
            except Exception:
                # HNSW might not be available — try IVFFlat
                try:
                    await session.execute(
                        text("""
                        CREATE INDEX IF NOT EXISTS idx_vector_chunks_embedding
                        ON vector_chunks USING ivfflat (embedding vector_cosine_ops)
                    """)
                    )
                except Exception:
                    logger.warning("No vector index available — searches will be sequential")

            await session.commit()
        self._initialized = True

    async def _ensure_hybrid(self) -> None:
        """Create the BM25 tsvector column + GIN index once (best-effort).

        Kept separate from ``_ensure_table`` so vector-only callers keep the
        original DDL sequence; any failure degrades hybrid search to vector-only.
        """
        if self._hybrid_ready:
            return
        try:
            from core.infra.database import get_session_factory

            factory = get_session_factory()
            async with factory() as session:
                await session.execute(
                    text("""
                    ALTER TABLE vector_chunks
                    ADD COLUMN IF NOT EXISTS tsv tsvector
                    GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED
                """)
                )
                await session.execute(
                    text("""
                    CREATE INDEX IF NOT EXISTS idx_vector_chunks_tsv
                    ON vector_chunks USING GIN (tsv)
                """)
                )
                await session.commit()
            self._hybrid_ready = True
        except Exception:
            logger.warning("BM25 column/index unavailable — hybrid search degraded to vector-only")

    async def add(self, chunks: list[Chunk]) -> None:
        """Insert chunks with embeddings into pgvector."""
        if not chunks:
            return
        await self._ensure_table()

        from core.infra.database import get_session_factory

        factory = get_session_factory()
        async with factory() as session:
            for chunk in chunks:
                if not chunk.embedding:
                    continue
                # Build vector literal safely from numeric values
                emb_str = "[" + ",".join(str(v) for v in chunk.embedding) + "]"
                # Use proper PostgreSQL array literal via CAST
                tags_array = "{" + ",".join(chunk.tags) + "}" if chunk.tags else "{}"
                await session.execute(
                    text(
                        """
                        INSERT INTO vector_chunks (id, session_id, run_id, text, tags, embedding)
                        VALUES (:id, :sid, :rid, :text, CAST(:tags AS text[]), CAST(:emb AS vector))
                        ON CONFLICT (id) DO UPDATE
                        SET text = EXCLUDED.text,
                            tags = EXCLUDED.tags,
                            embedding = EXCLUDED.embedding
                        """
                    ),
                    {
                        "id": chunk.id,
                        "sid": chunk.session_id,
                        "rid": chunk.run_id or "",
                        "text": chunk.text,
                        "tags": tags_array,
                        "emb": emb_str,
                    },
                )
            await session.commit()
        logger.info("pgvector: stored %d chunks", len(chunks))

    async def search(
        self,
        query_embedding: list[float],
        session_id: str | None = None,
        tag_filter: list[str] | None = None,
        top_k: int = 5,
        min_score: float | None = None,
    ) -> list[dict[str, Any]]:
        """Search with vector similarity, optional tag filter and score floor.

        min_score drops low-similarity chunks (noise) before top_k applies.
        Returns list of {text, score, tags, session_id, run_id}.
        """
        await self._ensure_table()

        from core.infra.database import get_session_factory

        factory = get_session_factory()
        async with factory() as session:
            emb_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

            where_clauses, params = _scope_clauses(session_id, tag_filter)
            params["emb"] = emb_str

            if min_score is not None:
                where_clauses.append(
                    "(1 - (embedding <=> CAST(:emb AS vector))) >= :min_score"
                )
                params["min_score"] = min_score

            where_sql = " AND ".join(where_clauses) if where_clauses else "TRUE"

            result = await session.execute(
                text(f"""
                SELECT text, tags, session_id, run_id,
                       1 - (embedding <=> CAST(:emb AS vector)) AS similarity
                FROM vector_chunks
                WHERE {where_sql}
                ORDER BY embedding <=> CAST(:emb AS vector)
                LIMIT :top_k
            """),
                params,
            )

            rows = result.fetchall()
            return [
                {
                    "text": row[0],
                    "tags": row[1] if row[1] else [],
                    "session_id": row[2],
                    "run_id": row[3],
                    "score": round(float(row[4]), 4),
                }
                for row in rows
            ]

    async def search_hybrid(
        self,
        query: str,
        query_embedding: list[float],
        session_id: str | None = None,
        tag_filter: list[str] | None = None,
        top_k: int = 5,
        min_score: float | None = None,
    ) -> list[dict[str, Any]]:
        """Hybrid retrieval — BM25 keyword + vector cosine, fused with RRF.

        BM25 runs on PostgreSQL ``tsv`` (generated ``ts_rank('simple')`` column);
        the vector branch reuses the cosine search. Both share session/tag
        scoping; Reciprocal Rank Fusion (k=60) merges the two ranked lists into
        one score-descending result capped at ``top_k``. When the BM25 column
        is unavailable (non-Postgres), this degrades to the vector branch.
        """
        await self._ensure_table()
        await self._ensure_hybrid()

        from core.infra.database import get_session_factory

        factory = get_session_factory()
        async with factory() as session:
            emb_str = "[" + ",".join(str(v) for v in query_embedding) + "]"
            where_clauses, params = _scope_clauses(session_id, tag_filter)
            params["emb"] = emb_str
            params["q"] = query
            where_sql = " AND ".join(where_clauses) if where_clauses else "TRUE"

            vec_params = dict(params)
            vec_params["min_score"] = (
                min_score if min_score is not None else DEFAULT_MIN_SCORE
            )
            vec_params["vec_k"] = top_k * 2

            # Vector branch: cosine similarity with score floor.
            vec_result = await session.execute(
                text(f"""
                SELECT text, tags, session_id, run_id,
                       1 - (embedding <=> CAST(:emb AS vector)) AS similarity
                FROM vector_chunks
                WHERE {where_sql}
                  AND (1 - (embedding <=> CAST(:emb AS vector))) >= :min_score
                ORDER BY embedding <=> CAST(:emb AS vector)
                LIMIT :vec_k
            """),
                vec_params,
            )

            # BM25 branch: PostgreSQL full-text ranking ('simple' config).
            try:
                bm25_result = await session.execute(
                    text(f"""
                    SELECT text, tags, session_id, run_id,
                           ts_rank(tsv, websearch_to_tsquery('simple', :q)) AS bm25
                    FROM vector_chunks
                    WHERE {where_sql} AND tsv @@ websearch_to_tsquery('simple', :q)
                    ORDER BY bm25 DESC
                    LIMIT :bm25_k
                """),
                    {**params, "bm25_k": top_k * 2},
                )
            except Exception:
                logger.warning("BM25 search unavailable — falling back to vector-only")
                bm25_result = None

            return _rrf_fuse(vec_result.fetchall(), bm25_result.fetchall() if bm25_result else [], top_k)

    async def clear_session(self, session_id: str) -> None:
        await self._ensure_table()
        from core.infra.database import get_session_factory

        factory = get_session_factory()
        async with factory() as session:
            await session.execute(
                text("DELETE FROM vector_chunks WHERE session_id = :sid"),
                {"sid": session_id},
            )
            await session.commit()
