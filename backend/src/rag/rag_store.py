from typing import Any

"""RAG 流水线的 pgvector 向量存储。"""

from sqlalchemy import text

from core.infra.logging_config import get_logger
from rag.rag_chunking import Chunk
from rag.rag_embedding import EMBEDDING_DIM

logger = get_logger(__name__)

# 倒数排名融合（RRF）常量（标准 k=60）。
_RRF_K = 60

# 未向 search_hybrid 传值时，纯向量分支的分数下限。
DEFAULT_MIN_SCORE = 0.25


def _scope_clauses(
    session_id: str | None, tag_filter: list[str] | None
) -> tuple[list[str], dict[str, Any]]:
    """两个搜索分支共享的 session/tag WHERE 子句与绑定参数。"""
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
    """对两个已排序列表做倒数排名融合（相同行形状）。

    行形状：(text, tags, session_id, run_id, score)。同时出现在两个分支的 chunk
    排名高于单分支命中；并列按插入顺序保持稳定。
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
    """PostgreSQL + pgvector 向量存储。

    需要：
      CREATE EXTENSION IF NOT EXISTS vector;
      表：vector_chunks (id, session_id, run_id, text, tags, embedding vector(1024))
      索引：CREATE INDEX ON vector_chunks USING hnsw (embedding vector_cosine_ops);
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
            # 启用扩展（生产需超级用户——手动执行一次）
            try:
                await session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            except Exception:
                logger.warning("pgvector extension not available — install it first")

            # 建表（不存在时）
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

            # 建索引（若不存在）
            try:
                await session.execute(
                    text("""
                    CREATE INDEX IF NOT EXISTS idx_vector_chunks_embedding
                    ON vector_chunks USING hnsw (embedding vector_cosine_ops)
                """)
                )
            except Exception:
                # HNSW 可能不可用——尝试 IVFFlat
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
        """一次性创建 BM25 tsvector 列 + GIN 索引（尽力而为）。

        与 ``_ensure_table`` 分离，使纯向量调用方保持原始 DDL 序列；
        任何失败都会把混合搜索降级为纯向量。
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
        """将带向量的 chunk 插入 pgvector。"""
        if not chunks:
            return
        await self._ensure_table()

        from core.infra.database import get_session_factory

        factory = get_session_factory()
        async with factory() as session:
            for chunk in chunks:
                if not chunk.embedding:
                    continue
                # 由数值安全地构建向量字面量
                emb_str = "[" + ",".join(str(v) for v in chunk.embedding) + "]"
                # 通过 CAST 使用正确的 PostgreSQL 数组字面量
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
        """用向量相似度搜索，支持可选标签过滤与分数下限。

        min_score 在应用 top_k 之前丢弃低相似度 chunk（噪声）。
        返回 {text, score, tags, session_id, run_id} 列表。
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
        """混合检索——BM25 关键词 + 向量余弦，经 RRF 融合。

        BM25 运行在 PostgreSQL ``tsv``（生成的 ``ts_rank('simple')`` 列）上；
        向量分支复用余弦搜索。两者共享 session/tag 作用域；倒数排名融合（k=60）
        将两个已排序列表合并为按分数降序、上限为 ``top_k`` 的结果。当 BM25 列
        不可用时（非 Postgres），降级为向量分支。
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

            # 向量分支：带分数下限的余弦相似度。
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

            # BM25 分支：PostgreSQL 全文排序（'simple' 配置）。
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

            return _rrf_fuse(list(vec_result.fetchall()), list(bm25_result.fetchall()) if bm25_result else [], top_k)

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
