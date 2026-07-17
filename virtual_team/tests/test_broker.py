"""Unit tests for virtual_team/broker.py (Redis URL parsing, pub/sub)."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestBrokerRedis:
    def test_redis_url_has_valid_format(self):
        """REDIS_URL should be a valid redis URL (depends on .env / env var)."""
        from virtual_team.broker import REDIS_URL

        assert REDIS_URL.startswith("redis://")
        assert "localhost" in REDIS_URL or "redis" in REDIS_URL

    def test_broker_url_default(self):
        from virtual_team.broker import BROKER_URL

        assert BROKER_URL == "redis://localhost:6379/0"

    def test_channel_format(self):
        from virtual_team.broker import _channel

        assert _channel("run-abc") == "run:run-abc"

    @patch("virtual_team.broker.AsyncRedis.from_url")
    @patch("virtual_team.broker.asyncio.get_running_loop")
    def test_get_redis_creates_pool(self, mock_loop, mock_from_url):
        mock_loop.return_value = loop = MagicMock()
        loop_id = id(loop)
        mock_redis = MagicMock()
        mock_from_url.return_value = mock_redis

        # Clean up any existing pools
        from virtual_team.broker import REDIS_URL, _pools

        _pools.clear()

        from virtual_team.broker import get_redis

        result = get_redis()
        mock_from_url.assert_called_once_with(
            REDIS_URL,
            decode_responses=True,
            socket_keepalive=True,
            socket_connect_timeout=10,
            health_check_interval=30,
            retry_on_timeout=True,
        )
        assert result == mock_redis
        assert _pools[loop_id] == mock_redis

    @patch("virtual_team.broker.AsyncRedis.from_url")
    @patch("virtual_team.broker.asyncio.get_running_loop")
    def test_get_redis_reuses_pool(self, mock_loop, mock_from_url):
        mock_loop.return_value = loop = MagicMock()
        loop_id = id(loop)
        mock_redis = MagicMock()
        mock_from_url.return_value = mock_redis

        from virtual_team.broker import _pools, get_redis

        _pools.clear()
        _pools[loop_id] = existing = MagicMock()
        result = get_redis()
        assert result == existing
        mock_from_url.assert_not_called()

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_publish_run_message(self, mock_get_redis):
        from virtual_team.broker import publish_run_message

        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis

        msg = {"type": "text", "content": "hello"}
        await publish_run_message("run-123", msg)

        mock_redis.publish.assert_awaited_once_with(
            "run:run-123", json.dumps(msg, ensure_ascii=False)
        )

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_close_redis(self, mock_get_redis):
        from virtual_team.broker import close_redis

        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis

        from virtual_team.broker import _pools

        _pools.clear()
        loop = MagicMock()
        _pools[id(loop)] = mock_redis

        with patch("virtual_team.broker.asyncio.get_running_loop", return_value=loop):
            await close_redis()
            mock_redis.aclose.assert_awaited_once()
            assert id(loop) not in _pools


# ─────────────────────────────────────────────────────────────────────
# 3. virtual_team/auth_jwt.py — JWT creation & verification
# ─────────────────────────────────────────────────────────────────────


