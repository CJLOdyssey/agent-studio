"""Tests for HITL human-verdict override on the reviewer approval gate.

The gate reads ``team:{run_id}:human_verdict`` from Redis (written by the
``POST /api/team-runs/{run_id}/approve`` endpoint). When present the human
verdict overrides the reviewer's keyword verdict; when absent the automatic
verdict stands after ``HITL_WAIT_TIMEOUT`` (blocking on rejection).
"""

import asyncio
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

    async def test_reject_blocks_then_timeout_falls_back(self, redis_store, monkeypatch):
        """强阻塞：驳回且无人裁决 → 超时后按自动判定 retry，直到 max_rounds。"""
        monkeypatch.setenv("HITL_WAIT_TIMEOUT", "0")
        store, mock = redis_store
        calls = []

        def pm(state):
            calls.append(int(state.get("round_number", 1)))
            return {"artifacts": {"pm": f"draft{state['round_number']}"}}

        reviewer = _reviewer_fn(approved=False)
        factory = FakeFactory(
            {"pm": pm, "reviewer": reviewer, "reporter": lambda s: {}}
        )
        with patch("broker.get_redis", return_value=mock):
            graph = GraphBuilder(factory, Router(), run_id="r4").build(_review_config(max_rounds=2))
            result = await graph.ainvoke(create_initial_state("task"), {"recursion_limit": 50})

        assert calls == [1, 2]
        assert "reporter" not in result["artifacts"]

    async def test_reject_waits_for_late_human_verdict(self, redis_store, monkeypatch):
        """强阻塞：驳回后等待窗口内出现人工 approve → 放行 continue。"""
        monkeypatch.setenv("HITL_WAIT_TIMEOUT", "5")
        store, mock = redis_store

        async def _late_write():
            await asyncio.sleep(0.2)
            store[_verdict_key("r5")] = json.dumps({"approved": True, "note": "ok"})

        asyncio.create_task(_late_write())
        reviewer = _reviewer_fn(approved=False)
        factory = FakeFactory(
            {"pm": lambda s: {"artifacts": {"pm": "draft"}}, "reviewer": reviewer,
             "reporter": lambda s: {"artifacts": {"reporter": "final"}}}
        )
        with patch("broker.get_redis", return_value=mock):
            graph = GraphBuilder(factory, Router(), run_id="r5").build(_review_config())
            result = await graph.ainvoke(create_initial_state("task"), {"recursion_limit": 50})

        assert result["artifacts"].get("reporter") == "final"

    async def test_reject_consumes_verdict_once(self, redis_store, monkeypatch):
        """强阻塞：人工裁决一次性消费（delete），后续轮次重新请求。"""
        monkeypatch.setenv("HITL_WAIT_TIMEOUT", "0")
        store, mock = redis_store
        store[_verdict_key("r6")] = json.dumps({"approved": True, "note": "ok"})
        reviewer = _reviewer_fn(approved=False)
        factory = FakeFactory(
            {"pm": lambda s: {"artifacts": {"pm": "draft"}}, "reviewer": reviewer,
             "reporter": lambda s: {"artifacts": {"reporter": "final"}}}
        )
        with patch("broker.get_redis", return_value=mock):
            graph = GraphBuilder(factory, Router(), run_id="r6").build(_review_config())
            result = await graph.ainvoke(create_initial_state("task"), {"recursion_limit": 50})

        assert result["artifacts"].get("reporter") == "final"
        assert (_verdict_key("r6"),) in [c.args for c in mock.delete.call_args_list]
