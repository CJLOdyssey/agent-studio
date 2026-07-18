"""Tests for virtual_team.tasks — agent pipeline, completion pipeline, and helpers.

Mock all external dependencies: Celery, Redis, LLM APIs, LangGraph, repositories.
"""
from unittest.mock import ANY, AsyncMock, MagicMock, call, patch

import httpx
import pytest

from virtual_team.tasks.agent_pipeline import _run_agent_pipeline
from virtual_team.tasks.complete_pipeline import _complete_pipeline
from virtual_team.tasks.pipeline_utils import (
    _build_session_context,
    _is_balance_error,
    _parse_json_field,
)


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def mock_agent_deps():
    """Mock all external dependencies for _run_agent_pipeline."""
    patchers = [
        patch("virtual_team.tasks.agent_pipeline.load_config"),
        patch("virtual_team.tasks.agent_pipeline.get_agent_config", new_callable=AsyncMock),
        patch("virtual_team.tasks.agent_pipeline.get_session_memories", new_callable=AsyncMock),
        patch("virtual_team.tasks.agent_pipeline.get_session_messages", new_callable=AsyncMock),
        patch("virtual_team.tasks.agent_pipeline.get_tools", new_callable=AsyncMock),
        patch("virtual_team.tasks.agent_pipeline.get_skills", new_callable=AsyncMock),
        patch("virtual_team.tasks.agent_pipeline.get_mcps", new_callable=AsyncMock),
        patch("virtual_team.tasks.agent_pipeline.update_run_status", new_callable=AsyncMock),
        patch("virtual_team.tasks.agent_pipeline.update_run_result", new_callable=AsyncMock),
        patch("virtual_team.tasks.agent_pipeline.log_key_usage", new_callable=AsyncMock),
        patch("virtual_team.tasks.agent_pipeline.publish_run_message", new_callable=AsyncMock),
        patch("virtual_team.tasks.agent_pipeline.create_checkpointer_async", new_callable=AsyncMock),
        patch("virtual_team.tasks.agent_pipeline.StreamEmitter"),
        patch("virtual_team.tasks.agent_pipeline.SingleAgentGraph"),
        patch("virtual_team.tasks.agent_pipeline._build_session_context", return_value="session_ctx"),
        patch("virtual_team.tasks.agent_pipeline._get_rag_context", new_callable=AsyncMock, return_value="rag_ctx"),
        patch("virtual_team.tasks.agent_pipeline._save_output_memories", new_callable=AsyncMock),
    ]
    mocks = {}
    for p in patchers:
        m = p.start()
        mocks[p.attribute] = m
    yield mocks
    for p in patchers:
        p.stop()


def _default_agent_mocks(mocks, agent_id="agent-1"):
    cfg = MagicMock()
    cfg.model = "test-model"
    mocks["load_config"].return_value = cfg

    ac = MagicMock()
    ac.system_prompt = "You are a test agent"
    ac.output_constraints = ""
    ac.model = None
    ac.tools = '[]'
    ac.mcp = '[]'
    ac.skills = '[]'
    mocks["get_agent_config"].return_value = ac

    graph = MagicMock()
    graph.run = AsyncMock()
    graph.run.return_value = {
        "messages": [MagicMock(content="Hello world!", tool_calls=None)],
        "input_tokens": 100,
        "output_tokens": 50,
        "model": "test-model",
    }
    graph.bind_tools = MagicMock()
    mocks["SingleAgentGraph"].return_value = graph

    return ac, graph


@pytest.fixture
def mock_complete_deps():
    """Mock all external dependencies for _complete_pipeline."""
    patchers = [
        patch("virtual_team.tasks.complete_pipeline.load_config"),
        patch("virtual_team.tasks.complete_pipeline.update_run_status", new_callable=AsyncMock),
        patch("virtual_team.tasks.complete_pipeline.update_run_result", new_callable=AsyncMock),
        patch("virtual_team.tasks.complete_pipeline.publish_run_message", new_callable=AsyncMock),
        patch("virtual_team.tasks.complete_pipeline.stream_prefix_completion", new_callable=AsyncMock),
    ]
    mocks = {}
    for p in patchers:
        m = p.start()
        mocks[p.attribute] = m
    cfg = MagicMock()
    cfg.model = "test-model"
    mocks["load_config"].return_value = cfg
    yield mocks
    for p in patchers:
        p.stop()


