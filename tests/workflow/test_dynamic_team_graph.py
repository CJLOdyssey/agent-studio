"""Tests for backend/workflow/dynamic_team_graph.py."""

import os
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

os.environ.setdefault("AUTH_MODE", "legacy")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("KEY_VAULT_SECRET", "0123456789abcdef0123456789abcdef")
os.environ.setdefault("AUTH_ENABLED", "0")
os.environ.setdefault("RATE_LIMIT", "9999")
os.environ.setdefault("CHECKPOINTER_BACKEND", "memory")
os.environ.setdefault("DATABASE_POOL_SIZE", "0")

from backend.workflow.dynamic_team_graph import DynamicTeamGraph
from backend.workflow.models import (
    NodeStrategy,
    WorkflowConfig,
    WorkflowEdge,
    WorkflowNode,
    create_initial_state,
)


@pytest.mark.unit
class TestDynamicTeamGraphInit:
    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    def test_init_defaults(self, mock_chat_cls):
        graph = DynamicTeamGraph()
        mock_chat_cls.assert_called_once()
        call_kwargs = mock_chat_cls.call_args[1]
        assert call_kwargs["model"] == "deepseek-chat"
        assert call_kwargs["streaming"] is True
        assert graph._config is None
        assert graph._graph is None

    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    def test_init_with_base_url(self, mock_chat_cls):
        DynamicTeamGraph(base_url="https://custom.api.com/v1")
        call_kwargs = mock_chat_cls.call_args[1]
        assert call_kwargs["base_url"] == "https://custom.api.com/v1"

    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    def test_init_without_base_url(self, mock_chat_cls):
        DynamicTeamGraph()
        call_kwargs = mock_chat_cls.call_args[1]
        assert "base_url" not in call_kwargs

    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    def test_init_custom_params(self, mock_chat_cls):
        DynamicTeamGraph(model="gpt-4", temperature=0.3, max_tokens=4096)
        call_kwargs = mock_chat_cls.call_args[1]
        assert call_kwargs["model"] == "gpt-4"
        assert call_kwargs["temperature"] == 0.3
        assert call_kwargs["max_tokens"] == 4096

    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    def test_init_with_checkpointer(self, mock_chat_cls):
        cp = MagicMock()
        graph = DynamicTeamGraph(checkpointer=cp)
        assert graph.checkpointer is cp


@pytest.mark.unit
class TestDynamicTeamGraphSetWorkflowSync:
    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    def test_set_workflow_sync_maps_agents(self, mock_chat_cls):
        graph = DynamicTeamGraph()

        @dataclass
        class FakeAgent:
            id: str = ""
            system_prompt: str = ""

        config = WorkflowConfig(
            id="c1",
            nodes=[
                WorkflowNode(id="n1", agent_config_id="ag1", role_identifier="pm", order=0),
                WorkflowNode(id="n2", agent_config_id="ag2", role_identifier="dev", order=1),
            ],
            edges=[],
        )
        agents = [FakeAgent(id="ag1", system_prompt="Be a PM"), FakeAgent(id="ag2", system_prompt="Write code")]
        graph.set_workflow_sync(config, agents)
        assert graph._agent_prompts["pm"] == "Be a PM"
        assert graph._agent_prompts["dev"] == "Write code"

    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    def test_set_workflow_sync_no_matching_agents(self, mock_chat_cls):
        graph = DynamicTeamGraph()
        config = WorkflowConfig(
            id="c1",
            nodes=[WorkflowNode(id="n1", agent_config_id="ag_missing", role_identifier="pm", order=0)],
            edges=[],
        )
        graph.set_workflow_sync(config, [])
        assert "pm" not in graph._agent_prompts

    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    def test_set_workflow_sync_agent_without_id(self, mock_chat_cls):
        graph = DynamicTeamGraph()
        agent = MagicMock(spec=[])  # no 'id' attribute
        config = WorkflowConfig(
            id="c1",
            nodes=[WorkflowNode(id="n1", agent_config_id="ag1", role_identifier="pm", order=0)],
            edges=[],
        )
        graph.set_workflow_sync(config, [agent])
        assert "pm" not in graph._agent_prompts

    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    def test_set_workflow_sync_stores_config(self, mock_chat_cls):
        graph = DynamicTeamGraph()
        config = WorkflowConfig(
            id="c1",
            nodes=[WorkflowNode(id="n1", role_identifier="pm", order=0)],
            edges=[],
        )
        graph.set_workflow_sync(config, [])
        assert graph._config is config


@pytest.mark.unit
class TestDynamicTeamGraphBuild:
    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    def test_build_no_config_returns(self, mock_chat_cls):
        graph = DynamicTeamGraph()
        graph._config = None
        graph._build()
        assert graph._graph is None

    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    @patch("backend.workflow.dynamic_team_graph.GraphBuilder")
    def test_build_creates_graph(self, mock_builder_cls, mock_chat_cls):
        graph = DynamicTeamGraph()
        mock_builder = MagicMock()
        mock_builder_cls.return_value = mock_builder
        mock_builder.build.return_value = MagicMock()
        config = WorkflowConfig(
            id="c1",
            nodes=[WorkflowNode(id="n1", role_identifier="pm", order=0)],
            edges=[],
        )
        graph._config = config
        graph._build()
        mock_builder.build.assert_called_once_with(config)
        assert graph._graph is not None


