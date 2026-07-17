"""Coverage tests for tool_generator, streaming, and run_service modules."""

from unittest.mock import AsyncMock, patch

import pytest


class TestToolGenerator:
    @pytest.mark.asyncio
    async def test_validate_tool_code_python_valid(self):
        from virtual_team.services.tool_generator import _validate_tool_code

        code = 'def foo():\n    """doc"""\n    import os\n    try:\n        pass\n    except:\n        pass'
        resp = _validate_tool_code(code, "python")
        assert resp.is_valid is True
        assert resp.error_message is None

    @pytest.mark.asyncio
    async def test_validate_tool_code_python_missing_def(self):
        from virtual_team.services.tool_generator import _validate_tool_code

        resp = _validate_tool_code("x = 1", "python")
        assert resp.is_valid is False
        assert "建议添加函数定义" in resp.suggestions

    @pytest.mark.asyncio
    async def test_validate_tool_code_python_missing_docstring(self):
        from virtual_team.services.tool_generator import _validate_tool_code

        resp = _validate_tool_code("def foo():\n    pass", "python")
        assert "建议添加文档字符串（docstring）" in resp.suggestions

    @pytest.mark.asyncio
    async def test_validate_tool_code_python_missing_import(self):
        from virtual_team.services.tool_generator import _validate_tool_code

        resp = _validate_tool_code("def foo():\n    pass", "python")
        assert "检查是否需要导入模块" in resp.suggestions

    @pytest.mark.asyncio
    async def test_validate_tool_code_python_missing_try_except(self):
        from virtual_team.services.tool_generator import _validate_tool_code

        resp = _validate_tool_code("def foo():\n    pass", "python")
        assert "建议添加异常处理" in resp.suggestions

    @pytest.mark.asyncio
    async def test_validate_tool_code_javascript_valid(self):
        from virtual_team.services.tool_generator import _validate_tool_code

        code = "/** desc */\nfunction bar() {\n  try {\n    return 1;\n  } catch (e) {}\n}"
        resp = _validate_tool_code(code, "javascript")
        assert resp.is_valid is True

    @pytest.mark.asyncio
    async def test_validate_tool_code_javascript_missing_function(self):
        from virtual_team.services.tool_generator import _validate_tool_code

        resp = _validate_tool_code("const x = 1;", "javascript")
        assert "建议添加函数定义" in resp.suggestions

    @pytest.mark.asyncio
    async def test_validate_tool_code_javascript_missing_jsdoc(self):
        from virtual_team.services.tool_generator import _validate_tool_code

        code = "function bar() {\n  try {\n  } catch (e) {}\n}"
        resp = _validate_tool_code(code, "javascript")
        assert "建议添加JSDoc注释" in resp.suggestions

    @pytest.mark.asyncio
    async def test_validate_tool_code_javascript_missing_catch(self):
        from virtual_team.services.tool_generator import _validate_tool_code

        code = "/** desc */\nfunction bar() { return 1; }"
        resp = _validate_tool_code(code, "javascript")
        assert "建议添加异常处理" in resp.suggestions

    @pytest.mark.asyncio
    async def test_validate_tool_code_typescript_arrow(self):
        from virtual_team.services.tool_generator import _validate_tool_code

        code = "/** desc */\nconst bar = () => {\n  try {\n  } catch (e) {}\n}"
        resp = _validate_tool_code(code, "typescript")
        assert resp.is_valid is True

    @pytest.mark.asyncio
    async def test_execute_tool_sandbox_valid_python(self):
        from virtual_team.services.tool_generator import _execute_tool_sandbox

        result = _execute_tool_sandbox("x = 1", "python")
        assert result == "代码语法检查通过"

    @pytest.mark.asyncio
    async def test_execute_tool_sandbox_syntax_error(self):
        from virtual_team.services.tool_generator import _execute_tool_sandbox

        with pytest.raises(Exception, match="语法错误"):
            _execute_tool_sandbox("def foo(:", "python")

    @pytest.mark.asyncio
    async def test_execute_tool_sandbox_runtime_error(self):
        from virtual_team.services.tool_generator import _execute_tool_sandbox

        with pytest.raises(Exception, match="执行错误"):
            _execute_tool_sandbox("raise ValueError('boom')", "python")

    @pytest.mark.asyncio
    async def test_execute_tool_sandbox_javascript(self):
        from virtual_team.services.tool_generator import _execute_tool_sandbox

        result = _execute_tool_sandbox("console.log('hi')", "javascript")
        assert "Node.js环境" in result

    @pytest.mark.asyncio
    async def test_tool_validate_request_model(self):
        from virtual_team.services.tool_generator import ToolValidateRequest

        req = ToolValidateRequest(code="print(1)", language="python")
        assert req.code == "print(1)"
        assert req.language == "python"

    @pytest.mark.asyncio
    async def test_tool_validate_request_default_language(self):
        from virtual_team.services.tool_generator import ToolValidateRequest

        req = ToolValidateRequest(code="print(1)")
        assert req.language == "python"

    @pytest.mark.asyncio
    async def test_tool_validate_response_model_valid(self):
        from virtual_team.services.tool_generator import ToolValidateResponse

        resp = ToolValidateResponse(is_valid=True)
        assert resp.is_valid is True
        assert resp.error_message is None
        assert resp.suggestions == []

    @pytest.mark.asyncio
    async def test_tool_validate_response_model_invalid(self):
        from virtual_team.services.tool_generator import ToolValidateResponse

        resp = ToolValidateResponse(
            is_valid=False,
            error_message="代码需要优化",
            suggestions=["建议添加函数定义"],
        )
        assert resp.is_valid is False
        assert resp.error_message == "代码需要优化"
        assert len(resp.suggestions) == 1


