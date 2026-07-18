"""Tests for SingleAgentGraph core — structure, nodes, and LLM integration."""
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

os.environ["AUTH_MODE"] = "legacy"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["KEY_VAULT_SECRET"] = "0123456789abcdef0123456789abcdef"
os.environ["AUTH_ENABLED"] = "0"
os.environ["RATE_LIMIT"] = "9999"
os.environ["CHECKPOINTER_BACKEND"] = "memory"
os.environ["DATABASE_POOL_SIZE"] = "0"

from langchain_core.messages import AIMessage, HumanMessage

from virtual_team.graph.graph import SingleAgentGraph
from virtual_team.graph.graph_state import AgentState


@pytest.fixture
def mock_llm():
    llm = MagicMock()
    llm.__class__.__name__ = "ChatOpenAI"
    return llm


@pytest.fixture
def graph(mock_llm):
    with patch("virtual_team.graph.ChatOpenAI", return_value=mock_llm):
        g = SingleAgentGraph(
            model="test-model",
            api_key="test-key",
        )
        return g


@pytest.fixture
def graph_with_base_url(mock_llm):
    with patch("virtual_team.graph.ChatOpenAI", return_value=mock_llm):
        g = SingleAgentGraph(
            model="test-model",
            api_key="test-key",
            base_url="https://custom.api.com/v1",
        )
        return g



class TestSingleAgentGraphInit:
    def test_init_with_model_and_api_key(self):
        with patch("virtual_team.graph.ChatOpenAI") as mock_llm_cls:
            with patch("virtual_team.graph.StateGraph"):
                from virtual_team.graph.graph import SingleAgentGraph

                sg = SingleAgentGraph(
                    model="deepseek-chat",
                    api_key="sk-test",
                    checkpointer=MagicMock(),
                )
                assert sg.model == "deepseek-chat"
                assert sg.api_key == "sk-test"
                mock_llm_cls.assert_called_once_with(
                    model="deepseek-chat",
                    api_key="sk-test",
                    temperature=0.7,
                    max_tokens=65536,
                )

    def test_init_with_base_url(self):
        with patch("virtual_team.graph.ChatOpenAI") as mock_llm_cls:
            with patch("virtual_team.graph.StateGraph"):
                from virtual_team.graph.graph import SingleAgentGraph

                SingleAgentGraph(
                    model="gpt-4",
                    api_key="sk-xxx",
                    base_url="https://api.openai.com/v1",
                    checkpointer=MagicMock(),
                )
                mock_llm_cls.assert_called_once_with(
                    model="gpt-4",
                    api_key="sk-xxx",
                    temperature=0.7,
                    max_tokens=65536,
                    base_url="https://api.openai.com/v1",
                )

    def test_init_with_custom_params(self):
        with patch("virtual_team.graph.ChatOpenAI") as mock_llm_cls:
            with patch("virtual_team.graph.StateGraph"):
                from virtual_team.graph.graph import SingleAgentGraph

                SingleAgentGraph(
                    model="deepseek-chat",
                    api_key="sk-test",
                    temperature=0.1,
                    max_tokens=2048,
                    checkpointer=MagicMock(),
                )
                mock_llm_cls.assert_called_once_with(
                    model="deepseek-chat",
                    api_key="sk-test",
                    temperature=0.1,
                    max_tokens=2048,
                )

    def test_init_with_checkpointer(self):
        with patch("virtual_team.graph.ChatOpenAI"):
            with patch("virtual_team.graph.StateGraph"):
                from langgraph.checkpoint.memory import MemorySaver

                from virtual_team.graph.graph import SingleAgentGraph

                ms = MemorySaver()
                graph = SingleAgentGraph(model="deepseek-chat", api_key="sk-test", checkpointer=ms)
                assert graph.checkpointer is ms

    def test_init_creates_graph(self):
        with patch("virtual_team.graph.ChatOpenAI"):
            with patch("virtual_team.graph.StateGraph") as mock_sg_cls:
                mock_builder = MagicMock()
                mock_sg_cls.return_value = mock_builder
                mock_compiled = MagicMock()
                mock_builder.compile.return_value = mock_compiled

                from virtual_team.graph.graph import SingleAgentGraph

                sg = SingleAgentGraph(
                    model="deepseek-chat",
                    api_key="sk-test",
                    checkpointer=MagicMock(),
                )
                assert sg._graph is mock_compiled

    def test_init_with_default_checkpointer(self):
        with patch("virtual_team.graph.ChatOpenAI"):
            with patch("virtual_team.graph.StateGraph"):
                with patch("virtual_team.checkpoint.create_checkpointer") as mock_cc:
                    mock_cc.return_value = MagicMock()
                    from virtual_team.graph.graph import SingleAgentGraph

                    sg = SingleAgentGraph(model="deepseek-chat", api_key="sk-test")
                    assert sg.checkpointer is mock_cc.return_value
                    mock_cc.assert_called_once()


