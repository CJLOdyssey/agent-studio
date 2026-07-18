"""Tests for virtual_team/workflow/ — strategies, node_factory, router, models."""

from dataclasses import dataclass
from unittest.mock import MagicMock

import pytest


@dataclass
class MockLLM:
    """Test double for LLMConfig Protocol."""

    openai_api_key: str = "sk-test"
    openai_api_base: str | None = None
    model_name: str = "deepseek-chat"
    temperature: float = 0.7
    max_tokens: int = 65536


class TestStrategies:
    def test_generator_strategy_build_prompt_context(self):
        from virtual_team.workflow.models import NodeStrategy, WorkflowNode, WorkflowState
        from virtual_team.workflow.strategies import GeneratorStrategy

        strategy = GeneratorStrategy()
        assert strategy.node_strategy == NodeStrategy.GENERATOR

        state: WorkflowState = {
            "messages": [],
            "requirement": "Build a login page",
            "artifacts": {"frontend": "code here"},
            "round_number": 1,
            "approved": {},
        }
        node = WorkflowNode(id="n1", role_identifier="frontend")
        context = strategy.build_prompt_context(state, node)
        assert "Build a login page" in context
        assert "frontend" in context
        assert "code here" in context

    def test_generator_strategy_empty_artifacts(self):
        from virtual_team.workflow.models import WorkflowNode, WorkflowState
        from virtual_team.workflow.strategies import GeneratorStrategy

        strategy = GeneratorStrategy()
        state: WorkflowState = {
            "messages": [],
            "requirement": "Simple task",
            "artifacts": {},
            "round_number": 1,
            "approved": {},
        }
        node = WorkflowNode(id="n1", role_identifier="dev")
        context = strategy.build_prompt_context(state, node)
        assert "Simple task" in context
        assert "前面节点" not in context

    def test_generator_strategy_process_output(self):
        from virtual_team.workflow.models import WorkflowNode, WorkflowState
        from virtual_team.workflow.strategies import GeneratorStrategy

        strategy = GeneratorStrategy()
        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {},
            "round_number": 1,
            "approved": {},
        }
        node = WorkflowNode(id="n1", role_identifier="backend")
        result = strategy.process_output(state, node, "def main(): pass")
        assert result["artifacts"]["backend"] == "def main(): pass"

    def test_reviewer_strategy_build_prompt_context(self):
        from virtual_team.workflow.models import NodeStrategy, WorkflowNode, WorkflowState
        from virtual_team.workflow.strategies import ReviewerStrategy

        strategy = ReviewerStrategy()
        assert strategy.node_strategy == NodeStrategy.REVIEWER

        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {"backend": "code"},
            "round_number": 1,
            "approved": {},
        }
        node = WorkflowNode(id="r1", role_identifier="reviewer")
        context = strategy.build_prompt_context(state, node)
        assert "请审查" in context
        assert "backend" in context
        assert "code" in context

    def test_reviewer_strategy_process_output_approved(self):
        from virtual_team.workflow.models import WorkflowNode, WorkflowState
        from virtual_team.workflow.strategies import ReviewerStrategy

        strategy = ReviewerStrategy()
        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {},
            "round_number": 1,
            "approved": {},
        }
        node = WorkflowNode(id="r1", role_identifier="reviewer")
        result = strategy.process_output(state, node, "APPROVED - looks good")
        assert result["approved"]["reviewer"] is True

    def test_reviewer_strategy_process_output_rejected(self):
        from virtual_team.workflow.models import WorkflowNode, WorkflowState
        from virtual_team.workflow.strategies import ReviewerStrategy

        strategy = ReviewerStrategy()
        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {},
            "round_number": 1,
            "approved": {},
        }
        node = WorkflowNode(id="r1", role_identifier="reviewer")
        result = strategy.process_output(state, node, "NEEDS FIX - has bugs")
        assert result["approved"]["reviewer"] is False

    def test_reviewer_approval_keywords(self):
        from virtual_team.workflow.models import WorkflowNode, WorkflowState
        from virtual_team.workflow.strategies import ReviewerStrategy

        strategy = ReviewerStrategy()
        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {},
            "round_number": 1,
            "approved": {},
        }
        node = WorkflowNode(id="r1", role_identifier="r")

        for kw in ["APPROVED", "PASS", "✅", "通过"]:
            state["approved"] = {}
            result = strategy.process_output(state, node, f"This is {kw}")
            assert result["approved"]["r"] is True, f"Keyword '{kw}' should trigger approval"

    def test_reporter_strategy_build_prompt_context(self):
        from virtual_team.workflow.models import NodeStrategy, WorkflowNode, WorkflowState
        from virtual_team.workflow.strategies import ReporterStrategy

        strategy = ReporterStrategy()
        assert strategy.node_strategy == NodeStrategy.REPORTER

        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {"fe": "<html>", "be": "api.py"},
            "round_number": 1,
            "approved": {},
        }
        node = WorkflowNode(id="p1", role_identifier="reporter")
        context = strategy.build_prompt_context(state, node)
        assert "汇总" in context
        assert "fe" in context
        assert "be" in context

    def test_reporter_strategy_process_output(self):
        from virtual_team.workflow.models import WorkflowNode, WorkflowState
        from virtual_team.workflow.strategies import ReporterStrategy

        strategy = ReporterStrategy()
        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {},
            "round_number": 1,
            "approved": {},
        }
        node = WorkflowNode(id="p1", role_identifier="reporter")
        result = strategy.process_output(state, node, "Final report content")
        assert result["artifacts"]["_final_report"] == "Final report content"
        assert result["artifacts"]["reporter"] == "Final report content"

    def test_get_strategy(self):
        from virtual_team.workflow.models import NodeStrategy, WorkflowNode
        from virtual_team.workflow.strategies import (
            GeneratorStrategy,
            ReporterStrategy,
            ReviewerStrategy,
            get_strategy,
        )

        gen_node = WorkflowNode(strategy=NodeStrategy.GENERATOR)
        rev_node = WorkflowNode(strategy=NodeStrategy.REVIEWER)
        rep_node = WorkflowNode(strategy=NodeStrategy.REPORTER)

        assert isinstance(get_strategy(gen_node), GeneratorStrategy)
        assert isinstance(get_strategy(rev_node), ReviewerStrategy)
        assert isinstance(get_strategy(rep_node), ReporterStrategy)

    def test_get_strategy_defaults_to_generator(self):
        from virtual_team.workflow.models import WorkflowNode
        from virtual_team.workflow.strategies import GeneratorStrategy, get_strategy

        node = WorkflowNode()  # no strategy set
        assert isinstance(get_strategy(node), GeneratorStrategy)