class TestStreaming:
    @pytest.mark.asyncio
    async def test_constructor_sets_run_id(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="test-run-123")
        assert emitter._run_id == "test-run-123"

    @pytest.mark.asyncio
    async def test_constructor_initializes_buffers(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")
        assert emitter._message_index == 0
        assert emitter._stream_buffer == []
        assert emitter._thinking_buffer == []
        assert emitter._pending_thinking is None
        assert emitter._pending_thinking_nodes is None

    @pytest.mark.asyncio
    async def test_emit_creates_formatted_message(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")

        with (
            patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub,
            patch("virtual_team.streaming.save_message", AsyncMock()) as mock_save,
        ):
            await emitter._emit(agent_name="Agent", content="hello")

            mock_pub.assert_awaited_once()
            args, _ = mock_pub.call_args
            assert args[0] == "r1"
            sent = args[1]
            assert sent["type"] == "message"
            assert sent["role"] == "Agent"
            assert sent["content"] == "hello"
            assert sent["round_number"] == 1

            mock_save.assert_awaited_once_with(
                run_id="r1",
                role="Agent",
                agent_name="Agent",
                content="hello",
                thinking=None,
                round_number=1,
            )

    @pytest.mark.asyncio
    async def test_emit_with_thinking(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")
        emitter._pending_thinking = "some thinking"

        with (
            patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub,
            patch("virtual_team.streaming.save_message", AsyncMock()),
        ):
            await emitter._emit(agent_name="Agent", content="hello")

            assert emitter._pending_thinking is None
            args, _ = mock_pub.call_args
            assert args[1]["thinking"] == "some thinking"

    @pytest.mark.asyncio
    async def test_emit_with_explicit_thinking(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")

        with (
            patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub,
            patch("virtual_team.streaming.save_message", AsyncMock()),
        ):
            await emitter._emit(agent_name="Agent", content="hello", thinking="explicit")

            args, _ = mock_pub.call_args
            assert args[1]["thinking"] == "explicit"

    @pytest.mark.asyncio
    async def test_emit_balance_warning_creates_correct_structure(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")

        with patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub:
            await emitter.emit_balance_warning("余额不足")

            mock_pub.assert_awaited_once()
            args, _ = mock_pub.call_args
            assert args[0] == "r1"
            payload = args[1]
            assert payload["type"] == "balance_warning"
            assert payload["agent_name"] == "System"
            assert payload["content"] == "余额不足"

    @pytest.mark.asyncio
    async def test_emit_balance_warning_default_message(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")

        with patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub:
            await emitter.emit_balance_warning()

            args, _ = mock_pub.call_args
            assert "模型余额不足" in args[1]["content"]

    @pytest.mark.asyncio
    async def test_emit_thinking_nodes_buffers_new_nodes(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")
        nodes = [{"id": "n1", "label": "think"}]

        await emitter.emit_thinking_nodes(nodes)

        assert emitter._pending_thinking_nodes == nodes

    @pytest.mark.asyncio
    async def test_emit_thinking_nodes_appends_to_existing(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")
        emitter._pending_thinking_nodes = [{"id": "n1"}]

        await emitter.emit_thinking_nodes([{"id": "n2"}])

        assert len(emitter._pending_thinking_nodes) == 2
        assert emitter._pending_thinking_nodes[1]["id"] == "n2"

    @pytest.mark.asyncio
    async def test_emit_thinking_nodes_trims_to_max(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")
        many_nodes = [{"id": f"n{i}"} for i in range(25)]

        await emitter.emit_thinking_nodes(many_nodes)

        assert len(emitter._pending_thinking_nodes) == 20

    @pytest.mark.asyncio
    async def test_flush_buffers_handles_empty_buffers(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")

        with (
            patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub,
            patch("virtual_team.streaming.save_message", AsyncMock()) as mock_save,
        ):
            await emitter._flush_buffers()

            mock_pub.assert_not_called()
            mock_save.assert_not_called()

    @pytest.mark.asyncio
    async def test_flush_buffers_flushes_stream_and_thinking(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")
        emitter._stream_buffer = ["hello ", "world"]
        emitter._thinking_buffer = ["deep ", "thought"]
        emitter._pending_thinking_nodes = [{"id": "n1"}]

        with (
            patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub,
            patch("virtual_team.streaming.save_message", AsyncMock()),
        ):
            await emitter._flush_buffers()

            assert emitter._stream_buffer == []
            assert emitter._thinking_buffer == []
            assert emitter._pending_thinking_nodes is None

            calls = mock_pub.call_args_list
            message_calls = [c for c in calls if c[0][1]["type"] == "message"]
            assert len(message_calls) == 1
            assert message_calls[0][0][1]["content"] == "hello world"

    @pytest.mark.asyncio
    async def test_flush_buffers_sends_thinking_done(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")
        emitter._thinking_buffer = ["deep thought"]

        with (
            patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub,
            patch("virtual_team.streaming.save_message", AsyncMock()),
        ):
            await emitter._flush_buffers()

            calls = mock_pub.call_args_list
            thinking_done = [c for c in calls if c[0][1]["type"] == "thinking_done"]
            assert len(thinking_done) == 1
            assert thinking_done[0][0][1]["thinking"] == "deep thought"

    @pytest.mark.asyncio
    async def test_call_on_custom_token_publishes_chunk(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")

        with patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub:
            await emitter({"event": "on_custom_token", "data": {"content": "hello"}})

            mock_pub.assert_awaited_once()
            args, _ = mock_pub.call_args
            payload = args[1]
            assert payload["type"] == "stream"
            assert payload["content"] == "hello"
            assert emitter._stream_buffer == ["hello"]

    @pytest.mark.asyncio
    async def test_call_on_custom_thinking_publishes_chunk(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")

        with patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub:
            await emitter({"event": "on_custom_thinking", "data": {"content": "think"}})

            mock_pub.assert_awaited_once()
            args, _ = mock_pub.call_args
            payload = args[1]
            assert payload["type"] == "thinking_stream"
            assert payload["content"] == "think"
            assert emitter._thinking_buffer == ["think"]

    @pytest.mark.asyncio
    async def test_call_on_node_end_flushes(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")
        emitter._stream_buffer = ["data"]

        with (
            patch("virtual_team.streaming.publish_run_message", AsyncMock()),
            patch("virtual_team.streaming.save_message", AsyncMock()),
        ):
            await emitter({"event": "on_node_end", "data": {}})

            assert emitter._stream_buffer == []

    @pytest.mark.asyncio
    async def test_call_on_tool_start_emits_message(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")

        with (
            patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub,
            patch("virtual_team.streaming.save_message", AsyncMock()),
        ):
            await emitter({
                "event": "on_tool_start",
                "data": {"input": "arg"},
                "name": "search",
            })

            args, _ = mock_pub.call_args
            assert "🔧" in args[1]["content"]
            assert "search" in args[1]["content"]

    @pytest.mark.asyncio
    async def test_call_on_tool_end_emits_message(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")

        with (
            patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub,
            patch("virtual_team.streaming.save_message", AsyncMock()),
        ):
            await emitter({
                "event": "on_tool_end",
                "data": {"output": "result"},
                "name": "search",
            })

            args, _ = mock_pub.call_args
            assert "👁" in args[1]["content"]
            assert "search" in args[1]["content"]

    @pytest.mark.asyncio
    async def test_call_on_client_action_publishes(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")

        with patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub:
            await emitter({
                "event": "on_client_action",
                "data": {"action": {"type": "click"}},
            })

            args, _ = mock_pub.call_args
            assert args[1]["type"] == "client_action"
            assert args[1]["action"]["type"] == "click"

    @pytest.mark.asyncio
    async def test_call_on_thinking_nodes_calls_emit_thinking_nodes(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")

        with patch.object(emitter, "emit_thinking_nodes", AsyncMock()) as mock_emit:
            await emitter({
                "event": "on_thinking_nodes",
                "data": {"nodes": [{"id": "n1"}]},
            })

            mock_emit.assert_awaited_once_with([{"id": "n1"}])

    @pytest.mark.asyncio
    async def test_call_on_tool_complete_calls_emit_tool_complete(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")

        with (
            patch.object(emitter, "emit_tool_complete", AsyncMock()) as mock_emit,
            patch("virtual_team.streaming.publish_run_message", AsyncMock()),
        ):
            await emitter({
                "event": "on_tool_complete",
                "data": {"toolName": "search", "status": "success"},
            })

            mock_emit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_call_unknown_event_does_nothing(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")

        with (
            patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub,
            patch("virtual_team.streaming.save_message", AsyncMock()) as mock_save,
        ):
            await emitter({"event": "unknown_event", "data": {}})

            mock_pub.assert_not_called()
            mock_save.assert_not_called()

    @pytest.mark.asyncio
    async def test_emit_tool_complete_success(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")

        with patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub:
            await emitter.emit_tool_complete({
                "toolName": "search",
                "status": "success",
            })

            args, _ = mock_pub.call_args
            assert args[1]["type"] == "tool_complete"
            assert args[1]["node"]["status"] == "success"
            assert "✅" in args[1]["node"]["content"]

    @pytest.mark.asyncio
    async def test_emit_tool_complete_failure(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")

        with patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub:
            await emitter.emit_tool_complete({
                "toolName": "search",
                "status": "error",
            })

            args, _ = mock_pub.call_args
            assert "❌" in args[1]["node"]["content"]

    @pytest.mark.asyncio
    async def test_emit_tool_results_publishes(self):
        from virtual_team.streaming import StreamEmitter

        emitter = StreamEmitter(run_id="r1")
        refs = [{"url": "https://example.com"}]

        with patch("virtual_team.streaming.publish_run_message", AsyncMock()) as mock_pub:
            await emitter.emit_tool_results("search", "call-1", refs)

            args, _ = mock_pub.call_args
            assert args[1]["type"] == "tool_results"
            assert args[1]["toolName"] == "search"
            assert args[1]["tool_call_id"] == "call-1"
            assert args[1]["references"] == refs


class TestRunService:
    @pytest.mark.asyncio
    async def test_run_service_importable(self):
        from virtual_team.services.run_service import RunService

        assert RunService is not None

    @pytest.mark.asyncio
    async def test_run_service_has_create_run_method(self):
        from virtual_team.services.run_service import RunService

        svc = RunService()
        assert hasattr(svc, "create_run")
        assert callable(svc.create_run)

    @pytest.mark.asyncio
    async def test_create_run_requires_requirement(self):
        import inspect

        from virtual_team.services.run_service import RunService

        svc = RunService()
        sig = inspect.signature(svc.create_run)
        assert "requirement" in sig.parameters
        assert sig.parameters["requirement"].default is inspect.Parameter.empty

    @pytest.mark.asyncio
    async def test_create_run_has_session_id_param(self):
        import inspect

        from virtual_team.services.run_service import RunService

        svc = RunService()
        sig = inspect.signature(svc.create_run)
        assert "session_id" in sig.parameters

    @pytest.mark.asyncio
    async def test_create_run_has_user_id_param(self):
        import inspect

        from virtual_team.services.run_service import RunService

        svc = RunService()
        sig = inspect.signature(svc.create_run)
        assert "user_id" in sig.parameters

    @pytest.mark.asyncio
    async def test_create_run_has_key_id_param(self):
        import inspect

        from virtual_team.services.run_service import RunService

        svc = RunService()
        sig = inspect.signature(svc.create_run)
        assert "key_id" in sig.parameters
        assert sig.parameters["key_id"].default is None

    @pytest.mark.asyncio
    async def test_create_run_has_agent_id_param(self):
        import inspect

        from virtual_team.services.run_service import RunService

        svc = RunService()
        sig = inspect.signature(svc.create_run)
        assert "agent_id" in sig.parameters
        assert sig.parameters["agent_id"].default is None

    @pytest.mark.asyncio
    async def test_create_run_has_team_id_param(self):
        import inspect

        from virtual_team.services.run_service import RunService

        svc = RunService()
        sig = inspect.signature(svc.create_run)
        assert "team_id" in sig.parameters
        assert sig.parameters["team_id"].default is None

    @pytest.mark.asyncio
    async def test_create_run_has_model_param(self):
        import inspect

        from virtual_team.services.run_service import RunService

        svc = RunService()
        sig = inspect.signature(svc.create_run)
        assert "model" in sig.parameters
        assert sig.parameters["model"].default is None

    @pytest.mark.asyncio
    async def test_create_run_returns_dict_type(self):
        import inspect

        from virtual_team.services.run_service import RunService

        svc = RunService()
        sig = inspect.signature(svc.create_run)
        assert sig.return_annotation is not inspect.Parameter.empty

    @pytest.mark.asyncio
    async def test_run_service_module_importable(self):
        import virtual_team.services.run_service as mod

        assert hasattr(mod, "RunService")
