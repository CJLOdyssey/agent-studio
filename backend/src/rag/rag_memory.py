"""会话长期记忆——滚动摘要 + 相关性检索。

两项能力均可选、由配置驱动（项目配置体系，不硬编码）：

- ``summarize_rollup``：用配置的 LLM（经 ``get_api_key_for_model``）压缩合并后的
  记忆行；无匹配 key 时纯截断。
- ``retrieve_relevant``：用配置的向量化提供器（``get_embedding_config``）按当前
  查询给记忆条目排序；未配置向量化时按最新优先回退。

与 rag_pipeline/rag_store 分离，使记忆逻辑绝不触及它们的模块级全局——共享的
配置辅助函数是唯一接缝。
"""

import os
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)

# 配置向量化后，检索记忆的预算。
MEMORY_RETRIEVE_TOP_K = int(os.environ.get("MEMORY_RETRIEVE_TOP_K", "5"))


def _cosine(a: list[float], b: list[float]) -> float:
    """两个等长向量的余弦相似度。"""
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return float(dot / (na * nb))


async def summarize_rollup(merged: str) -> str:
    """在可用时用配置的 LLM 压缩合并后的记忆行。

    模型/key 解析遵循项目标准 key 配置（``get_api_key_for_model`` 使用配置中的
    默认模型）；此处不硬编码模型名。任何失败回退到截断拼接。
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
                    content=(
                        "你是会话记忆整理器。把以下历史记忆条目压缩为一段简洁的中文摘要，"
                        "保留关键事实、决定和结论，不超过 300 字。只输出摘要本身。"
                    )
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
    """选出与当前查询最相关的记忆条目。

    用配置的向量化端点（``get_embedding_config``——与 RAG 同一接缝）按余弦相似度
    排序。未配置向量化时按最新优先回退，使检索绝不阻塞于外部依赖。最多返回
    ``top_k`` 条。
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
        api_key = str(cfg["api_key"])
        model = cfg.get("model")
        base_url = cfg.get("base_url")
        provider = EmbeddingProvider(
            api_key=api_key, model=model, base_url=base_url
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