class TestWorkflowModels:
    def test_node_strategy_enum(self):
        from virtual_team.workflow.models import NodeStrategy

        assert NodeStrategy.GENERATOR == "generator"
        assert NodeStrategy.REVIEWER == "reviewer"
        assert NodeStrategy.REPORTER == "reporter"

    def test_workflow_node_defaults(self):
        from virtual_team.workflow.models import NodeStrategy, WorkflowNode

        node = WorkflowNode()
        assert node.id == ""
        assert node.agent_config_id == ""
        assert node.role_identifier == ""
        assert node.strategy == NodeStrategy.GENERATOR
        assert node.order == 0

    def test_workflow_edge_defaults(self):
        from virtual_team.workflow.models import WorkflowEdge

        edge = WorkflowEdge()
        assert edge.id == ""
        assert edge.from_node_id == ""
        assert edge.to_node_id == ""
        assert edge.condition_key is None
        assert edge.is_default is False
        assert edge.priority == 0

    def test_workflow_config_get_node_by_role(self):
        from virtual_team.workflow.models import WorkflowConfig, WorkflowNode

        cfg = WorkflowConfig(
            id="cfg1",
            nodes=[
                WorkflowNode(id="n1", role_identifier="frontend"),
                WorkflowNode(id="n2", role_identifier="backend"),
            ],
        )
        assert cfg.get_node_by_role("frontend") is not None
        assert cfg.get_node_by_role("frontend").id == "n1"  # type: ignore
        assert cfg.get_node_by_role("nonexistent") is None

    def test_workflow_config_get_outgoing_edges(self):
        from virtual_team.workflow.models import WorkflowConfig, WorkflowEdge

        cfg = WorkflowConfig(
            id="cfg2",
            edges=[
                WorkflowEdge(id="e1", from_node_id="n1", to_node_id="n2"),
                WorkflowEdge(id="e2", from_node_id="n1", to_node_id="n3"),
                WorkflowEdge(id="e3", from_node_id="n2", to_node_id="n3"),
            ],
        )
        outgoing = cfg.get_outgoing_edges("n1")
        assert len(outgoing) == 2
        assert all(e.from_node_id == "n1" for e in outgoing)

    def test_workflow_config_get_entry_node(self):
        from virtual_team.workflow.models import WorkflowConfig, WorkflowNode

        cfg = WorkflowConfig(
            id="cfg3",
            nodes=[
                WorkflowNode(id="n2", order=2),
                WorkflowNode(id="n1", order=1),
                WorkflowNode(id="n3", order=3),
            ],
        )
        entry = cfg.get_entry_node()
        assert entry is not None
        assert entry.id == "n1"

    def test_workflow_config_get_entry_node_empty(self):
        from virtual_team.workflow.models import WorkflowConfig

        cfg = WorkflowConfig(id="cfg4")
        assert cfg.get_entry_node() is None

    def test_create_initial_state(self):
        from virtual_team.workflow.models import create_initial_state

        state = create_initial_state("Build feature X")
        assert state["requirement"] == "Build feature X"
        assert state["artifacts"] == {}
        assert state["round_number"] == 1
        assert state["approved"] == {}
        assert "messages" in state

    def test_create_initial_state_default(self):
        from virtual_team.workflow.models import create_initial_state

        state = create_initial_state()
        assert state["requirement"] == ""


