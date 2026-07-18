"""Unit tests for virtual_team/streaming.py (StreamEmitter edge cases)."""

from unittest.mock import AsyncMock, patch

import pytest



class TestStreamEmitterFull:
    def test_import(self):
        from virtual_team.streaming import StreamEmitter
        assert StreamEmitter is not None

    @pytest.mark.asyncio
    async def test_on_thinking_nodes_empty_list(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-think-empty")
        await emitter({"event": "on_thinking_nodes", "data": {"nodes": []}})
        assert emitter._pending_thinking_nodes is None

    @pytest.mark.asyncio
    async def test_on_thinking_nodes_with_data(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-think-data")
        nodes = [{"id": "n1", "content": "thinking text"}]
        await emitter({"event": "on_thinking_nodes", "data": {"nodes": nodes}})
        assert emitter._pending_thinking_nodes == nodes

    @pytest.mark.asyncio
    async def test_on_thinking_nodes_accumulates(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-think-acc")
        nodes1 = [{"id": "n1"}]
        nodes2 = [{"id": "n2"}]
        await emitter({"event": "on_thinking_nodes", "data": {"nodes": nodes1}})
        await emitter({"event": "on_thinking_nodes", "data": {"nodes": nodes2}})
        assert emitter._pending_thinking_nodes == [{"id": "n1"}, {"id": "n2"}]

    @pytest.mark.asyncio
    async def test_on_thinking_nodes_respects_max_pending(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-think-max")
        many_nodes = [{"id": f"n{i}"} for i in range(30)]
        await emitter({"event": "on_thinking_nodes", "data": {"nodes": many_nodes}})
        assert len(emitter._pending_thinking_nodes) == 20

    @pytest.mark.asyncio
    async def test_emit_balance_warning_default_message(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-balance")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter.emit_balance_warning()
            mock_pub.assert_awaited_once_with(
                "run-balance",
                {
                    "type": "balance_warning",
                    "agent_name": "System",
                    "content": "模型余额不足，请检查 API Key 配置",
                },
            )

    @pytest.mark.asyncio
    async def test_emit_balance_warning_custom_message(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-balance-custom")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter.emit_balance_warning("自定义余额不足提醒")
            mock_pub.assert_awaited_once_with(
                "run-balance-custom",
                {
                    "type": "balance_warning",
                    "agent_name": "System",
                    "content": "自定义余额不足提醒",
                },
            )

    @pytest.mark.asyncio
    async def test_call_on_tool_start(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-tool-start")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter({
                "event": "on_tool_start",
                "name": "web_search",
                "data": {"input": "test query"},
            })
            mock_pub.assert_awaited_once()
            args = mock_pub.call_args[0]
            assert args[0] == "run-tool-start"
            assert "调用工具" in args[1]["content"]
            assert "web_search" in args[1]["content"]

    @pytest.mark.asyncio
    async def test_call_on_tool_end(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-tool-end")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter({
                "event": "on_tool_end",
                "name": "calculator",
                "data": {"output": "42"},
            })
            mock_pub.assert_awaited_once()
            args = mock_pub.call_args[0]
            assert args[0] == "run-tool-end"
            assert "calculator" in args[1]["content"]
            assert "42" in args[1]["content"]

    @pytest.mark.asyncio
    async def test_call_on_tool_end_truncates_long_output(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-tool-long")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            long_output = "x" * 1000
            await emitter({
                "event": "on_tool_end",
                "name": "long_tool",
                "data": {"output": long_output},
            })
            mock_pub.assert_awaited_once()
            content = mock_pub.call_args[0][1]["content"]
            assert len(content) < 600

    @pytest.mark.asyncio
    async def test_call_on_client_action(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-client-action")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter({
                "event": "on_client_action",
                "data": {"action": {"type": "click", "target": "#btn"}},
            })
            mock_pub.assert_awaited_once_with(
                "run-client-action",
                {
                    "type": "client_action",
                    "agent_name": "Agent",
                    "action": {"type": "click", "target": "#btn"},
                },
            )

    @pytest.mark.asyncio
    async def test_flush_buffers_sends_thinking_done(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-flush-thinking")
        emitter._thinking_buffer = ["思考中..."]
        emitter._stream_buffer = ["Hello"]
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            with patch("virtual_team.streaming.save_message", new_callable=AsyncMock) as mock_save:
                await emitter._flush_buffers()
                calls = mock_pub.call_args_list
                thinking_done_call = next(
                    (c for c in calls if c[0][1].get("type") == "thinking_done"), None
                )
                assert thinking_done_call is not None
                assert thinking_done_call[0][1]["thinking"] == "思考中..."
                mock_save.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_flush_buffers_with_pending_thinking_nodes(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-flush-nodes")
        emitter._thinking_buffer = ["思考"]
        emitter._stream_buffer = ["Hello"]
        emitter._pending_thinking_nodes = [{"id": "n1"}]
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock):
            with patch("virtual_team.streaming.save_message", new_callable=AsyncMock):
                await emitter._flush_buffers()
                assert emitter._pending_thinking_nodes is None

    @pytest.mark.asyncio
    async def test_flush_buffers_no_content(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-flush-empty")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter._flush_buffers()
            for call in mock_pub.call_args_list:
                assert call[0][1].get("type") != "message"

    @pytest.mark.asyncio
    async def test_on_custom_thinking(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-thinking")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter({"event": "on_custom_thinking", "data": {"content": "deep thought"}})
            assert emitter._thinking_buffer == ["deep thought"]
            mock_pub.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_on_node_end_triggers_flush(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-node-end")
        emitter._stream_buffer = ["buffered"]
        emitter._thinking_buffer = ["thought"]
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock):
            with patch("virtual_team.streaming.save_message", new_callable=AsyncMock) as mock_save:
                await emitter({"event": "on_node_end", "data": {}})
                mock_save.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_on_chain_end_langgraph_triggers_flush(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-chain-end")
        emitter._stream_buffer = ["final"]
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock):
            with patch("virtual_team.streaming.save_message", new_callable=AsyncMock) as mock_save:
                await emitter({"event": "on_chain_end", "name": "LangGraph", "data": {}})
                mock_save.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_on_chain_end_other_name_does_not_flush(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-other-chain")
        emitter._stream_buffer = ["data"]
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter({"event": "on_chain_end", "name": "OtherGraph", "data": {}})
            msg_calls = [c for c in mock_pub.call_args_list if c[0][1].get("type") == "message"]
            assert len(msg_calls) == 0

    @pytest.mark.asyncio
    async def test_emit_tool_results_empty_references(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-tool-refs-empty")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter.emit_tool_results("search", "call-1", [])
            mock_pub.assert_awaited_once_with(
                "run-tool-refs-empty",
                {
                    "type": "tool_results",
                    "agent_name": "Agent",
                    "toolName": "search",
                    "tool_call_id": "call-1",
                    "references": [],
                },
            )

    @pytest.mark.asyncio
    async def test_emit_tool_results_with_references(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-tool-refs")
        refs = [{"url": "https://example.com", "title": "Example"}]
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter.emit_tool_results("web", "call-2", refs)
            mock_pub.assert_awaited_once_with(
                "run-tool-refs",
                {
                    "type": "tool_results",
                    "agent_name": "Agent",
                    "toolName": "web",
                    "tool_call_id": "call-2",
                    "references": refs,
                },
            )

    @pytest.mark.asyncio
    async def test_emit_tool_complete_success(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-tc-success")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter.emit_tool_complete({"toolName": "search", "status": "success"})
            mock_pub.assert_awaited_once()
            args = mock_pub.call_args[0]
            assert args[0] == "run-tc-success"
            assert args[1]["type"] == "tool_complete"
            assert "✅ 成功" in args[1]["node"]["content"]

    @pytest.mark.asyncio
    async def test_emit_tool_complete_failure(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-tc-fail")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter.emit_tool_complete({"toolName": "calculator", "status": "failed"})
            mock_pub.assert_awaited_once()
            args = mock_pub.call_args[0]
            assert args[1]["node"]["toolName"] == "calculator"
            assert "❌ 失败" in args[1]["node"]["content"]

    @pytest.mark.asyncio
    async def test_emit_tool_complete_default_status(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-tc-default")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter.emit_tool_complete({"toolName": "test", "status": "success"})
            mock_pub.assert_awaited_once()
            assert "✅ 成功" in mock_pub.call_args[0][1]["node"]["content"]

    @pytest.mark.asyncio
    async def test_emit_tool_complete_empty_data(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-tc-empty")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter.emit_tool_complete({})
            mock_pub.assert_awaited_once()
            assert mock_pub.call_args[0][1]["node"]["toolName"] == ""

    @pytest.mark.asyncio
    async def test_flush_buffers_with_content_only(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-flush-content")
        emitter._stream_buffer = ["Hello", " World"]
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            with patch("virtual_team.streaming.save_message", new_callable=AsyncMock) as mock_save:
                await emitter._flush_buffers()
                assert emitter._stream_buffer == []
                assert emitter._message_index == 1
                mock_save.assert_awaited_once()
                msg_call = next(c for c in mock_pub.call_args_list if c[0][1].get("type") == "message")
                assert msg_call[0][1]["content"] == "Hello World"

    @pytest.mark.asyncio
    async def test_flush_buffers_thinking_only(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-flush-thinking-only")
        emitter._thinking_buffer = ["deep ", "thought"]
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            with patch("virtual_team.streaming.save_message", new_callable=AsyncMock):
                await emitter._flush_buffers()
                assert emitter._thinking_buffer == []
                td_call = next(c for c in mock_pub.call_args_list if c[0][1].get("type") == "thinking_done")
                assert td_call[0][1]["thinking"] == "deep thought"

    @pytest.mark.asyncio
    async def test_on_chat_model_stream(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-cms")
        mock_chunk = MagicMock()
        mock_chunk.content = "streamed content"
        await emitter({"event": "on_chat_model_stream", "data": {"chunk": mock_chunk}})
        assert emitter._stream_buffer == ["streamed content"]

    @pytest.mark.asyncio
    async def test_on_chat_model_stream_empty_chunk(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-cms-empty")
        mock_chunk = MagicMock()
        mock_chunk.content = ""
        await emitter({"event": "on_chat_model_stream", "data": {"chunk": mock_chunk}})
        assert emitter._stream_buffer == []

    @pytest.mark.asyncio
    async def test_on_chat_model_end_triggers_flush(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-cme")
        emitter._stream_buffer = ["final text"]
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock):
            with patch("virtual_team.streaming.save_message", new_callable=AsyncMock) as mock_save:
                await emitter({"event": "on_chat_model_end", "data": {}})
                mock_save.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_emit_with_pending_thinking(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-emit-pending")
        emitter._pending_thinking = "pending thought"
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            with patch("virtual_team.streaming.save_message", new_callable=AsyncMock):
                await emitter._emit("Agent", "hello")
                mock_pub.assert_awaited_once()
                args = mock_pub.call_args[0]
                assert args[1]["content"] == "hello"
                assert args[1]["thinking"] == "pending thought"
                assert emitter._pending_thinking is None

    @pytest.mark.asyncio
    async def test_emit_with_non_message_type(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-emit-nonmsg")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            with patch("virtual_team.streaming.save_message", new_callable=AsyncMock) as mock_save:
                await emitter._emit("System", "status update", msg_type="status")
                mock_pub.assert_awaited_once()
                mock_save.assert_not_called()

    @pytest.mark.asyncio
    async def test_on_tool_complete_event(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-tool-complete-ev")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter({
                "event": "on_tool_complete",
                "data": {"toolName": "search", "status": "success"},
            })
            mock_pub.assert_awaited_once()
            assert mock_pub.call_args[0][1]["type"] == "tool_complete"

    @pytest.mark.asyncio
    async def test_call_on_tool_results_with_data(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-call-tool-res")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter({
                "event": "on_tool_results",
                "data": {
                    "tool_name": "search",
                    "tool_call_id": "cid",
                    "references": [{"url": "https://x.com"}],
                },
            })
            mock_pub.assert_awaited_once()
            assert mock_pub.call_args[0][1]["type"] == "tool_results"

    @pytest.mark.asyncio
    async def test_call_on_tool_results_empty_references(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-call-tool-res-empty")
        with patch("virtual_team.streaming.publish_run_message", new_callable=AsyncMock) as mock_pub:
            await emitter({
                "event": "on_tool_results",
                "data": {
                    "tool_name": "",
                    "tool_call_id": "",
                    "references": [],
                },
            })
            mock_pub.assert_not_called()

    @pytest.mark.asyncio
    async def test_call_on_chat_model_stream_no_chunk(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-cms-nochunk")
        await emitter({"event": "on_chat_model_stream", "data": {}})
        assert emitter._stream_buffer == []

    @pytest.mark.asyncio
    async def test_call_on_chat_model_stream_chunk_no_content(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-cms-nocont")
        mock_chunk = MagicMock(spec=[])
        await emitter({"event": "on_chat_model_stream", "data": {"chunk": mock_chunk}})
        assert emitter._stream_buffer == []

    @pytest.mark.asyncio
    async def test_call_publish_exception_does_not_raise(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-pub-exc")
        with patch("virtual_team.streaming.publish_run_message", side_effect=RuntimeError("boom")):
            await emitter({"event": "on_custom_token", "data": {"content": "hello"}})
            assert emitter._stream_buffer == ["hello"]

    @pytest.mark.asyncio
    async def test_thinking_publish_exception_does_not_raise(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter("run-think-exc")
        with patch("virtual_team.streaming.publish_run_message", side_effect=RuntimeError("boom")):
            await emitter({"event": "on_custom_thinking", "data": {"content": "think"}})
            assert emitter._thinking_buffer == ["think"]