@pytest.mark.unit
class TestDynamicTeamGraphSetWorkflowAsync:
    @pytest.mark.asyncio
    @patch("backend.workflow.dynamic_team_graph.get_agent_configs", new_callable=AsyncMock)
    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    async def test_set_workflow_fetches_agents(self, mock_chat_cls, mock_get_agents):
        graph = DynamicTeamGraph()
        mock_agent = MagicMock()
        mock_agent.id = "ag1"
        mock_agent.system_prompt = "prompt text"
        mock_get_agents.return_value = [mock_agent]

        config = WorkflowConfig(
            id="c1",
            nodes=[WorkflowNode(id="n1", agent_config_id="ag1", role_identifier="pm", order=0)],
            edges=[],
        )
        await graph.set_workflow(config)
        assert graph._agent_prompts["pm"] == "prompt text"

    @pytest.mark.asyncio
    @patch("backend.workflow.dynamic_team_graph.get_agent_configs", new_callable=AsyncMock)
    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    async def test_set_workflow_no_matching_agents(self, mock_chat_cls, mock_get_agents):
        graph = DynamicTeamGraph()
        mock_agent = MagicMock()
        mock_agent.id = "ag_other"
        mock_get_agents.return_value = [mock_agent]

        config = WorkflowConfig(
            id="c1",
            nodes=[WorkflowNode(id="n1", agent_config_id="ag1", role_identifier="pm", order=0)],
            edges=[],
        )
        await graph.set_workflow(config)
        assert "pm" not in graph._agent_prompts


@pytest.mark.unit
class TestDynamicTeamGraphRun:
    @pytest.mark.asyncio
    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    async def test_run_raises_if_graph_not_built(self, mock_chat_cls):
        graph = DynamicTeamGraph()
        graph._graph = None
        with pytest.raises(RuntimeError, match="Graph not built"):
            await graph.run("requirement", "thread-1")

    @pytest.mark.asyncio
    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    async def test_run_without_stream_callback(self, mock_chat_cls):
        graph = DynamicTeamGraph()
        mock_compiled = AsyncMock()
        expected_state = create_initial_state("do something")
        expected_state["messages"] = expected_state["messages"]
        mock_compiled.ainvoke = AsyncMock(return_value=expected_state)
        graph._graph = mock_compiled

        result = await graph.run("do something", "thread-1")
        mock_compiled.ainvoke.assert_called_once()
        assert "requirement" in result

    @pytest.mark.asyncio
    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    async def test_run_with_run_id_rebuilds(self, mock_chat_cls):
        graph = DynamicTeamGraph()
        config = WorkflowConfig(
            id="c1",
            nodes=[WorkflowNode(id="n1", role_identifier="pm", order=0)],
            edges=[],
        )
        graph._config = config
        mock_compiled = MagicMock()
        mock_compiled.ainvoke = AsyncMock(return_value=create_initial_state("test"))
        with patch.object(graph, "_build") as mock_build:
            graph._graph = mock_compiled
            await graph.run("test", "thread-1", run_id="run-123")
            assert graph._run_id == "run-123"
            mock_build.assert_called()

    @pytest.mark.asyncio
    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    async def test_run_with_stream_callback(self, mock_chat_cls):
        graph = DynamicTeamGraph()
        graph._graph = AsyncMock()

        async def mock_astream(*args, **kwargs):
            yield {"event": "on_chain_end", "name": "LangGraph", "data": {"output": {"a": 1}}}
            yield {"event": "on_llm_start", "name": "llm", "data": {}}

        graph._graph.astream_events = mock_astream
        callback = AsyncMock()
        result = await graph.run("req", "t1", stream_callback=callback)
        assert callback.call_count >= 1

    @pytest.mark.asyncio
    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    async def test_run_stream_callback_exception_suppressed(self, mock_chat_cls):
        graph = DynamicTeamGraph()
        graph._graph = AsyncMock()

        async def mock_astream(*args, **kwargs):
            yield {"event": "on_chain_end", "name": "LangGraph", "data": {"output": {"a": 1}}}

        graph._graph.astream_events = mock_astream
        callback = AsyncMock(side_effect=RuntimeError("callback boom"))
        result = await graph.run("req", "t1", stream_callback=callback)
        assert isinstance(result, dict)

    @pytest.mark.asyncio
    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    async def test_run_stream_non_dict_result(self, mock_chat_cls):
        graph = DynamicTeamGraph()
        graph._graph = AsyncMock()

        async def mock_astream(*args, **kwargs):
            yield {"event": "on_chain_end", "name": "LangGraph", "data": {"output": "not a dict"}}

        graph._graph.astream_events = mock_astream
        result = await graph.run("req", "t1", stream_callback=AsyncMock())
        assert result == {}

    @pytest.mark.asyncio
    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    async def test_run_ainvoke_non_dict_result(self, mock_chat_cls):
        graph = DynamicTeamGraph()
        mock_compiled = AsyncMock()
        mock_compiled.ainvoke = AsyncMock(return_value="not a dict")
        graph._graph = mock_compiled
        result = await graph.run("req", "t1")
        assert result == {}

    @pytest.mark.asyncio
    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    async def test_run_stream_default_keys_filled(self, mock_chat_cls):
        graph = DynamicTeamGraph()
        graph._graph = AsyncMock()

        async def mock_astream(*args, **kwargs):
            yield {
                "event": "on_chain_end",
                "name": "LangGraph",
                "data": {"output": {"messages": [], "round_number": 1}},
            }

        graph._graph.astream_events = mock_astream
        result = await graph.run("req", "t1", stream_callback=AsyncMock())
        assert "requirement" in result
        assert "artifacts" in result
        assert "approved" in result

    @pytest.mark.asyncio
    @patch("backend.workflow.dynamic_team_graph.ChatOpenAI")
    async def test_run_stream_none_callback(self, mock_chat_cls):
        graph = DynamicTeamGraph()
        graph._graph = AsyncMock()

        async def mock_astream(*args, **kwargs):
            yield {"event": "other", "name": "x", "data": {}}

        graph._graph.astream_events = mock_astream
        result = await graph.run("req", "t1", stream_callback=AsyncMock())
        assert result == {}