class TestRouter:
    def test_router_no_matching_edges(self):
        from virtual_team.workflow.models import WorkflowState
        from virtual_team.workflow.router import Router

        router = Router()
        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {},
            "round_number": 1,
            "approved": {},
        }
        from langgraph.graph import END

        result = router.resolve([], state, "n1")
        assert result == END

    def test_router_default_edge(self):
        from virtual_team.workflow.models import WorkflowEdge, WorkflowState
        from virtual_team.workflow.router import Router

        router = Router()
        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {},
            "round_number": 1,
            "approved": {},
        }
        edges = [
            WorkflowEdge(id="e1", from_node_id="n1", to_node_id="n2", is_default=True),
            WorkflowEdge(id="e2", from_node_id="n1", to_node_id="n3", condition_key="bug", is_default=False),
        ]
        result = router.resolve(edges, state, "n1")
        assert result == "n2"

    def test_router_condition_match(self):
        from virtual_team.workflow.models import WorkflowEdge, WorkflowState
        from virtual_team.workflow.router import Router

        router = Router()
        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {"reviewer": "found a bug"},
            "round_number": 1,
            "approved": {},
        }
        edges = [
            WorkflowEdge(id="e1", from_node_id="n1", to_node_id="fix", condition_key="bug"),
            WorkflowEdge(id="e2", from_node_id="n1", to_node_id="done", is_default=True),
        ]
        result = router.resolve(edges, state, "n1")
        assert result == "fix"

    def test_router_priority_sorting(self):
        from virtual_team.workflow.models import WorkflowEdge, WorkflowState
        from virtual_team.workflow.router import Router

        router = Router()
        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {"output": "fix bug now"},
            "round_number": 1,
            "approved": {},
        }
        edges = [
            WorkflowEdge(id="low", from_node_id="n1", to_node_id="low_prio", condition_key="bug", priority=0),
            WorkflowEdge(id="high", from_node_id="n1", to_node_id="high_prio", condition_key="bug", priority=10),
        ]
        result = router.resolve(edges, state, "n1")
        assert result == "high_prio"

    def test_router_matches_with_multiple_keywords(self):
        from virtual_team.workflow.models import WorkflowEdge, WorkflowState
        from virtual_team.workflow.router import Router

        router = Router()
        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {"output": "test output with error and bug"},
            "round_number": 1,
            "approved": {},
        }
        edges = [
            WorkflowEdge(id="e1", from_node_id="n1", to_node_id="fix", condition_key="error|bug"),
        ]
        result = router.resolve(edges, state, "n1")
        assert result == "fix"