class TestSingleAgentGraphBuildGraph:
    def test_build_graph_adds_nodes_and_edges(self):
        sg, compiled = _make_graph()
        assert sg._graph is compiled


class TestSingleAgentGraphShouldContinue:
    def test_continue_when_tool_calls(self):

        sg, _ = _make_graph()
        state: AgentState = {
            "messages": [AIMessage(content="", tool_calls=[{"name": "search", "args": {}, "id": "c1"}])],
            "system_prompt": "",
            "session_context": "",
        }
        result = sg._should_continue(state)
        assert result == "tools"

    def test_end_when_no_tool_calls(self):

        sg, _ = _make_graph()
        state: AgentState = {
            "messages": [AIMessage(content="Hello")],
            "system_prompt": "",
            "session_context": "",
        }
        result = sg._should_continue(state)
        assert result == "__end__"

    def test_end_when_empty_messages(self):

        sg, _ = _make_graph()
        state: AgentState = {
            "messages": [],
            "system_prompt": "",
            "session_context": "",
        }
        result = sg._should_continue(state)
        assert result == "__end__"


class TestSingleAgentGraphBindTools:
    def test_bind_tools_adds_to_map(self):
        with patch("virtual_team.graph.build_tool_definition") as mock_btd:
            mock_wrapper = MagicMock()
            mock_btd.return_value = ("search_tool", mock_wrapper, {"name": "search_tool"})

            sg, _ = _make_graph()
            sg.bind_tools([MagicMock()])

            assert "search_tool" in sg._tool_map
            assert sg._tool_map["search_tool"] is mock_wrapper
            assert len(sg._tool_definitions) == 1


class TestSingleAgentGraphErrors:
    def test_missing_api_key_raises_on_llm_init(self):
        with patch("virtual_team.graph.ChatOpenAI") as mock_llm:
            mock_llm.side_effect = ValueError("API key required")
            with patch("virtual_team.graph.StateGraph"):
                from virtual_team.graph.graph import SingleAgentGraph

                with pytest.raises(ValueError, match="API key required"):
                    SingleAgentGraph(model="deepseek-chat", api_key="", checkpointer=MagicMock())


class TestSingleAgentGraphProperties:
    def test_graph_property(self):
        sg, compiled = _make_graph()
        assert sg.graph is compiled

    def test_with_config_returns_self(self):
        sg, _ = _make_graph()
        result = sg.with_config(custom_key="value")
        assert result is sg

    def test_set_stream_callback(self):
        sg, _ = _make_graph()
        cb = MagicMock()
        sg.set_stream_callback(cb)
        assert sg._stream_cb is cb


class TestSingleAgentGraphRun:
    @pytest.mark.asyncio
    async def test_run_calls_ainvoke(self):
        sg, compiled = _make_graph()
        compiled.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content="Hello!")]})
        result = await sg.run(requirement="Hi")
        assert result["messages"][-1].content == "Hello!"

    @pytest.mark.asyncio
    async def test_run_with_chat_history(self):
        sg, compiled = _make_graph()
        compiled.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content="Result")]})
        result = await sg.run(
            requirement="Continue",
            chat_history=[HumanMessage(content="Previous chat")],
        )
        assert result["messages"][-1].content == "Result"

    @pytest.mark.asyncio
    async def test_run_returns_usage(self):
        sg, compiled = _make_graph()
        compiled.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content="Done")]})
        sg._last_usage = {"input_tokens": 10, "output_tokens": 20}
        result = await sg.run(requirement="test")
        assert result["input_tokens"] == 10
        assert result["output_tokens"] == 20

import pytest

from virtual_team.workflow.graph_builder import GraphBuilder
from virtual_team.workflow.models import WorkflowConfig, WorkflowEdge, WorkflowNode


@pytest.fixture
def node_factory():
    factory = MagicMock()
    factory.create.return_value = lambda s: {"messages": []}
    return factory


@pytest.fixture
def router():
    r = MagicMock()
    r.resolve.return_value = "end"
    return r


@pytest.fixture
def builder(node_factory, router):
    return GraphBuilder(node_factory=node_factory, router=router)


