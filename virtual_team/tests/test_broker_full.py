"""Extended tests for virtual_team/broker.py — Redis connection, message formatting, buffer."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestBrokerFull:
    def test_broker_url_default_value(self):
        from virtual_team.broker import BROKER_URL
        assert BROKER_URL == "redis://localhost:6379/0"

    def test_result_backend_default_value(self):
        from virtual_team.broker import RESULT_BACKEND
        assert RESULT_BACKEND == "redis://localhost:6379/0"

    def test_channel_prefix(self):
        from virtual_team.broker import CHANNEL_PREFIX
        assert CHANNEL_PREFIX == "run:"

    def test_channel_format(self):
        from virtual_team.broker import _channel
        assert _channel("abc-123") == "run:abc-123"
        assert _channel("") == "run:"

    @patch("virtual_team.broker.REDIS_URL", "redis://custom-host:7777/5")
    @patch("virtual_team.broker.AsyncRedis.from_url")
    @patch("virtual_team.broker.asyncio.get_running_loop")
    def test_get_redis_uses_correct_url(self, mock_loop, mock_from_url):
        from virtual_team.broker import _pools, get_redis

        mock_loop.return_value = loop = MagicMock()
        mock_redis = MagicMock()
        mock_from_url.return_value = mock_redis
        _pools.clear()

        with patch("virtual_team.broker.REDIS_URL", "redis://custom-host:7777/5"):
            result = get_redis()
            mock_from_url.assert_called_once_with(
                "redis://custom-host:7777/5",
                decode_responses=True,
                socket_keepalive=True,
                socket_connect_timeout=10,
                health_check_interval=30,
                retry_on_timeout=True,
            )
            assert result == mock_redis

    @patch("virtual_team.broker.AsyncRedis.from_url")
    @patch("virtual_team.broker.asyncio.get_running_loop")
    def test_get_redis_creates_pool_on_new_loop(self, mock_loop, mock_from_url):
        from virtual_team.broker import _pools, get_redis

        loop1 = MagicMock()
        loop2 = MagicMock()
        redis1 = MagicMock()
        redis2 = MagicMock()
        mock_from_url.side_effect = [redis1, redis2]
        _pools.clear()

        mock_loop.return_value = loop1
        pool1 = get_redis()

        mock_loop.return_value = loop2
        pool2 = get_redis()

        assert pool1 is redis1
        assert pool2 is redis2
        assert pool1 is not pool2
        assert mock_from_url.call_count == 2

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_publish_run_message_structure(self, mock_get_redis):
        from virtual_team.broker import publish_run_message

        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis

        msg = {"type": "test", "content": "hello"}
        await publish_run_message("run-xyz", msg)

        mock_redis.publish.assert_awaited_once_with(
            "run:run-xyz",
            json.dumps(msg, ensure_ascii=False),
        )

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_publish_run_message_with_chinese(self, mock_get_redis):
        from virtual_team.broker import publish_run_message

        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis

        msg = {"type": "stream", "content": "你好世界"}
        await publish_run_message("run-cn", msg)

        mock_redis.publish.assert_awaited_once()
        published = json.loads(mock_redis.publish.call_args[0][1])
        assert published["content"] == "你好世界"

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_publish_run_message_empty_content(self, mock_get_redis):
        from virtual_team.broker import publish_run_message

        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis

        await publish_run_message("run-empty", {"content": ""})
        mock_redis.publish.assert_awaited_once()

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_close_redis_removes_pool(self, mock_get_redis):
        from virtual_team.broker import _pools, close_redis, get_redis

        loop = MagicMock()
        loop_id = id(loop)
        mock_pool = AsyncMock()
        _pools[loop_id] = mock_pool

        with patch("virtual_team.broker.asyncio.get_running_loop", return_value=loop):
            await close_redis()
            assert loop_id not in _pools
            mock_pool.aclose.assert_awaited_once()

    def test_celery_app_config(self):
        from virtual_team.broker import celery_app

        assert celery_app.main == "virtual_team"
        assert celery_app.conf.task_serializer == "json"
        assert celery_app.conf.task_track_started is True
        assert celery_app.conf.task_acks_late is True

    def test_drain_buffer(self):
        from virtual_team.broker import _buffers, drain_buffer

        _buffers["run-buf"] = [{"type": "test"}]
        result = drain_buffer("run-buf")
        assert result == [{"type": "test"}]
        assert "run-buf" not in _buffers

    def test_drain_buffer_non_existent(self):
        from virtual_team.broker import drain_buffer

        result = drain_buffer("non-existent")
        assert result == []

    @pytest.mark.asyncio
    async def test_stop_buffer_cancels_task(self):
        import asyncio

        from virtual_team.broker import _buffer_tasks, stop_buffer

        async def cancelled_coro():
            raise asyncio.CancelledError()

        real_task = asyncio.create_task(cancelled_coro())
        _buffer_tasks["run-stop"] = real_task

        await stop_buffer("run-stop")
        assert "run-stop" not in _buffer_tasks

    def test_channel_with_special_chars(self):
        from virtual_team.broker import _channel

        assert _channel("run-123_abc") == "run:run-123_abc"
        assert _channel("run/test") == "run:run/test"

    @patch("virtual_team.broker.AsyncRedis.from_url")
    @patch("virtual_team.broker.asyncio.get_running_loop")
    def test_get_redis_raises_on_no_loop(self, mock_loop, mock_from_url):
        from virtual_team.broker import _pools, get_redis

        mock_loop.side_effect = RuntimeError("No loop")
        _pools.clear()
        with pytest.raises(RuntimeError):
            get_redis()

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_publish_run_message_with_thinking_type(self, mock_get_redis):
        from virtual_team.broker import publish_run_message

        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis

        msg = {"type": "thinking_stream", "agent_name": "Agent", "content": "思考中"}
        await publish_run_message("run-think", msg)

        mock_redis.publish.assert_awaited_once()
        published = json.loads(mock_redis.publish.call_args[0][1])
        assert published["type"] == "thinking_stream"
        assert published["content"] == "思考中"

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_publish_run_message_balance_warning(self, mock_get_redis):
        from virtual_team.broker import publish_run_message

        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis

        msg = {"type": "balance_warning", "agent_name": "System", "content": "余额不足"}
        await publish_run_message("run-bal", msg)

        mock_redis.publish.assert_awaited_once()
        published = json.loads(mock_redis.publish.call_args[0][1])
        assert published["type"] == "balance_warning"

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_publish_run_message_tool_complete(self, mock_get_redis):
        from virtual_team.broker import publish_run_message

        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis

        msg = {"type": "tool_complete", "agent_name": "Agent", "node": {}}
        await publish_run_message("run-tc", msg)

        mock_redis.publish.assert_awaited_once()
        published = json.loads(mock_redis.publish.call_args[0][1])
        assert published["type"] == "tool_complete"

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_publish_run_message_client_action(self, mock_get_redis):
        from virtual_team.broker import publish_run_message

        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis

        msg = {"type": "client_action", "agent_name": "Agent", "action": {"type": "click"}}
        await publish_run_message("run-ca", msg)

        published = json.loads(mock_redis.publish.call_args[0][1])
        assert published["type"] == "client_action"
        assert published["action"] == {"type": "click"}

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_buffer_run_messages_starts_task(self, mock_get_redis):
        import asyncio

        from virtual_team.broker import _buffer_tasks, _buffers, buffer_run_messages

        mock_redis = MagicMock()
        mock_pubsub = MagicMock()
        mock_pubsub.subscribe = AsyncMock()
        mock_pubsub.get_message = AsyncMock()
        mock_pubsub.get_message.return_value = {"type": "subscribe"}
        mock_redis.pubsub.return_value = mock_pubsub
        mock_get_redis.return_value = mock_redis

        _buffers.clear()
        _buffer_tasks.clear()

        await buffer_run_messages("run-buf-task")
        assert "run-buf-task" in _buffer_tasks
        assert "run-buf-task" in _buffers
        mock_pubsub.subscribe.assert_awaited_once_with("run:run-buf-task")

        from virtual_team.broker import stop_buffer
        await stop_buffer("run-buf-task")
