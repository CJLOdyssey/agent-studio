import json
import os
from typing import AsyncIterator

from redis.asyncio import Redis as AsyncRedis

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

_pool: AsyncRedis | None = None


def get_redis() -> AsyncRedis:
    global _pool
    if _pool is None:
        _pool = AsyncRedis.from_url(REDIS_URL, decode_responses=True)
    return _pool


async def close_redis():
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None


CHANNEL_PREFIX = "run:"


def _channel(run_id: str) -> str:
    return f"{CHANNEL_PREFIX}{run_id}"


async def publish_run_message(run_id: str, message: dict):
    r = get_redis()
    await r.publish(_channel(run_id), json.dumps(message, ensure_ascii=False))


async def subscribe_run(run_id: str) -> AsyncIterator[dict]:
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
        await pubsub.unsubscribe(_channel(run_id))
        await pubsub.close()