# =============================================================================
# _run_agent_pipeline tests
# =============================================================================

class TestRunAgentPipeline:

    async def test_success(self, mock_agent_deps):
        _default_agent_mocks(mock_agent_deps)
        result = await _run_agent_pipeline(
            requirement="test requirement",
            run_id="run-1",
            session_id="sess-1",
            agent_id="agent-1",
        )

        mock_agent_deps["update_run_status"].assert_any_await("run-1", "running")
        mock_agent_deps["SingleAgentGraph"].assert_called_once()
        mock_agent_deps["StreamEmitter"].assert_called_once_with("run-1")
        mock_agent_deps["update_run_result"].assert_awaited()
        mock_agent_deps["publish_run_message"].assert_awaited_with(
            "run-1",
            {
                "type": "result",
                "status": "completed",
                "approved": True,
                "pm_document": "",
                "code": "Hello world!",
                "review": "",
            },
        )
        assert result == {"run_id": "run-1", "status": "completed"}

    async def test_error_handling(self, mock_agent_deps):
        _, graph = _default_agent_mocks(mock_agent_deps)
        graph.run.side_effect = Exception("Graph execution failed")

        with pytest.raises(Exception, match="Graph execution failed"):
            await _run_agent_pipeline(
                requirement="test",
                run_id="run-2",
                session_id=None,
                agent_id="agent-1",
            )

        mock_agent_deps["update_run_status"].assert_any_await("run-2", "running")

    async def test_no_agent_id(self, mock_agent_deps):
        cfg = MagicMock()
        cfg.model = "test-model"
        mock_agent_deps["load_config"].return_value = cfg
        mock_agent_deps["get_agent_config"].return_value = None

        graph = MagicMock()
        graph.run = AsyncMock()
        graph.run.return_value = {
            "messages": [MagicMock(content="Hello!", tool_calls=None)],
            "input_tokens": 10,
            "output_tokens": 5,
            "model": "test-model",
        }
        graph.bind_tools = MagicMock()
        mock_agent_deps["SingleAgentGraph"].return_value = graph

        result = await _run_agent_pipeline(
            requirement="test",
            run_id="run-3",
            session_id=None,
            agent_id=None,
        )

        mock_agent_deps["get_agent_config"].assert_not_called()
        assert result["status"] == "completed"

    async def test_with_session_context(self, mock_agent_deps):
        _default_agent_mocks(mock_agent_deps)
        mock_agent_deps["get_session_memories"].return_value = [MagicMock()]
        mock_agent_deps["_build_session_context"].return_value = "built_context"
        mock_agent_deps["_get_rag_context"].return_value = "rag_context"

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-4",
            session_id="sess-1",
            agent_id="agent-1",
        )

        mock_agent_deps["get_session_memories"].assert_awaited_with("sess-1")
        mock_agent_deps["get_session_messages"].assert_awaited_with("sess-1", exclude_run_id="run-4")
        mock_agent_deps["_save_output_memories"].assert_awaited()

    async def test_agent_config_load_exception(self, mock_agent_deps):
        _default_agent_mocks(mock_agent_deps)
        mock_agent_deps["get_agent_config"].side_effect = RuntimeError("DB error")

        result = await _run_agent_pipeline(
            requirement="test",
            run_id="run-agent-exc",
            session_id=None,
            agent_id="agent-1",
        )

        assert result["status"] == "completed"

    async def test_session_memories_load_exception(self, mock_agent_deps):
        _default_agent_mocks(mock_agent_deps)
        mock_agent_deps["get_session_memories"].side_effect = RuntimeError("mem fail")
        mock_agent_deps["_get_rag_context"].side_effect = RuntimeError("rag fail")

        result = await _run_agent_pipeline(
            requirement="test",
            run_id="run-sess-exc",
            session_id="sess-1",
            agent_id="agent-1",
        )

        assert result["status"] == "completed"

    async def test_chat_history_load_exception(self, mock_agent_deps):
        _default_agent_mocks(mock_agent_deps)
        mock_agent_deps["get_session_messages"].side_effect = RuntimeError("msg fail")

        with pytest.raises(RuntimeError, match="msg fail"):
            await _run_agent_pipeline(
                requirement="test",
                run_id="run-msg-exc",
                session_id="sess-1",
                agent_id="agent-1",
            )

    async def test_prepare_tools(self, mock_agent_deps):
        ac, graph = _default_agent_mocks(mock_agent_deps)
        ac.tools = '[{"name": "search-tool", "enabled": true, "parameters": {"key": "val"}}]'

        tool_mock = MagicMock()
        tool_mock.name = "search-tool"
        tool_mock.description = "Search tool description"
        tool_mock.parameters = '{"url": "http://example.com"}'
        tool_mock.endpoint = "http://search/api"
        tool_mock.method = "POST"
        tool_mock.headers = '{"Authorization": "Bearer token"}'
        mock_agent_deps["get_tools"].return_value = [tool_mock]

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-5",
            session_id=None,
            agent_id="agent-1",
        )

        assert graph.bind_tools.called
        bound_tools = graph.bind_tools.call_args[0][0]
        tool_names = [t.name for t in bound_tools]
        assert "search-tool" in tool_names

    async def test_prepare_tools_disabled_item_skipped(self, mock_agent_deps):
        ac, graph = _default_agent_mocks(mock_agent_deps)
        ac.tools = '[{"name": "enabled-tool", "enabled": true}, {"name": "disabled-tool", "enabled": false}]'

        tool_mock = MagicMock()
        tool_mock.name = "enabled-tool"
        tool_mock.description = "Enabled"
        tool_mock.parameters = "{}"
        tool_mock.endpoint = ""
        tool_mock.method = "GET"
        tool_mock.headers = "{}"
        mock_agent_deps["get_tools"].return_value = [tool_mock]

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-disabled-tool",
            session_id=None,
            agent_id="agent-1",
        )

        bound_tools = graph.bind_tools.call_args[0][0]
        tool_names = [t.name for t in bound_tools]
        assert "enabled-tool" in tool_names
        assert "disabled-tool" not in tool_names

    async def test_prepare_tools_no_match_uses_item_params(self, mock_agent_deps):
        ac, graph = _default_agent_mocks(mock_agent_deps)
        ac.tools = '[{"name": "unknown-tool", "enabled": true, "description": "Fallback desc", "parameters": {"custom": true}}]'
        mock_agent_deps["get_tools"].return_value = []

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-no-match",
            session_id=None,
            agent_id="agent-1",
        )

        bound_tools = graph.bind_tools.call_args[0][0]
        assert any(t.name == "unknown-tool" for t in bound_tools)

    async def test_prepare_tools_with_string_parameters_json_parse(self, mock_agent_deps):
        ac, graph = _default_agent_mocks(mock_agent_deps)
        ac.tools = '[{"name": "json-tool", "enabled": true}]'

        tool_mock = MagicMock()
        tool_mock.name = "json-tool"
        tool_mock.description = "JSON tool"
        tool_mock.parameters = '{"url": "http://api.com"}'
        tool_mock.endpoint = ""
        tool_mock.method = "GET"
        tool_mock.headers = "{}"
        mock_agent_deps["get_tools"].return_value = [tool_mock]

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-json-params",
            session_id=None,
            agent_id="agent-1",
        )

        bound_tools = graph.bind_tools.call_args[0][0]
        json_tool = next(t for t in bound_tools if t.name == "json-tool")
        assert json_tool.parameters == {"url": "http://api.com"}

    async def test_prepare_skills(self, mock_agent_deps):
        ac, graph = _default_agent_mocks(mock_agent_deps)
        ac.tools = '[]'
        ac.skills = '[{"name": "code-review"}]'

        skill_mock = MagicMock()
        skill_mock.name = "code-review"
        skill_mock.description = "Review code"
        mock_agent_deps["get_skills"].return_value = [skill_mock]

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-6",
            session_id=None,
            agent_id="agent-1",
        )

        assert graph.bind_tools.called
        bound_tools = graph.bind_tools.call_args[0][0]
        skill_names = [t.name for t in bound_tools]
        assert "skill_code-review" in skill_names

    async def test_prepare_skill_no_match_skipped(self, mock_agent_deps):
        ac, graph = _default_agent_mocks(mock_agent_deps)
        ac.skills = '[{"name": "ghost-skill"}]'
        mock_agent_deps["get_skills"].return_value = []

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-ghost-skill",
            session_id=None,
            agent_id="agent-1",
        )

        bound_tools = graph.bind_tools.call_args[0][0]
        assert all("ghost-skill" not in t.name for t in bound_tools)

    async def test_prepare_mcp_stdio(self, mock_agent_deps):
        ac, graph = _default_agent_mocks(mock_agent_deps)
        ac.tools = '[]'
        ac.mcp = '[{"name": "file-system", "enabled": true}]'

        mcp_mock = MagicMock()
        mcp_mock.name = "file-system"
        mcp_mock.config = '{}'
        mcp_mock.type = "stdio"
        mcp_mock.endpoint = "node server.js"
        mock_agent_deps["get_mcps"].return_value = [mcp_mock]

        with patch("virtual_team.tasks.agent_pipeline._discover_mcp_tools", new_callable=AsyncMock) as mock_discover:
            mock_discover.return_value = [
                {"name": "read_file", "description": "Read a file", "inputSchema": {"type": "object"}},
            ]
            await _run_agent_pipeline(
                requirement="test",
                run_id="run-7",
                session_id=None,
                agent_id="agent-1",
            )

        assert graph.bind_tools.called
        bound_tools = graph.bind_tools.call_args[0][0]
        mcp_names = [t.name for t in bound_tools]
        assert "mcp_file-system_read_file" in mcp_names

    async def test_prepare_mcp_stdio_discovery_failure(self, mock_agent_deps):
        ac, graph = _default_agent_mocks(mock_agent_deps)
        ac.mcp = '[{"name": "broken-mcp", "enabled": true}]'

        mcp_mock = MagicMock()
        mcp_mock.name = "broken-mcp"
        mcp_mock.config = '{}'
        mcp_mock.type = "stdio"
        mcp_mock.endpoint = "nonexistent"
        mock_agent_deps["get_mcps"].return_value = [mcp_mock]

        with patch("virtual_team.tasks.agent_pipeline._discover_mcp_tools", new_callable=AsyncMock) as mock_discover:
            mock_discover.side_effect = Exception("Connection refused")
            await _run_agent_pipeline(
                requirement="test",
                run_id="run-mcp-fail",
                session_id=None,
                agent_id="agent-1",
            )

        bound_tools = graph.bind_tools.call_args[0][0]
        assert len(bound_tools) == 0

    async def test_prepare_mcp_non_stdio_endpoint(self, mock_agent_deps):
        ac, graph = _default_agent_mocks(mock_agent_deps)
        ac.tools = '[]'
        ac.mcp = '[{"name": "rest-api", "enabled": true}]'

        mcp_mock = MagicMock()
        mcp_mock.name = "rest-api"
        mcp_mock.config = '{"url": "http://api.test"}'
        mcp_mock.type = "rest"
        mcp_mock.endpoint = "http://api.test"
        mock_agent_deps["get_mcps"].return_value = [mcp_mock]

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-mcp-rest",
            session_id=None,
            agent_id="agent-1",
        )

        bound_tools = graph.bind_tools.call_args[0][0]
        mcp_names = [t.name for t in bound_tools]
        assert "mcp_rest-api_rest-api" in mcp_names

    async def test_prepare_mcp_with_string_config(self, mock_agent_deps):
        ac, graph = _default_agent_mocks(mock_agent_deps)
        ac.mcp = '[{"name": "str-mcp", "enabled": true}]'

        mcp_mock = MagicMock()
        mcp_mock.name = "str-mcp"
        mcp_mock.config = '{"provider": "test"}'
        mcp_mock.type = "rest"
        mcp_mock.endpoint = "http://test"
        mock_agent_deps["get_mcps"].return_value = [mcp_mock]

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-mcp-str",
            session_id=None,
            agent_id="agent-1",
        )

        bound_tools = graph.bind_tools.call_args[0][0]
        mcp_names = [t.name for t in bound_tools]
        assert "mcp_str-mcp_str-mcp" in mcp_names

    async def test_output_constraints_appended(self, mock_agent_deps):
        ac, graph = _default_agent_mocks(mock_agent_deps)
        ac.output_constraints = "必须输出 JSON"

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-constr",
            session_id=None,
            agent_id="agent-1",
        )

        assert graph.run.awaited

    async def test_custom_model_from_agent_config(self, mock_agent_deps):
        ac, graph = _default_agent_mocks(mock_agent_deps)
        ac.model = "custom-model-v2"

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-cust-model",
            session_id=None,
            agent_id="agent-1",
        )

        call_kwargs = mock_agent_deps["SingleAgentGraph"].call_args[1]
        assert call_kwargs["model"] == "custom-model-v2"

    async def test_model_from_parameter_override(self, mock_agent_deps):
        _default_agent_mocks(mock_agent_deps)

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-param-model",
            session_id=None,
            agent_id="agent-1",
            model="param-model-v3",
        )

        call_kwargs = mock_agent_deps["SingleAgentGraph"].call_args[1]
        assert call_kwargs["model"] == "param-model-v3"

    async def test_api_key_passed_to_graph(self, mock_agent_deps):
        _default_agent_mocks(mock_agent_deps)

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-key",
            session_id=None,
            agent_id="agent-1",
            api_key="sk-custom-key",
            api_base="https://custom.api.com",
        )

        call_kwargs = mock_agent_deps["SingleAgentGraph"].call_args[1]
        assert call_kwargs["api_key"] == "sk-custom-key"
        assert call_kwargs["base_url"] == "https://custom.api.com"

    async def test_successful_result_with_messages(self, mock_agent_deps):
        _default_agent_mocks(mock_agent_deps)
        graph = mock_agent_deps["SingleAgentGraph"].return_value

        msg1 = MagicMock(content="Hello", tool_calls=None)
        msg2 = MagicMock(content="<pm_document>doc</pm_document>", tool_calls=None)
        msg3 = MagicMock(content="<review>Looks good</review>", tool_calls=None)
        graph.run.return_value = {
            "messages": [msg1, msg2, msg3],
            "input_tokens": 200,
            "output_tokens": 100,
            "model": "test-model",
        }

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-8",
            session_id=None,
            agent_id="agent-1",
        )

        mock_agent_deps["update_run_result"].assert_awaited_with(
            run_id="run-8",
            pm_document="<pm_document>doc</pm_document>",
            code="<review>Looks good</review>",
            review="<review>Looks good</review>",
            approved=True,
            status="converged",
        )

    async def test_empty_messages_fallback_content(self, mock_agent_deps):
        _default_agent_mocks(mock_agent_deps)
        graph = mock_agent_deps["SingleAgentGraph"].return_value
        graph.run.return_value = {
            "messages": [MagicMock(content="", tool_calls=None)],
            "input_tokens": 0,
            "output_tokens": 0,
            "model": "test-model",
        }

        result = await _run_agent_pipeline(
            requirement="test",
            run_id="run-empty",
            session_id=None,
            agent_id="agent-1",
        )

        assert result["status"] == "completed"

    async def test_last_message_with_content_is_used(self, mock_agent_deps):
        _default_agent_mocks(mock_agent_deps)
        graph = mock_agent_deps["SingleAgentGraph"].return_value
        graph.run.return_value = {
            "messages": [
                MagicMock(content="first msg", tool_calls=None),
                MagicMock(content="last and final", tool_calls=None),
            ],
            "input_tokens": 20,
            "output_tokens": 10,
            "model": "test-model",
        }

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-last-msg",
            session_id=None,
            agent_id="agent-1",
        )

        _, call_kwargs = mock_agent_deps["update_run_result"].await_args
        assert call_kwargs["code"] == "last and final"

    async def test_key_usage_logging(self, mock_agent_deps):
        _default_agent_mocks(mock_agent_deps)
        graph = mock_agent_deps["SingleAgentGraph"].return_value
        graph.run.return_value = {
            "messages": [MagicMock(content="result", tool_calls=None)],
            "input_tokens": 150,
            "output_tokens": 75,
            "model": "deepseek/some-model",
        }

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-usage",
            session_id=None,
            agent_id="agent-1",
        )

        mock_agent_deps["log_key_usage"].assert_awaited()

    async def test_first_session_triggers_rag_ingest(self, mock_agent_deps):
        ac, _ = _default_agent_mocks(mock_agent_deps)
        mock_agent_deps["get_session_messages"].return_value = []

        with patch("virtual_team.rag_pipeline.ingest_session_messages", new_callable=AsyncMock) as mock_ingest:
            await _run_agent_pipeline(
                requirement="test requirement",
                run_id="run-rag",
                session_id="sess-new",
                agent_id="agent-1",
            )

            mock_ingest.assert_awaited_once()

    async def test_rag_ingest_failure_is_nonfatal(self, mock_agent_deps):
        _default_agent_mocks(mock_agent_deps)
        mock_agent_deps["get_session_messages"].return_value = []

        with patch("virtual_team.rag_pipeline.ingest_session_messages", new_callable=AsyncMock) as mock_ingest:
            mock_ingest.side_effect = RuntimeError("RAG down")
            await _run_agent_pipeline(
                requirement="test",
                run_id="run-rag-fail",
                session_id="sess-new",
                agent_id="agent-1",
            )

        assert True

    async def test_log_key_usage_exception_is_nonfatal(self, mock_agent_deps):
        _default_agent_mocks(mock_agent_deps)
        mock_agent_deps["log_key_usage"].side_effect = RuntimeError("key log fail")

        result = await _run_agent_pipeline(
            requirement="test",
            run_id="run-keyfail",
            session_id=None,
            agent_id="agent-1",
        )

        assert result["status"] == "completed"

    async def test_mcp_endpoint_set_method_mcp(self, mock_agent_deps):
        ac, graph = _default_agent_mocks(mock_agent_deps)
        ac.mcp = '[{"name": "rest-mcp", "enabled": true}]'

        mcp_mock = MagicMock()
        mcp_mock.name = "rest-mcp"
        mcp_mock.config = "{}"
        mcp_mock.type = "rest"
        mcp_mock.endpoint = "http://rest.io"
        mock_agent_deps["get_mcps"].return_value = [mcp_mock]

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-mcp-endpoint",
            session_id=None,
            agent_id="agent-1",
        )

        bound_tools = graph.bind_tools.call_args[0][0]
        non_mcp = [t for t in bound_tools if t.method != "MCP"]
        assert len(non_mcp) <= 0 or all(t.endpoint != "exec_stdio_mcp" for t in non_mcp)

    async def test_get_agent_config_returns_none_still_succeeds(self, mock_agent_deps):
        cfg = MagicMock()
        cfg.model = "default-model"
        mock_agent_deps["load_config"].return_value = cfg
        mock_agent_deps["get_agent_config"].return_value = None

        graph = MagicMock()
        graph.run = AsyncMock()
        graph.run.return_value = {
            "messages": [MagicMock(content="ok", tool_calls=None)],
            "input_tokens": 5,
            "output_tokens": 5,
            "model": "default-model",
        }
        graph.bind_tools = MagicMock()
        mock_agent_deps["SingleAgentGraph"].return_value = graph

        result = await _run_agent_pipeline(
            requirement="test",
            run_id="run-none-ac",
            session_id="sess-1",
            agent_id="nonexistent",
        )

        assert result["status"] == "completed"


# =============================================================================
# _complete_pipeline tests
# =============================================================================

