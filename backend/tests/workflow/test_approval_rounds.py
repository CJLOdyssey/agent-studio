"""Tests for approval gate + iteration rounds in the workflow graph."""

import os

import pytest

os.environ.setdefault("AUTH_MODE", "legacy")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("KEY_VAULT_SECRET", "0123456789abcdef0123456789abcdef")
os.environ.setdefault("AUTH_ENABLED", "0")
os.environ.setdefault("RATE_LIMIT", "9999")
os.environ.setdefault("CHECKPOINTER_BACKEND", "memory")
os.environ.setdefault("DATABASE_POOL_SIZE", "0")

from workflow.graph_builder import GraphBuilder
from workflow.models import (
    NodeStrategy,
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


def _review_config(max_rounds=3, with_reporter=True, reject_until=None):
    """pm -> reviewer (-> reporter). `reject_until` = round number at which approval flips."""
    nodes = [
        WorkflowNode(id="n1", role_identifier="pm", strategy=NodeStrategy.GENERATOR, order=0),
        WorkflowNode(id="n2", role_identifier="reviewer", strategy=NodeStrategy.REVIEWER, order=1),
    ]
    edges = [WorkflowEdge(id="e1", from_node_id="pm", to_node_id="reviewer")]
    if with_reporter:
        nodes.append(WorkflowNode(id="n3", role_identifier="reporter", strategy=NodeStrategy.REPORTER, order=2))
        edges.append(WorkflowEdge(id="e2", from_node_id="reviewer", to_node_id="reporter"))
    return WorkflowConfig(id="c1", name="t", max_rounds=max_rounds, nodes=nodes, edges=edges)


def _reviewer_fn(always_reject=False, approve_from=None):
    def fn(state):
        r = int(state.get("round_number", 1))
        approved = not always_reject and (approve_from is None or r >= approve_from)
        return {
            "artifacts": {"reviewer": f"verdict r{r}"},
            "approved": {"reviewer": approved},
            "verdicts": {"reviewer": {"approved": approved, "reason": "x", "rounds": r}},
        }

    return fn


@pytest.mark.unit
class TestApprovalGate:
    async def test_no_reviewer_single_pass(self):
        nodes = [
            WorkflowNode(id="n1", role_identifier="pm", order=0),
            WorkflowNode(id="n2", role_identifier="reporter", order=1),
        ]
        edges = [WorkflowEdge(id="e1", from_node_id="pm", to_node_id="reporter")]
        config = WorkflowConfig(id="c1", name="t", max_rounds=5, nodes=nodes, edges=edges)
        calls = []

        def pm(state):
            calls.append(int(state.get("round_number", 1)))
            return {"artifacts": {"pm": "draft"}}

        factory = FakeFactory(
            {"pm": pm, "reporter": lambda s: {"artifacts": {"reporter": "final"}}}
        )
        graph = GraphBuilder(factory, Router()).build(config)
        result = await graph.ainvoke(create_initial_state("task"), {"recursion_limit": 50})

        assert calls == [1]
        assert result["round_number"] == 1
        assert result["verdicts"] == {}
        assert result["artifacts"].get("reporter") == "final"

    async def test_approved_first_round_no_retry(self):
        calls = []

        def pm(state):
            calls.append(int(state.get("round_number", 1)))
            return {"artifacts": {"pm": "draft"}}

        reviewer = _reviewer_fn(approve_from=1)
        factory = FakeFactory(
            {"pm": pm, "reviewer": reviewer, "reporter": lambda s: {"artifacts": {"reporter": "final"}}}
        )
        graph = GraphBuilder(factory, Router()).build(_review_config(max_rounds=3))
        result = await graph.ainvoke(create_initial_state("task"), {"recursion_limit": 50})

        assert calls == [1]
        assert result["round_number"] == 1
        assert result["verdicts"]["reviewer"]["approved"] is True
        assert result["artifacts"].get("reporter") == "final"

    async def test_disapproval_triggers_retry_then_converge(self):
        calls = []

        def pm(state):
            r = int(state.get("round_number", 1))
            calls.append(r)
            return {"artifacts": {"pm": f"draft{r}"}}

        reviewer = _reviewer_fn(approve_from=2)
        factory = FakeFactory(
            {"pm": pm, "reviewer": reviewer, "reporter": lambda s: {"artifacts": {"reporter": "final"}}}
        )
        graph = GraphBuilder(factory, Router()).build(_review_config(max_rounds=3))
        result = await graph.ainvoke(create_initial_state("task"), {"recursion_limit": 50})

        assert calls == [1, 2]
        assert result["round_number"] == 2
        assert result["verdicts"]["reviewer"]["approved"] is True
        assert result["verdicts"]["reviewer"]["rounds"] == 2
        assert result["artifacts"]["pm"] == "draft2"
        assert result["artifacts"].get("reporter") == "final"

    async def test_max_rounds_forces_end_with_partial_results(self):
        calls = []

        def pm(state):
            r = int(state.get("round_number", 1))
            calls.append(r)
            return {"artifacts": {"pm": f"draft{r}"}}

        reviewer = _reviewer_fn(always_reject=True)
        factory = FakeFactory(
            {"pm": pm, "reviewer": reviewer, "reporter": lambda s: {"artifacts": {"reporter": "final"}}}
        )
        graph = GraphBuilder(factory, Router()).build(_review_config(max_rounds=2))
        result = await graph.ainvoke(create_initial_state("task"), {"recursion_limit": 50})

        assert calls == [1, 2]
        assert result["round_number"] == 2
        assert result["verdicts"]["reviewer"]["approved"] is False
        assert result["artifacts"]["pm"] == "draft2"
        assert "reporter" not in result["artifacts"]
