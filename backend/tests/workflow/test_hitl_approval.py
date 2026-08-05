"""Tests for HITL human-verdict override on the reviewer approval gate.

The gate reads ``team:{run_id}:human_verdict`` from Redis (written by the
``POST /api/team-runs/{run_id}/approve`` endpoint). When present the human
verdict overrides the reviewer's keyword verdict; when absent the automatic
verdict stands (non-blocking "optional human" mode).
"""

import json
import os
from unittest.mock import AsyncMock, patch

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


def _review_config(max_rounds=3):
    nodes = [
        WorkflowNode(id="n1", role_identifier="pm", strategy=NodeStrategy.GENERATOR, order=0),
        WorkflowNode(id="n2", role_identifier="reviewer", strategy=NodeStrategy.REVIEWER, order=1),
        WorkflowNode(id="n3", role_identifier="reporter", strategy=NodeStrategy.REPORTER, order=2),
    ]
    edges = [
        WorkflowEdge(id="e1", from_node_id="pm", to_node_id="reviewer"),
        WorkflowEdge(id="e2", from_node_id="reviewer", to_node_id="reporter"),
    ]
    return WorkflowConfig(id="c1", name="t", max_rounds=max_rounds, nodes=nodes, edges=edges)


def _reviewer_fn(approved):
    def fn(state):
        r = int(state.get("round_number", 1))
        return {
            "artifacts": {"reviewer": f"verdict r{r}"},
            "approved": {"reviewer": approved},
            "verdicts": {"reviewer": {"approved": approved, "reason": "x", "rounds": r}},
        }

    return fn


def _verdict_key(run_id):
    return f"team:{run_id}:human_verdict"


@pytest.fixture
def redis_store():
    store: dict[str, str] = {}
    mock = AsyncMock()
    mock.publish.return_value = 1
    mock.get.side_effect = lambda k: store.get(k)
    return store, mock


@pytest.mark.unit
class TestHumanVerdictGate:
    async def test_human_approval_overrides_keyword_rejection(self, redis_store):
        store, mock = redis_store
        store[_verdict_key("r1")] = json.dumps({"approved": True, "note": "ok"})
        reviewer = _reviewer_fn(approved=False)
        factory = FakeFactory(
            {"pm": lambda s: {"artifacts": {"pm": "draft"}}, "reviewer": reviewer,
             "reporter": lambda s: {"artifacts": {"reporter": "final"}}}
        )
        with patch("broker.get_redis", return_value=mock):
            graph = GraphBuilder(factory, Router(), run_id="r1").build(_review_config())
            result = await graph.ainvoke(create_initial_state("task"), {"recursion_limit": 50})

        assert result["verdicts"]["reviewer"]["approved"] is False
        assert result["artifacts"].get("reporter") == "final"

    async def test_human_rejection_overrides_keyword_approval(self, redis_store):
        store, mock = redis_store
        store[_verdict_key("r2")] = json.dumps({"approved": False})
        calls = []

        def pm(state):
            calls.append(int(state.get("round_number", 1)))
            return {"artifacts": {"pm": f"draft{state['round_number']}"}}

        reviewer = _reviewer_fn(approved=True)
        factory = FakeFactory(
            {"pm": pm, "reviewer": reviewer, "reporter": lambda s: {"artifacts": {"reporter": "final"}}}
        )
        with patch("broker.get_redis", return_value=mock):
            graph = GraphBuilder(factory, Router(), run_id="r2").build(_review_config(max_rounds=2))
            result = await graph.ainvoke(create_initial_state("task"), {"recursion_limit": 50})

        assert calls == [1, 2]
        assert result["verdicts"]["reviewer"]["approved"] is True
        assert "reporter" not in result["artifacts"]

    async def test_no_key_falls_back_to_auto_verdict(self, redis_store):
        _, mock = redis_store
        reviewer = _reviewer_fn(approved=True)
        factory = FakeFactory(
            {"pm": lambda s: {"artifacts": {"pm": "draft"}}, "reviewer": reviewer,
             "reporter": lambda s: {"artifacts": {"reporter": "final"}}}
        )
        with patch("broker.get_redis", return_value=mock):
            graph = GraphBuilder(factory, Router(), run_id="r3").build(_review_config())
            result = await graph.ainvoke(create_initial_state("task"), {"recursion_limit": 50})

        assert result["verdicts"]["reviewer"]["approved"] is True
        assert result["artifacts"].get("reporter") == "final"

        published = [c.args for c in mock.publish.call_args_list]
        assert published, "expected an approval_request event on the run channel"
        assert published[0][0] == "run:r3"
        assert json.loads(published[0][1])["type"] == "approval_request"
        assert json.loads(published[0][1])["node"] == "reviewer"

    async def test_no_run_id_skips_redis(self, redis_store):
        _, mock = redis_store
        reviewer = _reviewer_fn(approved=True)
        factory = FakeFactory(
            {"pm": lambda s: {"artifacts": {"pm": "draft"}}, "reviewer": reviewer,
             "reporter": lambda s: {"artifacts": {"reporter": "final"}}}
        )
        with patch("broker.get_redis", return_value=mock):
            graph = GraphBuilder(factory, Router()).build(_review_config())
            result = await graph.ainvoke(create_initial_state("task"), {"recursion_limit": 50})

        assert result["verdicts"]["reviewer"]["approved"] is True
        assert mock.publish.call_count == 0
        assert mock.get.call_count == 0
