from unittest.mock import MagicMock, patch

import pytest

from virtual_team.workflow.graph_builder import GraphBuilder
from virtual_team.workflow.models import WorkflowConfig, WorkflowEdge, WorkflowNode, WorkflowState


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
