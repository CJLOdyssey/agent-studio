"""Tests for LLM-based edge routing (routing_mode="llm")."""

import os
from dataclasses import dataclass, field

import pytest

os.environ.setdefault("AUTH_MODE", "legacy")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("KEY_VAULT_SECRET", "0123456789abcdef0123456789abcdef")
os.environ.setdefault("AUTH_ENABLED", "0")
os.environ.setdefault("RATE_LIMIT", "9999")
os.environ.setdefault("CHECKPOINTER_BACKEND", "memory")
os.environ.setdefault("DATABASE_POOL_SIZE", "0")

from langgraph.graph import END
from workflow.graph_builder import GraphBuilder
from workflow.models import (
    WorkflowConfig,
    WorkflowEdge,
    WorkflowNode,
    create_initial_state,
)
from workflow.router import Router


class FakeFactory:
    """Stand-in for NodeFactory that returns canned node functions."""

    def __init__(self, fns):
        self.fns = fns

    def create(self, node):
        return self.fns.get(node.role_identifier) or (lambda state: {})


@dataclass
class _Resp:
    content: str


@dataclass
class FakeLLM:
    content: str = "qa"
    calls: int = field(default=0, init=False)

    async def ainvoke(self, messages):
        self.calls += 1
        return _Resp(self.content)


@pytest.mark.unit
class TestLLMRouter:
    async def test_resolve_llm_returns_chosen_candidate(self):
        edges = [
            WorkflowEdge(id="e1", from_node_id="pm", to_node_id="dev", routing_mode="llm"),
            WorkflowEdge(id="e2", from_node_id="pm", to_node_id="qa", routing_mode="llm"),
        ]
        state = create_initial_state("task")
        state["artifacts"] = {"pm": "draft"}
        llm = FakeLLM("qa")
        chosen = await Router().resolve_llm(edges, state, "pm", llm)
        assert chosen == "qa"
        assert llm.calls == 1

    async def test_resolve_llm_invalid_choice_falls_back_to_default(self):
        edges = [
            WorkflowEdge(id="e1", from_node_id="pm", to_node_id="dev", routing_mode="llm"),
            WorkflowEdge(
                id="e2", from_node_id="pm", to_node_id="qa", routing_mode="llm", is_default=True
            ),
        ]
        state = create_initial_state("task")
        llm = FakeLLM("bogus")
        assert await Router().resolve_llm(edges, state, "pm", llm) == "qa"

    async def test_resolve_llm_no_candidates_returns_end(self):
        edges = [WorkflowEdge(id="e1", from_node_id="pm", to_node_id="END", routing_mode="llm")]
        state = create_initial_state("task")
        assert await Router().resolve_llm(edges, state, "pm", FakeLLM("pm")) == END

    async def test_resolve_llm_no_default_falls_back_to_end(self):
        edges = [
            WorkflowEdge(id="e1", from_node_id="pm", to_node_id="dev", routing_mode="llm"),
            WorkflowEdge(id="e2", from_node_id="pm", to_node_id="qa", routing_mode="llm"),
        ]
        state = create_initial_state("task")
        assert await Router().resolve_llm(edges, state, "pm", FakeLLM("bogus")) == END


@pytest.mark.unit
class TestGraphLLMRouting:
    async def test_graph_routes_to_llm_chosen_node(self):
        edges = [
            WorkflowEdge(id="e1", from_node_id="pm", to_node_id="dev", condition_key="go", routing_mode="llm"),
            WorkflowEdge(
                id="e2", from_node_id="pm", to_node_id="qa", condition_key="go",
                routing_mode="llm", is_default=True,
            ),
        ]
        nodes = [
            WorkflowNode(id="n1", role_identifier="pm", order=0),
            WorkflowNode(id="n2", role_identifier="dev", order=1),
            WorkflowNode(id="n3", role_identifier="qa", order=2),
        ]
        config = WorkflowConfig(id="c1", name="t", max_rounds=5, nodes=nodes, edges=edges)
        fns = {
            "pm": lambda s: {"artifacts": {"pm": "draft"}},
            "dev": lambda s: {"artifacts": {"dev": "dev-out"}},
            "qa": lambda s: {"artifacts": {"qa": "qa-out"}},
        }
        graph = GraphBuilder(FakeFactory(fns), Router(), llm=FakeLLM("qa")).build(config)
        result = await graph.ainvoke(create_initial_state("task"), {"recursion_limit": 50})
        assert result["artifacts"].get("qa") == "qa-out"
        assert "dev" not in result["artifacts"]
