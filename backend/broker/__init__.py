"""Messaging infrastructure: Celery app + Redis pub/sub for streaming."""

import asyncio
import contextlib
import json
import os
from collections.abc import AsyncIterator
from typing import Any

from celery import Celery  # type: ignore[import-untyped]
from redis.asyncio import Redis as AsyncRedis  # noqa: F401  # re-exported for backward compat

from backend.core.infra.logging_config import get_logger

# ---------------------------------------------------------------------------
# Celery app
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

celery_app.autodiscover_tasks(["backend.tasks"])

# ---------------------------------------------------------------------------
# Redis pub/sub
# ---------------------------------------------------------------------------

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Per-event-loop connection pool — Celery prefork workers create a new event
# loop via asyncio.run() in each child process, so a single global pool bound
# to the parent's loop becomes invalid ("Event loop is closed").
_pools: dict[int, Any] = {}
CHANNEL_PREFIX = "run:"


def _channel(run_id: str) -> str:
    return f"{CHANNEL_PREFIX}{run_id}"


def get_redis() -> Any:  # returns AsyncRedis
    """Return an AsyncRedis pool for the current event loop.

    Each asyncio event loop gets its own connection pool so that Celery's
    prefork model (where every asyncio.run() call creates a fresh loop) works
    correctly.

    When REDIS_SENTINEL_ENABLED is set, creates the connection via
    Sentinel discovery; otherwise falls back to a direct REDIS_URL connection.
    """

    loop = asyncio.get_running_loop()
    loop_id = id(loop)

    pool = _pools.get(loop_id)
    if pool is None:
        from backend.core.infra.redis_sentinel import create_redis

        pool = create_redis()
        _pools[loop_id] = pool
    return pool


async def close_redis() -> None:
    """Close the Redis connection pool for the current event loop."""

    loop = asyncio.get_running_loop()
    loop_id = id(loop)
    pool = _pools.pop(loop_id, None)
    if pool is not None:
        await pool.aclose()


async def publish_run_message(run_id: str, message: dict[str, Any]) -> None:
    """Publish a message to a run's Redis pub/sub channel."""
    r = get_redis()
    await r.publish(_channel(run_id), json.dumps(message, ensure_ascii=False))


async def subscribe_run(run_id: str) -> AsyncIterator[dict[str, Any]]:
    """Subscribe to a run's pub/sub channel.

    Uses redis-py pubsub.listen() with socket_keepalive enabled on the
    underlying connection to prevent TCP idle timeouts from firewalls/proxies.
    """
    r = get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe(_channel(run_id))
    try:
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


# ---------------------------------------------------------------------------
# Pre‑subscription buffer — closes the timing gap between Celery task start
# and WebSocket connect.  The POST handler subscribes before returning so
# early messages (thinking_stream) are never lost.
# ---------------------------------------------------------------------------

_buffers: dict[str, list[dict[str, Any]]] = {}
_buffer_tasks: dict[str, asyncio.Task[Any]] = {}
_lock: asyncio.Lock = asyncio.Lock()


async def buffer_run_messages(run_id: str) -> None:
    """Subscribe to *run_id* and accumulate messages into an in-memory buffer.

    The WebSocket handler later calls :func:`drain_buffer` to replay them.
    Establishes the Redis subscription synchronously before returning so that
    no messages (especially early ``thinking_stream`` chunks) are lost.
    """
    buf: list[dict[str, Any]] = []
    _buffers[run_id] = buf
    logger = get_logger(__name__)

    r = get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe(f"run:{run_id}")

    async def _worker() -> None:
        try:
            # Wait for subscribe confirmation before entering message loop
            while True:
                init_msg = await pubsub.get_message()
                if init_msg and init_msg["type"] == "subscribe":
                    break
            # Listen with idle timeout — auto-cleanup prevents buffer leaks when
            # the run finishes without a WebSocket connection to drain it.
            while True:
                try:
                    msg = await asyncio.wait_for(
                        pubsub.get_message(ignore_subscribe_messages=True),
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
            # Timeout or normal exit — clean up top-level references
            _buffers.pop(run_id, None)
            _buffer_tasks.pop(run_id, None)
        except asyncio.CancelledError:
            pass

    _buffer_tasks[run_id] = asyncio.create_task(_worker())


def drain_buffer(run_id: str) -> list[dict[str, Any]]:
    """Return and clear the pre‑subscription buffer for *run_id*."""
    return _buffers.pop(run_id, [])


async def stop_buffer(run_id: str) -> None:
    """Cancel the background worker and discard the buffer."""
    _buffers.pop(run_id, None)
    task = _buffer_tasks.pop(run_id, None)
    if task is not None:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
