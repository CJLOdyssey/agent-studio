"""MCP stdio 工具发现的进程内缓存。

单一职责：管理 MCP 工具发现的缓存（含超时负缓存与并发去重锁），
从 pipeline_utils 拆分，供单 agent/团队执行路径共享复用。
"""

import asyncio
import hashlib
import json
import shlex
import time
from typing import Any

from mcp import StdioServerParameters
from mcp.client.session import ClientSession
from mcp.client.stdio import stdio_client

from core.infra.logging_config import get_logger

logger = get_logger(__name__)

# MCP stdio 发现结果的内存缓存。spawn 一个 stdio 子进程（及其最长 25s 超时）
# 开销大，且每次工作流运行（每个 agent、每次 run）都会重复。发现的工具列表
# 按（endpoint、args、env）配置缓存，使重复的单 agent/团队运行可复用。配置变更
# 会产生不同的缓存键并自动重新发现。合法的空结果（MCP 有响应但不暴露工具）
# 也会被缓存——损坏的 MCP 因此能快速失败，而非每次运行都挂起。
#
# 然而超时的发现只获得一个短暂的负 TTL。单次瞬时的 25s 超时（MCP 启动慢、
# 网络抖动）绝不能永久禁用该 MCP 在 worker 进程剩余生命周期内的工具，
# 因此我们在 TTL 之后重新发现，而非永久提供过期的空列表。
_MCP_DISCOVERY_CACHE: dict[str, list[dict[str, Any]]] = {}
_MCP_DISCOVERY_LOCKS: dict[str, tuple[asyncio.AbstractEventLoop, asyncio.Lock]] = {}
_MCP_DISCOVERY_MAX_ENTRIES = 32
_MCP_DISCOVERY_TIMEOUT_TTL_SECONDS = 60
# 负缓存：缓存键 -> 单调截止时间，超时的发现必须在此时之后重试。
# 条目开销低，读取时自过期。
_MCP_DISCOVERY_TIMEOUTS: dict[str, float] = {}


def _discovery_cache_key(
    endpoint: str,
    args: list[str] | None,
    env: dict[str, str] | None,
) -> str:
    payload = json.dumps(
        {"endpoint": endpoint, "args": args, "env": env},
        sort_keys=True, ensure_ascii=False, separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _get_discovery_lock(key: str) -> asyncio.Lock:
    """返回绑定到当前事件循环的每键发现锁。

    ``asyncio.Lock`` 绑定循环；Celery prefork worker 每个任务都在全新事件循环上
    运行（通过 ``asyncio.run``），因此创建在已死循环上的锁绝不能复用——否则
    会抛出 "Future attached to a different loop"。
    """
    loop = asyncio.get_running_loop()
    entry = _MCP_DISCOVERY_LOCKS.get(key)
    if entry is None or entry[0] is not loop:
        lock = asyncio.Lock()
        _MCP_DISCOVERY_LOCKS[key] = (loop, lock)
        return lock
    return entry[1]


def _store_discovery(key: str, result: list[dict[str, Any]]) -> None:
    """存储发现结果，达到上限时清空所有条目。"""
    if len(_MCP_DISCOVERY_CACHE) >= _MCP_DISCOVERY_MAX_ENTRIES:
        _MCP_DISCOVERY_CACHE.clear()
        _MCP_DISCOVERY_LOCKS.clear()
        _MCP_DISCOVERY_TIMEOUTS.clear()
    _MCP_DISCOVERY_CACHE[key] = result


def _get_cached_discovery(key: str) -> list[dict[str, Any]] | None:
    """返回缓存的发现结果，需重新发现时返回 None。

    正常结果永久驻留进程级缓存。超时（空）结果仅保留在负 TTL 窗口内；
    一旦过期，我们将该条目视为缺失并重新发现，而非永久提供被禁用的工具列表。
    """
    deadline = _MCP_DISCOVERY_TIMEOUTS.get(key)
    if deadline is not None:
        if time.monotonic() < deadline:
            return []
        _MCP_DISCOVERY_TIMEOUTS.pop(key, None)
    return _MCP_DISCOVERY_CACHE.get(key)


def _record_discovery_timeout(key: str) -> None:
    _MCP_DISCOVERY_TIMEOUTS[key] = (
        time.monotonic() + _MCP_DISCOVERY_TIMEOUT_TTL_SECONDS
    )


async def _discover_mcp_tools(
    endpoint: str,
    args: list[str] | None = None,
    env: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """发现 MCP stdio 工具，按（endpoint、args、env）缓存结果。

    发现会 spawn 一个 stdio 子进程且可能阻塞至多 25s，因此结果在进程内缓存。
    该缓存被单 agent 与团队执行路径共享，重复运行可复用工具列表，而非每次
    重新 spawn 子进程。配置变更会产生不同键并重新发现。对相同配置的并发
    发现通过每键 ``asyncio.Lock`` 去重。

    超时的发现返回空列表，仅短暂缓存（负 TTL）；TTL 过后下次运行会重新发现，
    因此单次瞬时超时不会静默禁用该 MCP 在进程剩余生命周期内的工具。
    """
    from services.tool_handlers import _normalize_mcp_env

    env = _normalize_mcp_env(env)
    key = _discovery_cache_key(endpoint, args, env)
    cached = _get_cached_discovery(key)
    if cached is not None:
        return cached

    lock = _get_discovery_lock(key)
    async with lock:
        cached = _get_cached_discovery(key)
        if cached is not None:
            return cached
        result, timed_out = await _discover_mcp_tools_uncached(endpoint, args, env)
        if timed_out:
            _record_discovery_timeout(key)
        else:
            _store_discovery(key, result)
        return result


async def _discover_mcp_tools_uncached(
    endpoint: str,
    args: list[str] | None = None,
    env: dict[str, str] | None = None,
) -> tuple[list[dict[str, Any]], bool]:
    """发现一次 MCP 工具，返回 (tools, timed_out)。

    ``timed_out`` 区分真实的空工具列表与超时导致的空列表，使调用方能仅对
    后者应用负 TTL。
    """
    if args:
        params = StdioServerParameters(command=endpoint, args=list(args), env=env)
    else:
        cmd = shlex.split(endpoint)
        params = StdioServerParameters(command=cmd[0], args=cmd[1:], env=env)
    try:
        async with asyncio.timeout(25):
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.list_tools()
                    return [
                        {
                            "name": t.name,
                            "description": t.description or "",
                            "inputSchema": t.inputSchema or {"type": "object"},
                        }
                        for t in (result.tools or [])
                    ], False
    except TimeoutError:
        logger.warning("MCP discovery timed out for endpoint: %s", endpoint)
        return [], True
