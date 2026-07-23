"""Tests for backend/workflow/graph_builder.py."""

import os
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("AUTH_MODE", "legacy")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("KEY_VAULT_SECRET", "0123456789abcdef0123456789abcdef")
os.environ.setdefault("AUTH_ENABLED", "0")
os.environ.setdefault("RATE_LIMIT", "9999")
os.environ.setdefault("CHECKPOINTER_BACKEND", "memory")
os.environ.setdefault("DATABASE_POOL_SIZE", "0")

from backend.workflow.graph_builder import GraphBuilder
from backend.workflow.models import (
    NodeStrategy,
    WorkflowConfig,
    WorkflowEdge,
    WorkflowNode,
)
from backend.workflow.node_factory import NodeFactory
from backend.workflow.router import Router


@pytest.mark.unit
class TestGraphBuilderInit:
    def test_init(self):
        factory = MagicMock(spec=NodeFactory)
        router = MagicMock(spec=Router)
        builder = GraphBuilder(factory, router)
        assert builder.node_factory is factory
        assert builder.router is router
        assert builder.checkpointer is None

    def test_init_with_checkpointer(self):
        factory = MagicMock(spec=NodeFactory)
        router = MagicMock(spec=Router)
        cp = MagicMock()
        builder = GraphBuilder(factory, router, checkpointer=cp)
        assert builder.checkpointer is cp


@pytest.mark.unit
class TestGraphBuilderBuild:
    def _make_config(self, nodes, edges=None):
        return WorkflowConfig(id="c1", name="test", nodes=nodes, edges=edges or [])

    def test_build_single_node_no_edges(self):
        factory = MagicMock(spec=NodeFactory)
        factory.create.return_value = lambda state: {}
        router = MagicMock(spec=Router)
        builder = GraphBuilder(factory, router)
        config = self._make_config(
            nodes=[WorkflowNode(id="n1", role_identifier="pm", order=0)],
        )
        compiled = builder.build(config)
        assert compiled is not None
        factory.create.assert_called_once()

    def test_build_two_nodes_linear(self):
        factory = MagicMock(spec=NodeFactory)
        factory.create.return_value = lambda state: {}
        router = MagicMock(spec=Router)
        builder = GraphBuilder(factory, router)
        config = self._make_config(
            nodes=[
                WorkflowNode(id="n1", role_identifier="pm", order=0),
                WorkflowNode(id="n2", role_identifier="dev", order=1),
            ],
            edges=[WorkflowEdge(id="e1", from_node_id="pm", to_node_id="dev")],
        )
        compiled = builder.build(config)
        assert compiled is not None

    def test_build_nodes_sorted_by_order(self):
        factory = MagicMock(spec=NodeFactory)
        factory.create.return_value = lambda state: {}
        router = MagicMock(spec=Router)
        builder = GraphBuilder(factory, router)
        config = self._make_config(
            nodes=[
                WorkflowNode(id="n2", role_identifier="dev", order=2),
                WorkflowNode(id="n1", role_identifier="pm", order=0),
                WorkflowNode(id="n3", role_identifier="qa", order=1),
            ],
            edges=[
                WorkflowEdge(id="e1", from_node_id="pm", to_node_id="qa"),
                WorkflowEdge(id="e2", from_node_id="qa", to_node_id="dev"),
            ],
        )
        compiled = builder.build(config)
        assert compiled is not None

    def test_build_end_edge_with_condition_key(self):
        factory = MagicMock(spec=NodeFactory)
        factory.create.return_value = lambda state: {}
        router = MagicMock(spec=Router)
        builder = GraphBuilder(factory, router)
        config = self._make_config(
            nodes=[
                WorkflowNode(id="n1", role_identifier="pm", order=0),
                WorkflowNode(id="n2", role_identifier="qa", order=1),
            ],
            edges=[
                WorkflowEdge(id="e1", from_node_id="pm", to_node_id="qa"),
                WorkflowEdge(
                    id="e2",
                    from_node_id="qa",
                    to_node_id="END",
                    condition_key="APPROVED|PASS",
                ),
                WorkflowEdge(
                    id="e3",
                    from_node_id="qa",
                    to_node_id="pm",
                    is_default=True,
                ),
            ],
        )
        compiled = builder.build(config)
        assert compiled is not None

    def test_build_end_edge_without_condition(self):
        factory = MagicMock(spec=NodeFactory)
        factory.create.return_value = lambda state: {}
        router = MagicMock(spec=Router)
        builder = GraphBuilder(factory, router)
        config = self._make_config(
            nodes=[
                WorkflowNode(id="n1", role_identifier="pm", order=0),
                WorkflowNode(id="n2", role_identifier="qa", order=1),
            ],
            edges=[
                WorkflowEdge(id="e1", from_node_id="pm", to_node_id="qa"),
                WorkflowEdge(id="e2", from_node_id="qa", to_node_id="END"),
            ],
        )
        compiled = builder.build(config)
        assert compiled is not None

    def test_build_conditional_edges(self):
        factory = MagicMock(spec=NodeFactory)
        factory.create.return_value = lambda state: {}
        router = MagicMock(spec=Router)
        builder = GraphBuilder(factory, router)
        config = self._make_config(
            nodes=[
                WorkflowNode(id="n1", role_identifier="qa", order=0),
                WorkflowNode(id="n2", role_identifier="dev", order=1),
                WorkflowNode(id="n3", role_identifier="pm", order=2),
            ],
            edges=[
                WorkflowEdge(id="e1", from_node_id="qa", to_node_id="dev", condition_key="NEED_FIX"),
                WorkflowEdge(id="e2", from_node_id="qa", to_node_id="pm", is_default=True),
            ],
        )
        compiled = builder.build(config)
        assert compiled is not None

    def test_build_multiple_unconditional_edges(self):
        factory = MagicMock(spec=NodeFactory)
        factory.create.return_value = lambda state: {}
        router = MagicMock(spec=Router)
        builder = GraphBuilder(factory, router)
        config = self._make_config(
            nodes=[
                WorkflowNode(id="n1", role_identifier="fan_out", order=0),
                WorkflowNode(id="n2", role_identifier="a", order=1),
                WorkflowNode(id="n3", role_identifier="b", order=2),
            ],
            edges=[
                WorkflowEdge(id="e1", from_node_id="fan_out", to_node_id="a"),
                WorkflowEdge(id="e2", from_node_id="fan_out", to_node_id="b"),
            ],
        )
        compiled = builder.build(config)
        assert compiled is not None


