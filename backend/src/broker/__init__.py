"""消息基础设施：Celery 应用 + 用于流式传输的 Redis 发布/订阅。"""

import asyncio
import contextlib
import json
import os
from collections.abc import AsyncIterator
from typing import Any

from celery import Celery
from redis.asyncio import Redis as AsyncRedis  # noqa: F401  # 为向后兼容再导出

from core.infra.logging_config import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Celery 应用
# ---------------------------------------------------------------------------

BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

celery_app = Celery(
    "backend",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=600,
    task_time_limit=900,
)

# 周期性告警评估 tick（监控中心）。
# 评估器本身对每条规则幂等（冷却/静默/状态守卫），因此漏拍或重复拍都安全。
from celery.schedules import schedule as celery_schedule  # type: ignore[import-untyped]  # noqa: E402

celery_app.conf.beat_schedule = {
    "monitoring-tick": {
        "task": "monitoring.tick",
        "schedule": celery_schedule(float(os.environ.get("MONITOR_EVAL_INTERVAL_SECONDS", "60"))),
    },
    "audit-cleanup": {
        "task": "audit.cleanup",
        "schedule": celery_schedule(float(os.environ.get("AUDIT_CLEANUP_INTERVAL_SECONDS", "86400"))),
    },
}

celery_app.autodiscover_tasks(["tasks"])

# ---------------------------------------------------------------------------
# Redis 发布/订阅
# ---------------------------------------------------------------------------

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# 每事件循环连接池 —— Celery prefork worker 在每个子进程中通过 asyncio.run()
# 创建新事件循环，因此绑定到父循环的单一全局池会失效（"Event loop is closed"）。
#
# 以循环对象（而非 id()）为键：asyncio.run() 每个任务创建全新循环；任务结束后
# 该循环被垃圾回收，其 id() 可能被下一任务的循环复用。若以 id() 为键就会命中
# 陈旧池，其连接属于已关闭的循环 -> redis 调用永久挂起。以循环对象为键并丢弃
# 循环已消失的条目，可同时解决陈旧命中与泄漏（池上的 socket_timeout 是针对
# 挂起但已连接 Redis 的最后兜底防线）。
_pools: dict[asyncio.AbstractEventLoop, Any] = {}
CHANNEL_PREFIX = "run:"


def _channel(run_id: str) -> str:
    return f"{CHANNEL_PREFIX}{run_id}"


def get_redis() -> Any:  # 返回 AsyncRedis
    """返回当前事件循环的 AsyncRedis 池。

    每个 asyncio 事件循环拥有独立连接池，使 Celery 的 prefork 模型
    （每次 asyncio.run() 调用创建全新循环）能正确工作。

    设置 REDIS_SENTINEL_ENABLED 时通过 Sentinel 发现创建连接；
    否则回退到直接的 REDIS_URL 连接。
    """

    loop = asyncio.get_running_loop()

    # 丢弃循环已停止运行的陈旧池（以循环对象身份，而非 id() 为键 ——
    # GC 后的 id 复用会命中死连接）。
    stale = [k for k in _pools if k is not loop and (k.is_closed() or not k.is_running())]
    for k in stale:
        _pools.pop(k, None)

    pool = _pools.get(loop)
    if pool is None:
        from core.infra.redis_sentinel import create_redis

        pool = create_redis()
        _pools[loop] = pool
    return pool


async def close_redis() -> None:
    """关闭当前事件循环的 Redis 连接池。"""

    loop = asyncio.get_running_loop()
    pool = _pools.pop(loop, None)
    if pool is not None:
        await pool.aclose()


async def publish_run_message(run_id: str, message: dict[str, Any]) -> None:
    """向某 run 的 Redis 发布/订阅通道发布消息。

    失败放行（与 publish_user_event 对齐）：Redis 故障不得中断 run 生命周期。
    否则，管线 try 块内（如 team_pipeline）的瞬时 Redis 故障会被管线异常
    处理器捕获，从而把已收敛的 run 错误标记为 error。
    """
    try:
        r = get_redis()
        await r.publish(_channel(run_id), json.dumps(message, ensure_ascii=False))
    except Exception:
        logger.debug("publish_run_message failed for %s", run_id, exc_info=True)


async def subscribe_run(run_id: str) -> AsyncIterator[dict[str, Any]]:
    """订阅某 run 的发布/订阅通道。

    使用 redis-py 的 pubsub.listen()，并在底层连接上启用 socket_keepalive，
    以防防火墙/代理导致的 TCP 空闲超时。
    """
    r = get_redis()
    pubsub = r.pubsub()
    try:
        # subscribe 放在 try 内：订阅失败（池耗尽）不得泄漏 pubsub/连接 —— finally 会关闭它。
        await pubsub.subscribe(_channel(run_id))
        async for msg in pubsub.listen():
            if msg["type"] == "message":
                data = msg["data"]
                if isinstance(data, str):
                    yield json.loads(data)
    finally:
        with contextlib.suppress(Exception):
            await pubsub.unsubscribe(_channel(run_id))
        with contextlib.suppress(Exception):
            await pubsub.close()


