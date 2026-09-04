"""RAG 流水线的向量化提供器（DashScope / OpenAI 兼容）。"""

import asyncio
import json
import os
import urllib.request
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)

# 无默认值：EMBEDDING_MODEL 未设置即表示未配置向量化，
# 调用时必须 fail-loud——绝不静默假定某个供应商。
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL")
EMBEDDING_DIM = 1024  # text-embedding-v3 输出维度
DASHSCOPE_EMBEDDING_URL = (
    "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding"
)


class EmbeddingProvider:
    """通过 HTTP API 向量化——DashScope 原生或任意 OpenAI 兼容端点。

    base_url=None 使用旧版 DashScope 协议（原生请求结构）。
    设置 base_url（如 https://api.siliconflow.cn/v1）则使用 OpenAI 兼容协议：
    POST {base_url}/embeddings，body 为 {"model", "input": [...]}。
    """

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        base_url: str | None = None,
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """批量向量化文本列表。返回 1024 维向量列表。

        任何失败都抛出 RuntimeError——调用方必须处理；零向量回退会静默地用
        伪造向量污染向量存储。
        """
        if not self.api_key:
            raise RuntimeError(
                "RAG embedding unavailable: no API key configured"
            )
        return await asyncio.to_thread(self._embed_sync, texts)

    def _embed_sync(self, texts: list[str]) -> list[list[float]]:
        """在线程池中通过 HTTP API 同步向量化文本。"""
        if not self.model:
            raise RuntimeError(
                "RAG embedding unavailable: EMBEDDING_MODEL not configured"
            )
        if self.base_url:
            url = f"{self.base_url.rstrip('/')}/embeddings"
            body: dict[str, Any] = {"model": self.model, "input": texts}
            response_key = "data"
        else:
            url = DASHSCOPE_EMBEDDING_URL
            body = {
                "model": self.model,
                "input": {"texts": texts},
                "parameters": {"text_type": "document"},
            }
            response_key = "output.embeddings"

        payload = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(url, data=payload, method="POST")
        req.add_header("Authorization", f"Bearer {self.api_key}")
        req.add_header("Content-Type", "application/json")

        with urllib.request.urlopen(req, timeout=30) as resp:  # nosec B310
            result = json.loads(resp.read().decode("utf-8"))

        if response_key == "data":
            embeddings = result.get("data") or []
            if not embeddings or "embedding" not in embeddings[0]:
                raise RuntimeError("embedding response missing embeddings")
            return [e["embedding"] for e in embeddings]

        if result.get("output") and result["output"].get("embeddings"):
            return [e["embedding"] for e in result["output"]["embeddings"]]
        raise RuntimeError("DashScope embedding response missing embeddings")

    async def embed_query(self, query: str) -> list[float]:
        embeddings = await self.embed([query])
        return embeddings[0]
