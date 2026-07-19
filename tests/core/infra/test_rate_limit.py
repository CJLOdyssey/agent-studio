"""Unit tests for rate limiting middleware (backend/core/infra/rate_limit.py)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.core.infra.rate_limit import DEFAULT_RATE, DEFAULT_WINDOW, RateLimiter


# =============================================================================
# RateLimiter — unit tests
# =============================================================================


class TestRateLimiterInit:
    def test_default_values(self):
        limiter = RateLimiter()
        assert limiter.rate == DEFAULT_RATE
        assert limiter.window == DEFAULT_WINDOW

    def test_custom_values(self):
        limiter = RateLimiter(rate=30, window_seconds=120)
        assert limiter.rate == 30
        assert limiter.window == 120


class TestRateLimiterIsAllowed:
    @pytest.mark.asyncio
    async def test_first_request_allowed(self):
        limiter = RateLimiter(rate=10)
        mock_redis = AsyncMock()
        mock_redis.incr.return_value = 1

        with patch("backend.broker.get_redis", return_value=mock_redis):
            result = await limiter.is_allowed("192.168.1.1")
            assert result is True
            mock_redis.incr.assert_called_once()
            mock_redis.expire.assert_called_once()  # first access sets expiry

    @pytest.mark.asyncio
    async def test_within_limit(self):
        limiter = RateLimiter(rate=10)
        mock_redis = AsyncMock()
        mock_redis.incr.return_value = 5

        with patch("backend.broker.get_redis", return_value=mock_redis):
            result = await limiter.is_allowed("192.168.1.1")
            assert result is True

    @pytest.mark.asyncio
    async def test_exceeds_limit(self):
        limiter = RateLimiter(rate=10)
        mock_redis = AsyncMock()
        mock_redis.incr.return_value = 11

        with patch("backend.broker.get_redis", return_value=mock_redis):
            result = await limiter.is_allowed("192.168.1.1")
            assert result is False

    @pytest.mark.asyncio
    async def test_redis_failure_fails_open(self):
        limiter = RateLimiter(rate=10)
        with patch("backend.broker.get_redis", side_effect=ConnectionError("down")):
            result = await limiter.is_allowed("192.168.1.1")
            assert result is True  # fail open

    @pytest.mark.asyncio
    async def test_different_keys_independent(self):
        """Different client IPs are tracked independently."""
        limiter = RateLimiter(rate=1)
        mock_redis = AsyncMock()
        mock_redis.incr.side_effect = [1, 1]  # Both return first request

        with patch("backend.broker.get_redis", return_value=mock_redis):
            assert await limiter.is_allowed("10.0.0.1") is True
            assert await limiter.is_allowed("10.0.0.2") is True


# =============================================================================
# RateLimitMiddleware — ASGI scope tests
# =============================================================================


class TestRateLimitMiddleware:
    async def _send_collector(self, message=None):
        """Collect send calls for assertion."""
        pass

    @pytest.mark.asyncio
    async def test_passes_non_http_scope(self):
        """WebSocket/lifespan scopes should bypass rate limiting."""
        from backend.core.infra.rate_limit import RateLimitMiddleware

        mock_app = AsyncMock()
        middleware = RateLimitMiddleware(mock_app)

        scope = {"type": "websocket"}
        receive = AsyncMock()
        send = AsyncMock()

        await middleware(scope, receive, send)
        mock_app.assert_called_once_with(scope, receive, send)

    @pytest.mark.asyncio
    async def test_exempt_health_check(self):
        """GET /api/health bypasses rate limiting."""
        from backend.core.infra.rate_limit import RateLimitMiddleware

        mock_app = AsyncMock()
        middleware = RateLimitMiddleware(mock_app)

        scope = {"type": "http", "path": "/api/health", "headers": []}
        receive = AsyncMock()
        send = AsyncMock()

        await middleware(scope, receive, send)
        mock_app.assert_called_once_with(scope, receive, send)

    @pytest.mark.asyncio
    async def test_exempt_websocket_path(self):
        """Paths starting with /ws/ bypass rate limiting."""
        from backend.core.infra.rate_limit import RateLimitMiddleware

        mock_app = AsyncMock()
        middleware = RateLimitMiddleware(mock_app)

        scope = {"type": "http", "path": "/ws/session-123", "headers": []}
        receive = AsyncMock()
        send = AsyncMock()

        await middleware(scope, receive, send)
        mock_app.assert_called_once_with(scope, receive, send)

    @pytest.mark.asyncio
    async def test_allowed_passes_through(self):
        from backend.core.infra.rate_limit import RateLimitMiddleware

        mock_app = AsyncMock()
        middleware = RateLimitMiddleware(mock_app, rate=1000)

        scope = {
            "type": "http",
            "path": "/api/agents",
            "headers": [(b"x-real-ip", b"10.0.0.1")],
            "client": ("10.0.0.1", 12345),
        }
        receive = AsyncMock()
        send = AsyncMock()

        with patch.object(middleware.limiter, "is_allowed", return_value=True):
            await middleware(scope, receive, send)
        mock_app.assert_called_once_with(scope, receive, send)

    @pytest.mark.asyncio
    async def test_rate_limited_returns_429(self):
        from backend.core.infra.rate_limit import RateLimitMiddleware

        mock_app = AsyncMock()
        middleware = RateLimitMiddleware(mock_app, rate=1)

        scope = {
            "type": "http",
            "path": "/api/agents",
            "headers": [(b"x-real-ip", b"10.0.0.1")],
            "client": ("10.0.0.1", 12345),
        }
        receive = AsyncMock()
        send = AsyncMock()

        with patch.object(middleware.limiter, "is_allowed", return_value=False):
            await middleware(scope, receive, send)

        # 429 response should have been sent
        assert send.call_count > 0
        first_call = send.call_args_list[0]
        msg = first_call[0][0]
        assert msg["type"] == "http.response.start"
        assert msg["status"] == 429
        mock_app.assert_not_called()


# =============================================================================
# IP extraction
# =============================================================================


class TestIPExtraction:
    @pytest.mark.asyncio
    async def test_extracts_from_x_forwarded_for(self):
        from backend.core.infra.rate_limit import RateLimitMiddleware

        mock_app = AsyncMock()
        middleware = RateLimitMiddleware(mock_app, rate=1000)

        scope = {
            "type": "http",
            "path": "/api/agents",
            "headers": [
                (b"x-forwarded-for", b"192.168.1.100, 10.0.0.1"),
            ],
            "client": ("127.0.0.1", 12345),
        }
        receive = AsyncMock()
        send = AsyncMock()

        with patch.object(middleware.limiter, "is_allowed") as mock_allowed:
            mock_allowed.return_value = True
            await middleware(scope, receive, send)
            mock_allowed.assert_called_once_with("192.168.1.100")

    @pytest.mark.asyncio
    async def test_extracts_from_x_real_ip(self):
        from backend.core.infra.rate_limit import RateLimitMiddleware

        mock_app = AsyncMock()
        middleware = RateLimitMiddleware(mock_app, rate=1000)

        scope = {
            "type": "http",
            "path": "/api/agents",
            "headers": [
                (b"x-real-ip", b"10.1.2.3"),
            ],
            "client": ("127.0.0.1", 12345),
        }
        receive = AsyncMock()
        send = AsyncMock()

        with patch.object(middleware.limiter, "is_allowed") as mock_allowed:
            mock_allowed.return_value = True
            await middleware(scope, receive, send)
            mock_allowed.assert_called_once_with("10.1.2.3")

    @pytest.mark.asyncio
    async def test_falls_back_to_client_addr(self):
        from backend.core.infra.rate_limit import RateLimitMiddleware

        mock_app = AsyncMock()
        middleware = RateLimitMiddleware(mock_app, rate=1000)

        scope = {
            "type": "http",
            "path": "/api/agents",
            "headers": [],
            "client": ("33.44.55.66", 12345),
        }
        receive = AsyncMock()
        send = AsyncMock()

        with patch.object(middleware.limiter, "is_allowed") as mock_allowed:
            mock_allowed.return_value = True
            await middleware(scope, receive, send)
            mock_allowed.assert_called_once_with("33.44.55.66")

    @pytest.mark.asyncio
    async def test_no_client_falls_back_to_unknown(self):
        from backend.core.infra.rate_limit import RateLimitMiddleware

        mock_app = AsyncMock()
        middleware = RateLimitMiddleware(mock_app, rate=1000)

        scope = {
            "type": "http",
            "path": "/api/agents",
            "headers": [],
        }
        receive = AsyncMock()
        send = AsyncMock()

        with patch.object(middleware.limiter, "is_allowed") as mock_allowed:
            mock_allowed.return_value = True
            await middleware(scope, receive, send)
            mock_allowed.assert_called_once_with("unknown")

    @pytest.mark.asyncio
    async def test_x_forwarded_for_priority_over_x_real_ip(self):
        """x-forwarded-for takes priority over x-real-ip."""
        from backend.core.infra.rate_limit import RateLimitMiddleware

        mock_app = AsyncMock()
        middleware = RateLimitMiddleware(mock_app, rate=1000)

        scope = {
            "type": "http",
            "path": "/api/agents",
            "headers": [
                (b"x-forwarded-for", b"1.2.3.4"),
                (b"x-real-ip", b"5.6.7.8"),
            ],
            "client": ("9.9.9.9", 12345),
        }
        receive = AsyncMock()
        send = AsyncMock()

        with patch.object(middleware.limiter, "is_allowed") as mock_allowed:
            mock_allowed.return_value = True
            await middleware(scope, receive, send)
            mock_allowed.assert_called_once_with("1.2.3.4")  # x-forwarded-for wins
