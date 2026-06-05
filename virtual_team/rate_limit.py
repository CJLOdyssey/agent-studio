"""Rate limiting middleware using token-bucket algorithm backed by Redis.

Provides two-tier rate limiting:
  1. Redis-backed (shared across instances) — primary
  2. In-memory token bucket (local fallback) — when Redis is unavailable
"""

import threading
import time

from virtual_team.broker import get_redis
from virtual_team.logging_config import get_logger

logger = get_logger(__name__)

# Default: 60 requests per 60 seconds per IP
DEFAULT_RATE = 60
DEFAULT_WINDOW = 60


class MemoryTokenBucket:
    """Thread-safe in-memory token bucket fallback when Redis is unavailable.

    Uses a sliding-window counter per key. Trade-offs:
      - Not shared across instances (per-process only)
      - Approximate (not as precise as Redis INCR/EXPIRE)
      - Survives Redis outages without rate limit bypass
    """

    def __init__(self, rate: int = DEFAULT_RATE, window: int = DEFAULT_WINDOW):
        self.rate = rate
        self.window = window
        self._buckets: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            timestamps = self._buckets.get(key, [])
            cutoff = now - self.window
            timestamps = [t for t in timestamps if t > cutoff]
            if len(timestamps) >= self.rate:
                self._buckets[key] = timestamps
                return False
            timestamps.append(now)
            self._buckets[key] = timestamps
            return True


class RateLimiter:
    """Token-bucket rate limiter backed by Redis with in-memory fallback.

    Usage as FastAPI middleware:
        app.add_middleware(RateLimitMiddleware, rate=60, window_seconds=60)
    """

    def __init__(self, rate: int = DEFAULT_RATE, window_seconds: int = DEFAULT_WINDOW):
        self.rate = rate
        self.window = window_seconds
        self._memory_fallback = MemoryTokenBucket(rate=rate, window=window_seconds)

    async def is_allowed(self, key: str) -> bool:
        """Check if request identified by `key` is within the rate limit."""
        try:
            r = get_redis()
            current = int(time.time())
            window_key = f"ratelimit:{key}:{current // self.window}"

            count = await r.incr(window_key)
            if count == 1:
                await r.expire(window_key, self.window + 1)

            return count <= self.rate
        except Exception:
            logger.warning("Rate limiter Redis unavailable — falling back to in-memory bucket for key=%s", key)
            return self._memory_fallback.is_allowed(key)


_rate_limiter = RateLimiter()


class RateLimitMiddleware:
    """FastAPI middleware that applies per-IP rate limiting to API routes."""

    def __init__(self, app, rate: int = DEFAULT_RATE, window_seconds: int = DEFAULT_WINDOW):
        self.app = app
        self.limiter = RateLimiter(rate=rate, window_seconds=window_seconds)
        self._exempt_paths = {"/api/health", "/ws/"}

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        # Skip health checks and WebSocket upgrade requests
        if path == "/api/health" or path.startswith("/ws/"):
            await self.app(scope, receive, send)
            return

        # Extract client IP
        client_ip = None
        for header_name, header_value in scope.get("headers", []):
            if header_name == b"x-forwarded-for":
                client_ip = header_value.decode("utf-8").split(",")[0].strip()
                break
            elif header_name == b"x-real-ip":
                client_ip = header_value.decode("utf-8")
                break
        if not client_ip:
            client_ip = scope.get("client", ("unknown", 0))[0]

        allowed = await self.limiter.is_allowed(client_ip)
        if not allowed:
            response = await self._rate_limited_response(scope, receive, send)
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)

    async def _rate_limited_response(self, scope, receive, send):
        from starlette.responses import JSONResponse
        response = JSONResponse(
            status_code=429,
            content={"detail": "请求过于频繁，请稍后再试"},
        )
        return response