def _user_channel(user_id: str) -> str:
    return f"user:{user_id}:events"


async def publish_user_event(user_id: str, event: dict[str, Any]) -> None:
    """向用户的跨客户端事件通道发布领域事件。

    失败放行：Redis 故障绝不能中断主请求路径。
    """
    try:
        r = get_redis()
        await r.publish(_user_channel(user_id), json.dumps(event, ensure_ascii=False))
    except Exception:
        logger.debug("publish_user_event failed for %s", user_id, exc_info=True)


async def subscribe_user_events(user_id: str) -> AsyncIterator[dict[str, Any]]:
    """产出为 *user_id* 发布的领域事件。调用方取消即可停止。"""
    r = get_redis()
    pubsub = r.pubsub()
    try:
        # subscribe 放在 try 内：订阅失败（池耗尽）不得泄漏 pubsub/连接 —— finally 会关闭它。
        await pubsub.subscribe(_user_channel(user_id))
        while True:
            try:
                msg = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=None),
                    timeout=60.0,
                )
            except TimeoutError:
                continue  # 空闲保活；连接由 redis-py 做健康检查
            if msg and msg["type"] == "message":
                try:
                    yield json.loads(msg["data"])
                except (TypeError, ValueError):
                    continue
    finally:
        with contextlib.suppress(Exception):
            await pubsub.close()


# ---------------------------------------------------------------------------
# 预订阅缓冲 —— 弥合 Celery 任务启动与 WebSocket 连接之间的时间差。
# POST 处理器在返回前先订阅，使早期消息（thinking_stream）永不丢失。
# ---------------------------------------------------------------------------

_buffers: dict[str, list[dict[str, Any]]] = {}
_buffer_tasks: dict[str, asyncio.Task[Any]] = {}
_lock: asyncio.Lock = asyncio.Lock()


async def buffer_run_messages(run_id: str) -> None:
    """订阅 *run_id* 并将消息累积到内存缓冲。

    WebSocket 处理器稍后调用 :func:`drain_buffer` 回放。
    在返回前同步建立 Redis 订阅，使任何消息（尤其是早期 ``thinking_stream``
    分块）都不丢失。
    """
    buf: list[dict[str, Any]] = []
    _buffers[run_id] = buf
    logger = get_logger(__name__)

    r = get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe(f"run:{run_id}")

    async def _worker() -> None:
        try:
            # 上方的 subscribe() 已消费订阅确认，因此无需等待 "subscribe" 消息。
            # 带空闲超时监听 —— 自动清理可防止 run 结束时没有 WebSocket 连接
            # 排空缓冲而导致的缓冲泄漏。
            #
            # NOTE：get_message() 必须传 timeout=None（阻塞）。其默认 timeout=0
            # 是非阻塞的：外层 wait_for 不会触发，循环会以每秒约 10 万次空转，
            # 使整个 run 期间占满一个 CPU 核。timeout=None + wait_for 让空闲超时
            # 触发，而健康检查 PONG（同样返回 None）只是继续等待。
            while True:
                try:
                    msg = await asyncio.wait_for(
                        pubsub.get_message(ignore_subscribe_messages=True, timeout=None),
                        timeout=60.0,
                    )
                except TimeoutError:
                    logger.info("Buffer idle timeout for run %s — auto-cleanup", run_id)
                    break
                if msg and msg["type"] == "message":
                    data = msg["data"]
                    if isinstance(data, str):
                        parsed = json.loads(data)
                        logger.info(
                            "Buffer received: type=%s content_len=%d thinking_len=%d",
                            parsed.get("type"),
                            len(parsed.get("content", "")),
                            len(parsed.get("thinking", "")),
                        )
                        buf.append(parsed)
            # 超时或正常退出 —— 清理顶层引用
            _buffers.pop(run_id, None)
            _buffer_tasks.pop(run_id, None)
        except asyncio.CancelledError:
            pass
        finally:
            # 在每条退出路径（stop_buffer 取消或空闲超时）都把 pubsub 连接归还池。
            # 否则每次 run 泄漏一个 Redis 连接，池（REDIS_POOL_SIZE=20）约 20 次
            # run 后耗尽 → 后续每个 Redis 操作都报 MaxConnectionsError "Too many
            # connections"。
            with contextlib.suppress(Exception):
                await pubsub.close()

    _buffer_tasks[run_id] = asyncio.create_task(_worker())


def drain_buffer(run_id: str) -> list[dict[str, Any]]:
    """返回并清空 *run_id* 的预订阅缓冲。"""
    return _buffers.pop(run_id, [])


async def stop_buffer(run_id: str) -> None:
    """取消后台 worker 并丢弃缓冲。"""
    _buffers.pop(run_id, None)
    task = _buffer_tasks.pop(run_id, None)
    if task is not None:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
