"""LLM 响应与中间结果的智能缓存。

实现智能缓存以减少冗余 API 调用，并跨工作流执行优化 token 用量。
"""

import hashlib
import json
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)

__all__ = ["CacheEntry", "SmartCache"]


@dataclass
class CacheEntry:
    """带元数据的缓存条目。"""
    key: str
    value: Any
    created_at: float
    last_accessed: float
    access_count: int = 0
    ttl: float | None = None  # 存活时间（秒）
    size_estimate: int = 0  # 估算的 token 大小

    def is_expired(self) -> bool:
        """检查条目是否已过期。"""
        if self.ttl is None:
            return False
        return (time.time() - self.created_at) > self.ttl

    def touch(self) -> None:
        """更新访问元数据。"""
        self.last_accessed = time.time()
        self.access_count += 1


class SmartCache:
    """带 LRU 淘汰与 TTL 支持的智能缓存。

    特性：
    - LRU（最近最少使用）淘汰策略
    - 条目的 TTL（存活时间）
    - 基于大小（token 感知）的淘汰
    - 命中/未命中统计
    - 过期条目自动清理
    """

    def __init__(
        self,
        max_size: int = 1000,
        max_tokens: int = 100000,
        default_ttl: float | None = 3600.0,
    ):
        """初始化智能缓存。

        参数：
            max_size: 最大条目数
            max_tokens: 缓存中最大总 tokens
            default_ttl: 默认存活时间（秒，None = 不过期）
        """
        self.max_size = max_size
        self.max_tokens = max_tokens
        self.default_ttl = default_ttl

        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._current_tokens = 0

        # 统计
        self.hits = 0
        self.misses = 0
        self.evictions = 0

    def _make_key(self, data: Any) -> str:
        """由数据生成缓存 key。

        参数：
            data: 用于生成 key 的数据

        返回：
            作为缓存 key 的哈希字符串
        """
        if isinstance(data, str):
            key_data = data
        elif isinstance(data, (dict, list)):
            key_data = json.dumps(data, sort_keys=True, ensure_ascii=False)
        else:
            key_data = str(data)

        return hashlib.md5(key_data.encode(), usedforsecurity=False).hexdigest()

    def _estimate_tokens(self, value: Any) -> int:
        """估算某值的 token 数。

        参数：
            value: 要估算 tokens 的值

        返回：
            估算的 token 数
        """
        if isinstance(value, str):
            # 粗略估算：每 token 4 字符
            return max(1, len(value) // 4)
        elif isinstance(value, (dict, list)):
            json_str = json.dumps(value, ensure_ascii=False)
            return max(1, len(json_str) // 4)
        else:
            return 10  # 默认估算

    def get(self, key: str) -> Any | None:
        """从缓存取值。

        参数：
            key: 缓存 key

        返回：
            缓存的值；未命中或已过期则返回 None
        """
        if key not in self._cache:
            self.misses += 1
            return None

        entry = self._cache[key]

        # 检查是否过期
        if entry.is_expired():
            self._remove_entry(key)
            self.misses += 1
            return None

        # 移到末尾（最近使用）
        self._cache.move_to_end(key)
        entry.touch()
        self.hits += 1

        return entry.value

    def set(
        self,
        key: str,
        value: Any,
        ttl: float | None = None,
    ) -> None:
        """向缓存写入值。

        参数：
            key: 缓存 key
            value: 要缓存的值
            ttl: 存活时间（秒，None = 使用默认值）
        """
        # 若已存在则先移除旧条目
        if key in self._cache:
            self._remove_entry(key)

        # 必要时淘汰条目
        token_estimate = self._estimate_tokens(value)
        while len(self._cache) >= self.max_size or (
            self._current_tokens + token_estimate > self.max_tokens
        ):
            if not self._evict_one():
                break

        # 新建缓存项
        entry = CacheEntry(
            key=key,
            value=value,
            created_at=time.time(),
            last_accessed=time.time(),
            ttl=ttl if ttl is not None else self.default_ttl,
            size_estimate=token_estimate,
        )

        self._cache[key] = entry
        self._current_tokens += token_estimate

    def delete(self, key: str) -> bool:
        """从缓存删除条目。

        参数：
            key: 缓存 key

        返回：
            删除成功返回 True，未找到返回 False
        """
        if key not in self._cache:
            return False
        self._remove_entry(key)
        return True

    def _remove_entry(self, key: str) -> None:
        """移除条目并更新 token 计数。

        参数：
            key: 缓存 key
        """
        if key in self._cache:
            entry = self._cache[key]
            self._current_tokens -= entry.size_estimate
            del self._cache[key]

    def _evict_one(self) -> bool:
        """按 LRU 策略淘汰一个条目。

        返回：
            淘汰成功返回 True
        """
        if not self._cache:
            return False

        # 找第一个未过期条目（LRU 顺序）
        # OrderedDict 保持插入顺序，故首项即最近最少使用
        key = next(iter(self._cache))
        self._remove_entry(key)
        self.evictions += 1
        return True

    def cleanup_expired(self) -> int:
        """移除所有过期条目。

        返回：
            移除的条目数
        """
        expired_keys = [
            key for key, entry in self._cache.items()
            if entry.is_expired()
        ]
        for key in expired_keys:
            self._remove_entry(key)
        return len(expired_keys)

    def clear(self) -> None:
        """清空缓存中所有条目。"""
        self._cache.clear()
        self._current_tokens = 0

    def get_stats(self) -> dict[str, Any]:
        """获取缓存统计。

        返回：
            含缓存统计的字典
        """
        total_requests = self.hits + self.misses
        hit_rate = self.hits / total_requests if total_requests > 0 else 0.0

        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "current_tokens": self._current_tokens,
            "max_tokens": self.max_tokens,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": hit_rate,
            "evictions": self.evictions,
        }

    def get_or_compute(
        self,
        key: str,
        compute_fn: Any,
        ttl: float | None = None,
    ) -> Any:
        """从缓存取值，或计算后写入缓存。

        参数：
            key: 缓存 key
            compute_fn: 未命中时用于计算值的异步函数
            ttl: 计算值的存活时间

        返回：
            缓存或计算得到的值
        """
        cached = self.get(key)
        if cached is not None:
            return cached

        # 计算值
        value = compute_fn()
        self.set(key, value, ttl=ttl)
        return value
