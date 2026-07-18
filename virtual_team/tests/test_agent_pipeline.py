"""Tests for virtual_team.tasks.agent_pipeline — Celery task pipeline logic.

Mock all external dependencies: Celery, Redis, OpenAI, LangGraph, repositories.
"""
from unittest.mock import ANY, AsyncMock, MagicMock, patch

import pytest

from virtual_team.tasks.agent_pipeline import _run_agent_pipeline


@pytest.fixture
def mock_deps():
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
        name = p.attribute
        mocks[name] = m
    yield mocks
    for p in patchers:
        p.stop()


def _configure_default_mocks(mocks, agent_id="agent-1"):
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

    graph = AsyncMock()
    graph.run.return_value = {
        "messages": [MagicMock(content="Hello world!", tool_calls=None)],
        "input_tokens": 100,
        "output_tokens": 50,
        "model": "test-model",
    }
    mocks["SingleAgentGraph"].return_value = graph

    return ac, graph


class TestRunAgentPipeline:

    async def test_success(self, mock_deps):
        _configure_default_mocks(mock_deps)
        result = await _run_agent_pipeline(
            requirement="test requirement",
            run_id="run-1",
            session_id="sess-1",
            agent_id="agent-1",
        )

        mock_deps["update_run_status"].assert_any_await("run-1", "running")
        mock_deps["SingleAgentGraph"].assert_called_once()
        mock_deps["StreamEmitter"].assert_called_once_with("run-1")
        mock_deps["update_run_result"].assert_awaited()
        mock_deps["publish_run_message"].assert_awaited_with(
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

    async def test_error_handling(self, mock_deps):
        _, graph = _configure_default_mocks(mock_deps)
        graph.run.side_effect = Exception("Graph execution failed")

        with pytest.raises(Exception, match="Graph execution failed"):
            await _run_agent_pipeline(
                requirement="test",
                run_id="run-2",
                session_id=None,
                agent_id="agent-1",
            )

        mock_deps["update_run_status"].assert_any_await("run-2", "running")

    async def test_no_agent_id(self, mock_deps):
        cfg = MagicMock()
        cfg.model = "test-model"
        mock_deps["load_config"].return_value = cfg
        mock_deps["get_agent_config"].return_value = None

        graph = AsyncMock()
        graph.run.return_value = {
            "messages": [MagicMock(content="Hello!", tool_calls=None)],
            "input_tokens": 10,
            "output_tokens": 5,
            "model": "test-model",
        }
        mock_deps["SingleAgentGraph"].return_value = graph

        result = await _run_agent_pipeline(
            requirement="test",
            run_id="run-3",
            session_id=None,
            agent_id=None,
        )

        mock_deps["get_agent_config"].assert_not_called()
        assert result["status"] == "completed"

    async def test_with_session_context(self, mock_deps):
        _configure_default_mocks(mock_deps)
        mock_deps["get_session_memories"].return_value = [MagicMock()]
        mock_deps["_build_session_context"].return_value = "built_context"
        mock_deps["_get_rag_context"].return_value = "rag_context"

        await _run_agent_pipeline(
            requirement="test",
            run_id="run-4",
            session_id="sess-1",
            agent_id="agent-1",
        )

        mock_deps["get_session_memories"].assert_awaited_with("sess-1")
        mock_deps["get_session_messages"].assert_awaited_with("sess-1", exclude_run_id="run-4")
        mock_deps["_save_output_memories"].assert_awaited()

    async def test_prepare_tools(self, mock_deps):
        ac, graph = _configure_default_mocks(mock_deps)
        ac.tools = '[{"name": "search-tool", "enabled": true, "parameters": {"key": "val"}}]'

        tool_mock = MagicMock()
        tool_mock.name = "search-tool"
        tool_mock.description = "Search tool description"
        tool_mock.parameters = '{"url": "http://example.com"}'
        tool_mock.endpoint = "http://search/api"
        tool_mock.method = "POST"
        tool_mock.headers = '{"Authorization": "Bearer token"}'
        mock_deps["get_tools"].return_value = [tool_mock]

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

    async def test_prepare_skills(self, mock_deps):
        ac, graph = _configure_default_mocks(mock_deps)
        ac.tools = '[]'
        ac.skills = '[{"name": "code-review"}]'

        skill_mock = MagicMock()
        skill_mock.name = "code-review"
        skill_mock.description = "Review code"
        mock_deps["get_skills"].return_value = [skill_mock]

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

    async def test_prepare_mcp(self, mock_deps):
        ac, graph = _configure_default_mocks(mock_deps)
        ac.tools = '[]'
        ac.mcp = '[{"name": "file-system", "enabled": true}]'

        mcp_mock = MagicMock()
        mcp_mock.name = "file-system"
        mcp_mock.config = '{}'
        mcp_mock.type = "stdio"
        mcp_mock.endpoint = "node server.js"
        mock_deps["get_mcps"].return_value = [mcp_mock]

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

    async def test_successful_result_with_messages(self, mock_deps):
        _configure_default_mocks(mock_deps)
        graph = mock_deps["SingleAgentGraph"].return_value

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

        mock_deps["update_run_result"].assert_awaited_with(
            run_id="run-8",
            pm_document="<pm_document>doc</pm_document>",
            code="<review>Looks good</review>",
            review="<review>Looks good</review>",
            approved=True,
            status="converged",
        )
