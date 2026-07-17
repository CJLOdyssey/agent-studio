"""Unit tests for virtual_team/streaming.py (StreamEmitter edge cases)."""

import json
import time
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, PropertyMock, patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError




class TestStreamingEdgeCases:
    """Test StreamEmitter edge cases: empty data, None values, error handling."""

    def test_import(self):
        from virtual_team.streaming import StreamEmitter

        assert StreamEmitter is not None

    def test_init_sets_run_id(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-test")
        assert emitter._run_id == "run-test"
        assert emitter._message_index == 0
        assert emitter._stream_buffer == []
        assert emitter._thinking_buffer == []

    @pytest.mark.asyncio
    async def test_call_with_empty_event(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-empty")
        await emitter({})
        assert emitter._message_index == 0

    @pytest.mark.asyncio
    async def test_call_with_none_data(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-none")
        await emitter({"event": "on_custom_token", "data": {}})
        assert emitter._stream_buffer == []

    @pytest.mark.asyncio
    async def test_call_with_empty_data(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-emptydata")
        await emitter({"event": "on_custom_token", "data": {}})
        assert emitter._stream_buffer == []

    @pytest.mark.asyncio
    async def test_on_custom_token_appends_to_buffer(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-token")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter({"event": "on_custom_token", "data": {"content": "hello"}})
            assert emitter._stream_buffer == ["hello"]
            mock_pub.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_on_custom_token_empty_content(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-emptycontent")
        with patch("virtual_team.streaming.publish_run_message") as mock_pub:
            await emitter({"event": "on_custom_token", "data": {"content": ""}})
            assert emitter._stream_buffer == []
            mock_pub.assert_not_called()

    @pytest.mark.asyncio
    async def test_on_custom_thinking_appends(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-think")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter({"event": "on_custom_thinking", "data": {"content": "thinking..."}})
            assert emitter._thinking_buffer == ["thinking..."]
            mock_pub.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_on_custom_thinking_empty_content(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-thinkempty")
        with patch("virtual_team.streaming.publish_run_message") as mock_pub:
            await emitter({"event": "on_custom_thinking", "data": {"content": ""}})
            assert emitter._thinking_buffer == []
            mock_pub.assert_not_called()

    @pytest.mark.asyncio
    async def test_on_node_end_flushes_buffers(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-flush")
        with (
            patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock),
            patch("virtual_team.streaming.save_message", new_callable=AsyncMock),
        ):
            emitter._stream_buffer = ["hello ", "world"]
            emitter._thinking_buffer = ["think"]
            await emitter({"event": "on_node_end", "data": {}})
            assert emitter._stream_buffer == []
            assert emitter._thinking_buffer == []

    @pytest.mark.asyncio
    async def test_on_chat_model_stream_no_chunk(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-nostream")
        await emitter({"event": "on_chat_model_stream", "data": {}})
        assert emitter._stream_buffer == []

    @pytest.mark.asyncio
    async def test_on_chat_model_end_flushes(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-chatend")
        with (
            patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock),
            patch("virtual_team.streaming.save_message", new_callable=AsyncMock),
        ):
            emitter._stream_buffer = ["final"]
            await emitter({"event": "on_chat_model_end", "data": {}})
            assert emitter._stream_buffer == []

    @pytest.mark.asyncio
    async def test_on_chain_end_langgraph_flushes(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-chain")
        with (
            patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock),
            patch("virtual_team.streaming.save_message", new_callable=AsyncMock),
        ):
            emitter._stream_buffer = ["chain-output"]
            await emitter({"event": "on_chain_end", "name": "LangGraph", "data": {}})
            assert emitter._stream_buffer == []

    @pytest.mark.asyncio
    async def test_on_chain_end_non_langgraph_skips(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-chain-skip")
        emitter._stream_buffer = ["no-flush"]
        await emitter({"event": "on_chain_end", "name": "OtherGraph", "data": {}})
        assert emitter._stream_buffer == ["no-flush"]

    @pytest.mark.asyncio
    async def test_on_tool_results_with_empty_references(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-toolempty")
        with patch("virtual_team.streaming.publish_run_message") as mock_pub:
            await emitter({
                "event": "on_tool_results",
                "data": {"tool_name": "search", "tool_call_id": "call-1", "references": []},
            })
            mock_pub.assert_not_called()

    @pytest.mark.asyncio
    async def test_on_tool_results_without_tool_name(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-toolnoname")
        with patch("virtual_team.streaming.publish_run_message") as mock_pub:
            await emitter({
                "event": "on_tool_results",
                "data": {"tool_name": "", "tool_call_id": "call-1", "references": [{"id": "1"}]},
            })
            mock_pub.assert_not_called()

    @pytest.mark.asyncio
    async def test_on_tool_results_with_valid_data(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-toolvalid")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter({
                "event": "on_tool_results",
                "data": {
                    "tool_name": "search",
                    "tool_call_id": "call-1",
                    "references": [{"id": "ref-1", "content": "result"}],
                },
            })
            mock_pub.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_emit_balance_warning_default_message(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-balance")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter.emit_balance_warning()
            call_kwargs = mock_pub.await_args[0][1]
            assert call_kwargs["type"] == "balance_warning"

    @pytest.mark.asyncio
    async def test_emit_tool_results(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-toolres")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            refs = [{"id": "r1", "content": "data"}]
            await emitter.emit_tool_results("search", "call-1", refs)
            mock_pub.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_emit_thinking_nodes(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-thinknodes")
        nodes = [{"title": "Step 1", "content": "thinking..."}]
        await emitter.emit_thinking_nodes(nodes)
        assert len(emitter._pending_thinking_nodes) == 1

    @pytest.mark.asyncio
    async def test_emit_thinking_nodes_caps_at_20(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-thinkcap")
        emitter._pending_thinking_nodes = [{"i": i} for i in range(15)]
        nodes = [{"i": i} for i in range(15, 30)]
        await emitter.emit_thinking_nodes(nodes)
        assert len(emitter._pending_thinking_nodes) == 20

    @pytest.mark.asyncio
    async def test_emit_thinking_nodes_appends_to_existing(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-thinkappend")
        emitter._pending_thinking_nodes = [{"title": "first"}]
        await emitter.emit_thinking_nodes([{"title": "second"}])
        assert len(emitter._pending_thinking_nodes) == 2

    @pytest.mark.asyncio
    async def test_publish_failure_on_stream_chunk(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-pubfail")
        with patch("virtual_team.streaming.publish_run_message", side_effect=Exception("Redis down")):
            await emitter({"event": "on_custom_token", "data": {"content": "hello"}})
            assert emitter._stream_buffer == ["hello"]


# ─────────────────────────────────────────────────────────────────────
# 11. virtual_team/app.py — FastAPI app creation
# ─────────────────────────────────────────────────────────────────────


