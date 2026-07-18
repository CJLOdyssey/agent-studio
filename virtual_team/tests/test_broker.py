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


"""Extended tests for virtual_team/broker.py — Redis connection, message formatting, buffer."""

import asyncio
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

        mock_loop.return_value = MagicMock()
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
        from virtual_team.broker import _pools, close_redis

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


class TestBrokerExtended:

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_subscribe_run_yields_messages(self, mock_get_redis):
        from virtual_team.broker import subscribe_run

        mock_redis = MagicMock()
        mock_pubsub = MagicMock()
        mock_pubsub.subscribe = AsyncMock()
        mock_pubsub.unsubscribe = AsyncMock()
        mock_pubsub.close = AsyncMock()
        mock_redis.pubsub.return_value = mock_pubsub
        mock_get_redis.return_value = mock_redis

        messages = [
            {"type": "message", "data": '{"type": "token", "content": "hello"}'},
            {"type": "message", "data": '{"type": "token", "content": "world"}'},
        ]

        async def mock_listen():
            for m in messages:
                yield m

        mock_pubsub.listen.return_value = mock_listen()

        results = []
        async for msg in subscribe_run("run-sub-1"):
            results.append(msg)
            if len(results) == 2:
                break

        assert len(results) == 2
        assert results[0]["content"] == "hello"
        assert results[1]["content"] == "world"
        mock_pubsub.subscribe.assert_awaited_once_with("run:run-sub-1")

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_subscribe_run_skips_non_message(self, mock_get_redis):
        from virtual_team.broker import subscribe_run

        mock_redis = MagicMock()
        mock_pubsub = MagicMock()
        mock_pubsub.subscribe = AsyncMock()
        mock_pubsub.unsubscribe = AsyncMock()
        mock_pubsub.close = AsyncMock()
        mock_redis.pubsub.return_value = mock_pubsub
        mock_get_redis.return_value = mock_redis

        messages = [
            {"type": "subscribe", "data": "subscribed"},
            {"type": "message", "data": '{"type": "token", "content": "hi"}'},
        ]

        async def mock_listen():
            for m in messages:
                yield m

        mock_pubsub.listen.return_value = mock_listen()

        results = []
        async for msg in subscribe_run("run-sub-2"):
            results.append(msg)
            break

        assert len(results) == 1
        assert results[0]["content"] == "hi"

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_subscribe_run_unsubscribes_on_exit(self, mock_get_redis):
        from virtual_team.broker import subscribe_run

        mock_redis = MagicMock()
        mock_pubsub = MagicMock()
        mock_pubsub.subscribe = AsyncMock()
        mock_pubsub.unsubscribe = AsyncMock()
        mock_pubsub.close = AsyncMock()
        mock_redis.pubsub.return_value = mock_pubsub
        mock_get_redis.return_value = mock_redis

        async def mock_listen():
            yield {"type": "message", "data": '{"type": "done"}'}

        mock_pubsub.listen.return_value = mock_listen()

        gen = subscribe_run("run-sub-3")
        async for _ in gen:
            break
        await gen.aclose()

        mock_pubsub.unsubscribe.assert_awaited_once_with("run:run-sub-3")
        mock_pubsub.close.assert_awaited_once()

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_buffer_run_messages_buffers_correctly(self, mock_get_redis):
        from virtual_team.broker import _buffer_tasks, _buffers, buffer_run_messages, stop_buffer

        mock_redis = MagicMock()
        mock_pubsub = MagicMock()
        mock_pubsub.subscribe = AsyncMock()
        mock_pubsub.get_message = AsyncMock()
        call_count = 0
        results_queue: list[asyncio.Future] = []

        async def controlled_get_message(*a, **kw):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {"type": "subscribe"}
            if call_count == 2:
                return {"type": "message", "data": '{"type": "token", "content": "first"}'}
            if call_count == 3:
                return {"type": "message", "data": '{"type": "token", "content": "second"}'}
            fut: asyncio.Future = asyncio.Future()
            results_queue.append(fut)
            return await fut

        mock_pubsub.get_message = AsyncMock(side_effect=controlled_get_message)
        mock_redis.pubsub.return_value = mock_pubsub
        mock_get_redis.return_value = mock_redis

        _buffers.clear()
        _buffer_tasks.clear()

        await buffer_run_messages("run-buf-ext")
        assert "run-buf-ext" in _buffers

        for _ in range(200):
            if len(_buffers.get("run-buf-ext", [])) >= 2:
                break
            await asyncio.sleep(0.005)

        from virtual_team.broker import drain_buffer
        msgs = drain_buffer("run-buf-ext")
        assert len(msgs) >= 2
        assert msgs[0]["content"] == "first"

        if results_queue:
            results_queue[0].set_exception(TimeoutError())
        await asyncio.sleep(0.05)
        await stop_buffer("run-buf-ext")

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_publish_run_message_error_type(self, mock_get_redis):
        from virtual_team.broker import publish_run_message

        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis

        msg = {"type": "error", "content": "Something broke", "code": 500}
        await publish_run_message("run-err", msg)

        mock_redis.publish.assert_awaited_once()
        published = json.loads(mock_redis.publish.call_args[0][1])
        assert published["type"] == "error"
        assert published["code"] == 500

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_publish_run_message_large_payload(self, mock_get_redis):
        from virtual_team.broker import publish_run_message

        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis

        large_content = "x" * 10000
        msg = {"type": "stream", "content": large_content}
        await publish_run_message("run-large", msg)

        mock_redis.publish.assert_awaited_once()
        published = json.loads(mock_redis.publish.call_args[0][1])
        assert len(published["content"]) == 10000

    def test_channel_uuid_format(self):
        from virtual_team.broker import _channel

        uuid_val = "550e8400-e29b-41d4-a716-446655440000"
        assert _channel(uuid_val) == f"run:{uuid_val}"

    def test_channel_numeric_id(self):
        from virtual_team.broker import _channel

        assert _channel("12345") == "run:12345"

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_stop_buffer_non_existent(self, mock_get_redis):
        from virtual_team.broker import _buffer_tasks, stop_buffer

        _buffer_tasks.clear()
        await stop_buffer("non-existent-run")

    @patch("virtual_team.broker.get_redis")
    @pytest.mark.asyncio
    async def test_subscribe_run_non_string_data(self, mock_get_redis):
        from virtual_team.broker import subscribe_run

        mock_redis = MagicMock()
        mock_pubsub = MagicMock()
        mock_pubsub.subscribe = AsyncMock()
        mock_pubsub.unsubscribe = AsyncMock()
        mock_pubsub.close = AsyncMock()
        mock_redis.pubsub.return_value = mock_pubsub
        mock_get_redis.return_value = mock_redis

        messages = [
            {"type": "message", "data": 123},
            {"type": "message", "data": '{"type": "token", "content": "ok"}'},
        ]

        async def mock_listen():
            for m in messages:
                yield m

        mock_pubsub.listen.return_value = mock_listen()

        results = []
        async for msg in subscribe_run("run-sub-bin"):
            results.append(msg)
            break

        assert len(results) == 1
        assert results[0]["content"] == "ok"
