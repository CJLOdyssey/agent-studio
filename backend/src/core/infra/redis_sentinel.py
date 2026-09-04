"""Redis Sentinel 高可用集成。

当 REDIS_SENTINEL_ENABLED=1 时，使用 redis-py Sentinel 客户端发现当前主节点；
否则回退到直接的 REDIS_URL 连接。
"""

from __future__ import annotations

import os
from typing import Any

from redis.asyncio import Redis as AsyncRedis
from redis.asyncio.sentinel import Sentinel

SENTINEL_ENABLED = os.environ.get("REDIS_SENTINEL_ENABLED", "").lower() in ("1", "true", "yes")
SENTINEL_HOSTS_STR = os.environ.get("REDIS_SENTINEL_HOSTS", "sentinel-1:26379,sentinel-2:26380,sentinel-3:26381")
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")
SERVICE_NAME = os.environ.get("REDIS_SENTINEL_SERVICE", "agent-studio-redis")
SENTINEL_DB = int(os.environ.get("REDIS_SENTINEL_DB", "0"))
# 单命令读取超时。没有它，一个挂起但已连接的 Redis（半开 TCP，如进程冻结）
# 会永久阻塞 publish/incr，而非快速失败。
SOCKET_TIMEOUT = int(os.environ.get("REDIS_SOCKET_TIMEOUT", "10"))

_sentinel: Sentinel | None = None


def _get_sentinel() -> Sentinel:
    """返回（惰性创建）全局 Sentinel 客户端。"""
    global _sentinel
    if _sentinel is None:
        hosts = [
            (h.rsplit(":", 1)[0], int(h.rsplit(":", 1)[1]))
            for h in SENTINEL_HOSTS_STR.split(",")
        ]
        kwargs: dict[str, Any] = {
            "decode_responses": True,
            "socket_keepalive": True,
            "socket_connect_timeout": 10,
            "socket_timeout": SOCKET_TIMEOUT,
        }
        if REDIS_PASSWORD:
            kwargs["password"] = REDIS_PASSWORD
        _sentinel = Sentinel(hosts, **kwargs)
    return _sentinel


def create_redis() -> Any:
    """创建 AsyncRedis 连接。

    设置 REDIS_SENTINEL_ENABLED 时使用 Sentinel 发现；否则回退到通过 REDIS_URL 直连。
    """
    if SENTINEL_ENABLED:
        sentinel = _get_sentinel()
        max_connections = int(os.environ.get("REDIS_POOL_SIZE", "200"))
        kwargs: dict[str, Any] = {
            "db": SENTINEL_DB,
            "decode_responses": True,
            "socket_keepalive": True,
            "socket_connect_timeout": 10,
            "socket_timeout": SOCKET_TIMEOUT,
            "health_check_interval": 30,
            "retry_on_timeout": True,
            "max_connections": max_connections,
        }
        if REDIS_PASSWORD:
            kwargs["password"] = REDIS_PASSWORD
        return sentinel.master_for(SERVICE_NAME, **kwargs)

    # 直连 —— 从环境变量读取 REDIS_URL，避免循环导入
    url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    max_connections = int(os.environ.get("REDIS_POOL_SIZE", "200"))
    return AsyncRedis.from_url(
        url,
        max_connections=max_connections,
        decode_responses=True,
        socket_keepalive=True,
        socket_connect_timeout=10,
        socket_timeout=SOCKET_TIMEOUT,
        health_check_interval=30,
        retry_on_timeout=True,
    )
