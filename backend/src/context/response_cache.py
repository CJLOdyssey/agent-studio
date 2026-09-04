"""LLM 响应的专用缓存。

实现语义相似度检测，避免对相似提示词发起冗余 API 调用。
"""

import hashlib
from typing import Any

from context.smart_cache import SmartCache
from core.infra.logging_config import get_logger

logger = get_logger(__name__)


class ResponseCache:
    """LLM 响应的专用缓存。

    实现语义相似度检测，避免对相似提示词发起冗余 API 调用。
    """

    def __init__(
        self,
        max_size: int = 500,
        similarity_threshold: float = 0.9,
    ):
        """初始化响应缓存。

        参数：
            max_size: 最大缓存的响应数
            similarity_threshold: 判定提示词相似度的阈值
        """
        self.cache = SmartCache(max_size=max_size)
        self.similarity_threshold = similarity_threshold
        self._prompt_hashes: dict[str, str] = {}  # hash -> response_key

    def _normalize_prompt(self, prompt: str) -> str:
        """规范化提示词以便比较。

        参数：
            prompt: 要规范化的提示词

        返回：
            规范化后的提示词字符串
        """
        # 转小写并去除首尾空白
        normalized = prompt.lower().strip()
        # 去除多余空白
        normalized = " ".join(normalized.split())
        return normalized

    def _simple_similarity(self, text1: str, text2: str) -> float:
        """计算两段文本的简单相似度。

        对词集使用 Jaccard 相似度。

        参数：
            text1: 第一段文本
            text2: 第二段文本

        返回：
            0 到 1 之间的相似度分数
        """
        words1 = set(text1.split())
        words2 = set(text2.split())

        if not words1 or not words2:
            return 0.0

        intersection = words1 & words2
        union = words1 | words2

        return len(intersection) / len(union)

    def get_response(self, prompt: str, model: str = "") -> str | None:
        """获取某提示词的缓存响应。

        参数：
            prompt: 要查找的提示词
            model: 模型名（用于缓存 key）

        返回：
            缓存的响应；未找到则返回 None
        """
        normalized = self._normalize_prompt(prompt)
        cache_key = f"{model}:{hashlib.md5(normalized.encode(), usedforsecurity=False).hexdigest()}"

        # 直接命中
        response = self.cache.get(cache_key)
        if response is not None:
            logger.debug(f"Cache hit for prompt: {prompt[:50]}...")
            return str(response)

        # 查找相似提示词
        for stored_hash, stored_normalized in self._prompt_hashes.items():
            if self._simple_similarity(normalized, stored_normalized) > self.similarity_threshold:
                response = self.cache.get(stored_hash)
                if response is not None:
                    logger.debug(f"Similar prompt cache hit for: {prompt[:50]}...")
                    return str(response)

        return None

    def cache_response(self, prompt: str, response: str, model: str = "") -> None:
        """缓存某提示词的响应。

        参数：
            prompt: 产生该响应的提示词
            response: 要缓存的响应
            model: 模型名（用于缓存 key）
        """
        normalized = self._normalize_prompt(prompt)
        cache_key = f"{model}:{hashlib.md5(normalized.encode(), usedforsecurity=False).hexdigest()}"

        self.cache.set(cache_key, response)
        self._prompt_hashes[cache_key] = normalized

    def get_stats(self) -> dict[str, Any]:
        """获取缓存统计。"""
        return self.cache.get_stats()


# 全局响应缓存实例
_response_cache = ResponseCache()


def get_response_cache() -> ResponseCache:
    """获取全局响应缓存实例。"""
    return _response_cache


def clear_all_caches() -> None:
    """清空所有全局缓存。"""
    _response_cache.cache.clear()
