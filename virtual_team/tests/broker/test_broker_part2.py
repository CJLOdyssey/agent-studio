"""Unit tests for virtual_team/broker.py (Redis URL parsing, pub/sub)."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest



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