@pytest.mark.unit
class TestBuildEdgeMap:
    def test_build_edge_map_with_condition(self):
        factory = MagicMock(spec=NodeFactory)
        router = MagicMock(spec=Router)
        builder = GraphBuilder(factory, router)
        edges = [
            WorkflowEdge(id="e1", from_node_id="n1", to_node_id="n2", condition_key="fix|bug"),
        ]
        result = builder._build_edge_map(edges)
        assert "fix" in result
        assert "bug" in result
        assert result["fix"] == "n2"
        assert result["*"] is not None

    def test_build_edge_map_default_edge(self):
        factory = MagicMock(spec=NodeFactory)
        router = MagicMock(spec=Router)
        builder = GraphBuilder(factory, router)
        edges = [
            WorkflowEdge(id="e1", from_node_id="n1", to_node_id="n2", condition_key="fix"),
            WorkflowEdge(id="e2", from_node_id="n1", to_node_id="n3", is_default=True),
        ]
        result = builder._build_edge_map(edges)
        assert result["*"] == "n3"

    def test_build_edge_map_no_default(self):
        factory = MagicMock(spec=NodeFactory)
        router = MagicMock(spec=Router)
        builder = GraphBuilder(factory, router)
        edges = [
            WorkflowEdge(id="e1", from_node_id="n1", to_node_id="n2"),
        ]
        result = builder._build_edge_map(edges)
        assert result["*"] is not None

    def test_build_edge_map_duplicate_keyword_skipped(self):
        factory = MagicMock(spec=NodeFactory)
        router = MagicMock(spec=Router)
        builder = GraphBuilder(factory, router)
        edges = [
            WorkflowEdge(id="e1", from_node_id="n1", to_node_id="n2", condition_key="dup"),
            WorkflowEdge(id="e2", from_node_id="n1", to_node_id="n3", condition_key="dup"),
        ]
        result = builder._build_edge_map(edges)
        assert result["dup"] == "n2"  # first wins

    def test_build_edge_map_empty_keyword_stripped(self):
        factory = MagicMock(spec=NodeFactory)
        router = MagicMock(spec=Router)
        builder = GraphBuilder(factory, router)
        edges = [
            WorkflowEdge(id="e1", from_node_id="n1", to_node_id="n2", condition_key="|valid|"),
        ]
        result = builder._build_edge_map(edges)
        assert "" not in result
        assert "valid" in result
