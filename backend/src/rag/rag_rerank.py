"""通过 OpenAI 兼容的 /rerank 端点做交叉编码器重排。

SiliconFlow（BAAI/bge-reranker-v2-m3）已验证可用：POST {base}/rerank，
body 为 {"model", "query", "documents", "top_n"} → results[{index, score}]。
"""

import asyncio
import json
import urllib.request
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)

# key 声明了重排器但未指定模型时的默认模型。显式配置
# （经 get_rerank_config 的 key models 列表）始终优先。
RERANK_MODEL = "BAAI/bge-reranker-v2-m3"


class RerankProvider:
    """OpenAI 兼容端点上的交叉编码器重排器。"""

    def __init__(self, api_key: str, base_url: str, model: str = RERANK_MODEL):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def rerank(
        self, query: str, documents: list[str], top_n: int
    ) -> list[int]:
        """返回按相关性排序的文档索引，最优在前。"""
        if not documents or top_n <= 0:
            return list(range(len(documents)))
        return await asyncio.to_thread(self._rerank_sync, query, documents, top_n)

    def _rerank_sync(
        self, query: str, documents: list[str], top_n: int
    ) -> list[int]:
        body = json.dumps(
            {"model": self.model, "query": query, "documents": documents, "top_n": top_n}
        ).encode("utf-8")
        req = urllib.request.Request(f"{self.base_url}/rerank", data=body, method="POST")
        req.add_header("Authorization", f"Bearer {self.api_key}")
        req.add_header("Content-Type", "application/json")

        with urllib.request.urlopen(req, timeout=30) as resp:  # nosec B310
            result = json.loads(resp.read().decode("utf-8"))

        ranked: list[dict[str, Any]] = result.get("results") or []
        if not ranked:
            raise RuntimeError("rerank response missing results")
        return [int(r["index"]) for r in ranked]