class TestGraphBuilderInit:
    def test_init_stores_deps(self, builder, node_factory, router):
        assert builder.node_factory is node_factory
        assert builder.router is router
        assert builder.checkpointer is None

    def test_init_with_checkpointer(self, node_factory, router):
        cp = MagicMock()
        gb = GraphBuilder(node_factory=node_factory, router=router, checkpointer=cp)
        assert gb.checkpointer is cp


class TestGraphBuilderBuild:
    def test_build_empty_nodes(self, builder):
        config = WorkflowConfig(id="empty", team_id="t1", name="empty", nodes=[], edges=[])
        with patch("virtual_team.workflow.graph_builder.StateGraph") as mock_sg:
            mock_instance = MagicMock()
            mock_sg.return_value = mock_instance
            mock_instance.compile.return_value = "compiled"

            result = builder.build(config)

            assert result == "compiled"
            mock_sg.assert_called_once()
            mock_instance.compile.assert_called_once()

    def test_build_with_nodes_and_edges(self, builder):
        node_a = WorkflowNode(id="n1", agent_config_id="ag1", role_identifier="writer", order=0)
        node_b = WorkflowNode(id="n2", agent_config_id="ag2", role_identifier="reviewer", order=1)
        edge = WorkflowEdge(from_node_id="writer", to_node_id="reviewer")

        config = WorkflowConfig(
            id="cfg1", team_id="t1", name="test", nodes=[node_a, node_b], edges=[edge]
        )

        result = builder.build(config)
        assert result is not None

    def test_build_with_conditional_edges(self, builder):
        node_a = WorkflowNode(id="n1", agent_config_id="ag1", role_identifier="writer", order=0)
        node_b = WorkflowNode(id="n2", agent_config_id="ag2", role_identifier="reviewer", order=1)
        edge = WorkflowEdge(from_node_id="writer", to_node_id="reviewer", condition_key="approved|done")

        config = WorkflowConfig(
            id="cfg2", team_id="t1", name="conditional", nodes=[node_a, node_b], edges=[edge]
        )

        result = builder.build(config)
        assert result is not None

    def test_build_with_default_edge(self, builder):
        node_a = WorkflowNode(id="n1", agent_config_id="ag1", role_identifier="writer", order=0)
        node_b = WorkflowNode(id="n2", agent_config_id="ag2", role_identifier="reviewer", order=1)
        edge = WorkflowEdge(from_node_id="writer", to_node_id="reviewer", is_default=True)

        config = WorkflowConfig(
            id="cfg3", team_id="t1", name="default-edge", nodes=[node_a, node_b], edges=[edge]
        )

        result = builder.build(config)
        assert result is not None

    def test_build_node_goes_to_end(self, builder):
        node = WorkflowNode(id="n1", agent_config_id="ag1", role_identifier="solo", order=0)
        config = WorkflowConfig(
            id="cfg4", team_id="t1", name="solo", nodes=[node], edges=[]
        )

        result = builder.build(config)
        assert result is not None


class TestBuildEdgeMap:
    def test_build_edge_map_returns_correct_edges(self, builder):
        edges = [
            WorkflowEdge(from_node_id="a", to_node_id="b", condition_key="ok|yes"),
            WorkflowEdge(from_node_id="a", to_node_id="c", condition_key="maybe"),
            WorkflowEdge(from_node_id="a", to_node_id="end", is_default=True),
        ]
        edge_map = builder._build_edge_map(edges)

        assert edge_map["ok"] == "b"
        assert edge_map["yes"] == "b"
        assert edge_map["maybe"] == "c"
        assert edge_map["*"] == "end"

    def test_build_edge_map_without_default(self, builder):
        edges = [
            WorkflowEdge(from_node_id="a", to_node_id="b", condition_key="ok"),
        ]
        edge_map = builder._build_edge_map(edges)

        assert edge_map["ok"] == "b"
        from langgraph.graph import END
        assert edge_map["*"] == END

    def test_build_edge_map_empty(self, builder):
        edge_map = builder._build_edge_map([])
        from langgraph.graph import END
        assert edge_map["*"] == END


class TestBuildConditionalMap:
    def test_build_conditional_map_returns_correct_mapping(self, builder):
        edges = [
            WorkflowEdge(from_node_id="n1", to_node_id="n2", condition_key="approved|done"),
            WorkflowEdge(from_node_id="n1", to_node_id="n3", condition_key="rejected"),
            WorkflowEdge(from_node_id="n1", to_node_id="END", is_default=True),
        ]
        result = builder._build_edge_map(edges)
        assert result["approved"] == "n2"
        assert result["done"] == "n2"
        assert result["rejected"] == "n3"
        assert result["*"] == "END"
