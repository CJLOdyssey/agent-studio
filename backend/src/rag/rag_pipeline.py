"""RAG 流水线：分析 → 切分 → 向量化 → 向量存储 → 检索。

单智能体模板的第 8-15 步：
  8.  分析并预处理会话内容
  9.  语义切分
  10. 文本向量化（DashScope text-embedding-v3，1024 维）
  11. 存入 pgvector
  12. 有新输入时：向量化查询
  13. 混合检索（标签匹配 + 经 pgvector 的余弦相似度）
  14. 将结果注入 LLM 上下文

生产技术栈：
  - 向量化：阿里云 DashScope（text-embedding-v3）
  - 向量库：PostgreSQL + pgvector 扩展
"""

import os
from difflib import SequenceMatcher
from typing import Any

from core.infra.logging_config import get_logger
from rag.rag_chunking import semantic_chunk
from rag.rag_embedding import EMBEDDING_MODEL, EmbeddingProvider
from rag.rag_store import PgVectorStore

logger = get_logger(__name__)

# ── 检索策略 ─────────────────────────────────────────────────────────

# 低于该相似度的 chunk 属于噪声而非上下文（环境变量可调）。
DEFAULT_MIN_SCORE = float(os.environ.get("RAG_MIN_SCORE", "0.25"))
# 去重前多取一些，使丢弃近似重复后仍能补足到 top_k。
DEDUP_OVERFETCH = 3
# 相邻滑动窗口 chunk 约重叠 12%；超过该比例即视为重复。
DEDUP_RATIO = 0.85
# 送入交叉编码器重排器的候选池，其进一步收窄到 top_k。
RERANK_CANDIDATES = 20

# ── 全局状态 ─────────────────────────────────────────────────────────────

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
    """第 8-11 步：将对话消息摄入 pgvector。

    1. 拼接消息 → 文本
    2. 语义切分
    3. 用 DashScope 向量化
    4. 存入 pgvector
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
    """第 13-14 步：为用户查询检索相关上下文。

    1. 用 DashScope 向量化查询
    2. 经 pgvector 混合搜索（BM25 + 余弦，RRF 融合；标签过滤 + 下限）
    3. 可选对候选做交叉编码器重排收窄到 top_k
    4. 丢弃近似重复 chunk，再格式化为 LLM 上下文
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
    """用配置的交叉编码器重排结果；不可用时无操作。"""
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
    """丢弃与已接受 chunk 近似重复的 chunk。

    重叠的滑动窗口会产生近乎相同的文本；两者都保留会浪费上下文。
    结果按分数降序到达，故首个副本胜出。
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
