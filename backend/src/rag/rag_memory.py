"""Session long-term memory — rolling summary + relevance retrieval.

Two capabilities, both optional and config-driven (项目配置体系, 不硬编码):

- ``summarize_rollup``: condense merged memory lines with the configured LLM
  via ``get_api_key_for_model``; plain truncation when no key matches.
- ``retrieve_relevant``: rank memory entries against the current query with
  the configured embedding provider (``get_embedding_config``); newest-first
  fallback when embedding is not configured.

Kept separate from rag_pipeline/rag_store so memory logic never reaches into
their module-level globals — the shared config helpers are the only seam.
"""

import os
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)

# Retrieved-memory budget when embedding is configured.
MEMORY_RETRIEVE_TOP_K = int(os.environ.get("MEMORY_RETRIEVE_TOP_K", "5"))


def _cosine(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two equal-length vectors."""
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return float(dot / (na * nb))


async def summarize_rollup(merged: str) -> str:
    """Condense merged memory lines with the configured LLM when available.

    The model/key resolution follows the project's standard key config
    (``get_api_key_for_model`` with the default model from config); no model
    name is hardcoded here. Falls back to truncated join on any failure.
    """
    try:
        from langchain_core.messages import HumanMessage, SystemMessage
        from langchain_openai import ChatOpenAI

        from core.config import load_config
        from repository.keys import get_api_key_for_model

        cfg = load_config()
        key = await get_api_key_for_model(cfg.model, "anonymous")
        if key is None or not key.get("api_key"):
            return merged[:500]
        llm_kwargs: dict[str, Any] = {
            "model": cfg.model,
            "api_key": key["api_key"],
            "temperature": 0.2,
            "max_tokens": 300,
        }
        if key.get("base_url"):
            llm_kwargs["base_url"] = key["base_url"]
        llm = ChatOpenAI(**llm_kwargs)
        resp = await llm.ainvoke(
            [
                SystemMessage(
                    content="你是会话记忆整理器。把以下历史记忆条目压缩为一段简洁的中文摘要，保留关键事实、决定和结论，不超过 300 字。只输出摘要本身。"
                ),
                HumanMessage(content=merged),
            ]
        )
        content = resp.content
        text = str(content).strip() if isinstance(content, str) else ""
        return text if text else merged[:500]
    except Exception:
        logger.warning("[MEM] rollup LLM summarize failed — falling back to truncation", exc_info=True)
        return merged[:500]


async def retrieve_relevant(
    query: str, memories: list[Any], top_k: int | None = None
) -> list[Any]:
    """Pick the memory entries most relevant to the current query.

    Ranks by cosine similarity using the configured embedding endpoint
    (``get_embedding_config`` — same seam as RAG). Falls back to newest-first
    when embedding is not configured, so retrieval never blocks on external
    deps. Returns at most ``top_k`` entries.
    """
    if not memories:
        return []
    k = top_k if top_k is not None else MEMORY_RETRIEVE_TOP_K
    try:
        from rag.rag_embedding import EmbeddingProvider
        from repository.keys import get_embedding_config

        cfg = await get_embedding_config()
        if cfg is None or not cfg.get("api_key"):
            return memories[-k:]
        provider = EmbeddingProvider(
            api_key=cfg["api_key"], model=cfg["model"], base_url=cfg["base_url"]
        )
        query_emb = await provider.embed_query(query)
        embs = await provider.embed([m.summary for m in memories])
        scored = sorted(
            zip(memories, embs, strict=False),
            key=lambda t: _cosine(query_emb, t[1]),
            reverse=True,
        )
        return [m for m, _ in scored[:k]]
    except Exception:
        logger.warning("[MEM] memory retrieval failed — falling back to newest-first", exc_info=True)
        return memories[-k:]
