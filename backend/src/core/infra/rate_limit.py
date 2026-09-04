"""基于 Redis 的滑动窗口（分桶）算法限流中间件。

支持按 IP 以及可选的按用户限流。
"""

import os
import time
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)

# 与 auth_rbac.AUTH_ENABLED 同源：认证启用时 X-User-ID 头不可信（可伪造），
# 不参与 per-user 限流桶（否则攻击者可填满受害者桶 / 轮换头建无限桶）。
AUTH_ENABLED = os.environ.get("AUTH_ENABLED", "0") == "1"

# 默认：每 IP 每 60 秒 60 次请求
DEFAULT_RATE = 60
DEFAULT_WINDOW = 60
# 滑动窗口分桶粒度：窗口按该大小拆分为桶；一次请求计入当前桶与前一桶之和，
# 使固定窗口边界处的突发不再免费（Open WebUI 同款）。
DEFAULT_BUCKET_SIZE = 10


class RateLimiter:
    """基于 Redis 的滑动窗口限流器。

    窗口被划分为 ``window // bucket_size`` 个固定桶加当前桶。每次请求递增其
    所在桶（TTL = window + bucket），仅当窗口内各桶计数之和不超过 ``rate``
    时放行。分桶限制了内存占用（每桶一个 key，而非每请求一个），同时仍能平滑
    边界突发。

    作为 FastAPI 中间件使用：
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
        """检查由 ``key`` 标识的请求是否在限流范围内。

        参数：
            key: 唯一标识（客户端 IP、用户 ID 等）。
            rate_override: 可选的单次检查速率上限（覆盖实例默认值）。

        """
        try:
            from broker import get_redis

            r = get_redis()
            now_bucket = self._current_bucket()
            limit = rate_override if rate_override is not None else self.rate

            # 递增当前桶（TTL 覆盖整个窗口，桶离开窗口后不再计数）。
            bucket_key = self._bucket_key(key, now_bucket)
            count = await r.incr(bucket_key)
            if count == 1:
                await r.expire(bucket_key, self.window + self.bucket_size)

            # 对当前桶与窗口内前一桶的计数求和 ——
            # 靠近桶边界的请求仍能看到前一桶的请求，堵住固定窗口的突发漏洞。
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
    """若存在，从 X-User-ID 响应头提取用户 ID。

    仅在认证禁用（legacy/guest 模式，此时该响应头是 guest 数据命名空间）时可信。
    认证启用时该响应头由客户端控制，不得据此创建按用户限流桶。
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
    """应用按 IP 与可选按用户限流的 ASGI 中间件。

    中间件对每个请求检查基于 IP 的限制。若配置了 ``user_rate`` 且请求携带
    ``X-User-ID`` 响应头，则额外应用独立的按用户限制。任一检查失败即返回 429。
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

        # 跳过健康检查与 WebSocket 升级请求
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
