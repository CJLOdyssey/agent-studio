"""Rate limiting middleware using a sliding-window (bucketed) algorithm backed by Redis.

Supports per-IP and optional per-user rate limiting.
"""

import os
import time
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)

# 与 auth_rbac.AUTH_ENABLED 同源：认证启用时 X-User-ID 头不可信（可伪造），
# 不参与 per-user 限流桶（否则攻击者可填满受害者桶 / 轮换头建无限桶）。
AUTH_ENABLED = os.environ.get("AUTH_ENABLED", "0") == "1"

# Default: 60 requests per 60 seconds per IP
DEFAULT_RATE = 60
DEFAULT_WINDOW = 60
# Sliding-window bucket resolution: the window is split into buckets of this
# size; a request counts against the sum of the current and preceding buckets,
# so bursts at a fixed-window boundary are no longer free (Open WebUI 同款).
DEFAULT_BUCKET_SIZE = 10


class RateLimiter:
    """Sliding-window rate limiter backed by Redis.

    The window is divided into ``window // bucket_size`` fixed buckets plus
    the current one. Each request increments its bucket (TTL = window +
    bucket) and is allowed iff the summed count across the in-window buckets
    stays within ``rate``. Bucketing bounds memory (one key per bucket, not
    per request) while still smoothing boundary bursts.

    Usage as FastAPI middleware:
        app.add_middleware(RateLimitMiddleware, rate=60, window_seconds=60)
    """

    def __init__(
        self,
        rate: int = DEFAULT_RATE,
        window_seconds: int = DEFAULT_WINDOW,
        bucket_size: int = DEFAULT_BUCKET_SIZE,
    ):
        self.rate = rate
        self.window = window_seconds
        self.bucket_size = max(1, bucket_size)
        self._num_buckets = max(1, window_seconds // self.bucket_size)

    def _bucket_key(self, key: str, bucket_index: int) -> str:
        return f"ratelimit:{key}:{bucket_index}"

    def _current_bucket(self) -> int:
        return int(time.time()) // self.bucket_size

    async def is_allowed(self, key: str, rate_override: int | None = None) -> bool:
        """Check if request identified by ``key`` is within the rate limit.

        Args:
            key: Unique identifier (client IP, user ID, etc.).
            rate_override: Optional per-check rate cap (overrides instance default).

        """
        try:
            from broker import get_redis

            r = get_redis()
            now_bucket = self._current_bucket()
            limit = rate_override if rate_override is not None else self.rate

            # Increment the current bucket (TTL covers the full window so a
            # bucket never counts after it leaves the window).
            bucket_key = self._bucket_key(key, now_bucket)
            count = await r.incr(bucket_key)
            if count == 1:
                await r.expire(bucket_key, self.window + self.bucket_size)

            # Sum counts across the current and preceding in-window buckets —
            # a request near a bucket boundary still sees requests from the
            # previous bucket, closing the fixed-window burst hole.
            window_keys = [
                self._bucket_key(key, now_bucket - i)
                for i in range(self._num_buckets + 1)
            ]
            values = await r.mget(window_keys)
            total = sum(int(v) for v in values if v)

            return bool(total <= limit)
        except Exception:
            logger.warning("Rate limiter Redis check failed — allowing request")
            return True


_rate_limiter = RateLimiter()


def _extract_client_ip(scope: dict[str, Any]) -> str:
    for header_name, header_value in scope.get("headers", []):
        if isinstance(header_name, bytes) and isinstance(header_value, bytes):
            if header_name == b"x-forwarded-for":
                return header_value.decode("utf-8").split(",")[0].strip()
            if header_name == b"x-real-ip":
                return header_value.decode("utf-8")
    return str(scope.get("client", ("unknown", 0))[0])


def _extract_user_id(scope: dict[str, Any]) -> str | None:
    """Extract user ID from the X-User-ID header if present.

    Only trusted when auth is disabled (legacy/guest mode, where the header is a
    guest-data namespace). When auth is enabled the header is client-controlled
    and must not create per-user rate-limit buckets.
    """
    if AUTH_ENABLED:
        return None
    for header_name, header_value in scope.get("headers", []):
        if isinstance(header_name, bytes) and isinstance(header_value, bytes) and header_name == b"x-user-id":
            uid = header_value.decode("utf-8").strip()
            if uid and uid != "anonymous":
                return uid
    return None


class RateLimitMiddleware:
    """ASGI middleware that applies per-IP and optional per-user rate limiting.

    The middleware checks IP-based limits on every request. If a ``user_rate``
    is configured and the request carries an ``X-User-ID`` header, a separate
    per-user limit is also applied.  Either check failing produces a 429.
    """

    def __init__(
        self,
        app: Any,
        rate: int = DEFAULT_RATE,
        window_seconds: int = DEFAULT_WINDOW,
        user_rate: int | None = None,
    ) -> None:
        self.app = app
        self.limiter = RateLimiter(rate=rate, window_seconds=window_seconds)
        self.user_rate = user_rate
        self._exempt_paths = {"/api/health", "/api/ws/"}

    async def __call__(self, scope: Any, receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        # Skip health checks and WebSocket upgrade requests
        if path == "/api/health" or path.startswith("/api/ws/"):
            await self.app(scope, receive, send)
            return

        client_ip = _extract_client_ip(scope)
        ip_allowed = await self.limiter.is_allowed(f"ip:{client_ip}")
        if not ip_allowed:
            logger.warning(
                "Rate limit hit | client=%s | rate=%d/%ds | path=%s",
                client_ip, self.limiter.rate, self.limiter.window, path,
            )
            response = self._rate_limited_response()
            await response(scope, receive, send)
            return

        if self.user_rate is not None:
            user_id = _extract_user_id(scope)
            if user_id:
                user_allowed = await self.limiter.is_allowed(
                    f"user:{user_id}", rate_override=self.user_rate,
                )
                if not user_allowed:
                    logger.warning(
                        "Rate limit hit | user=%s | rate=%d/%ds | path=%s",
                        user_id, self.user_rate, self.limiter.window, path,
                    )
                    response = self._rate_limited_response()
                    await response(scope, receive, send)
                    return

        await self.app(scope, receive, send)

    def _rate_limited_response(self) -> Any:
        from starlette.responses import JSONResponse

        return JSONResponse(
            status_code=429,
            content={"detail": "请求过于频繁，请稍后再试"},
        )
