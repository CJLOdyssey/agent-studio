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



class TestNodeFactory:
    def test_node_factory_init(self):
        from virtual_team.workflow.node_factory import NodeFactory

        factory = NodeFactory(
            llm=MockLLM(),
            agent_prompts={"dev": "You are a developer"},
            tools=[],
            run_id="run-test",
        )
        assert factory.agent_prompts == {"dev": "You are a developer"}
        assert factory.run_id == "run-test"
        assert factory.tools == []

    def test_build_request_includes_messages(self):
        from virtual_team.workflow.node_factory import NodeFactory

        factory = NodeFactory(llm=MockLLM(), agent_prompts={}, run_id="r1")
        url, headers, body = factory._build_request([{"role": "user", "content": "hi"}])
        assert "chat/completions" in url
        assert "Authorization" in headers
        assert body["messages"] == [{"role": "user", "content": "hi"}]
        assert body["stream"] is True

    def test_build_request_deepseek_thinking(self):

        from virtual_team.workflow.node_factory import NodeFactory

        mock_llm = MockLLM(openai_api_base="https://api.deepseek.com")

        factory = NodeFactory(llm=mock_llm, agent_prompts={}, run_id="r2")
        url, headers, body = factory._build_request([{"role": "user", "content": "hi"}])
        assert body["thinking"] == {"type": "enabled"}

    def test_create_returns_callable(self):
        from virtual_team.workflow.models import WorkflowNode
        from virtual_team.workflow.node_factory import NodeFactory

        factory = NodeFactory(llm=MockLLM(), agent_prompts={}, run_id="r3")
        node = WorkflowNode(id="n1", role_identifier="dev")
        fn = factory.create(node)
        assert callable(fn)

    def test_create_reviewer_node(self):
        from virtual_team.workflow.models import NodeStrategy, WorkflowNode
        from virtual_team.workflow.node_factory import NodeFactory

        factory = NodeFactory(llm=MockLLM(), agent_prompts={"reviewer": "Review code"}, run_id="r4")
        node = WorkflowNode(id="rev1", role_identifier="reviewer", strategy=NodeStrategy.REVIEWER)
        fn = factory.create(node)
        assert callable(fn)

    def test_create_reporter_node(self):
        from virtual_team.workflow.models import NodeStrategy, WorkflowNode
        from virtual_team.workflow.node_factory import NodeFactory

        factory = NodeFactory(llm=MockLLM(), agent_prompts={"reporter": "Report results"}, run_id="r5")
        node = WorkflowNode(id="rep1", role_identifier="reporter", strategy=NodeStrategy.REPORTER)
        fn = factory.create(node)
        assert callable(fn)

    def test_build_request_no_api_key_secret(self):
        from virtual_team.workflow.node_factory import NodeFactory

        mock_llm = MockLLM(openai_api_key="sk-raw-key", model_name="gpt-4")

        factory = NodeFactory(llm=mock_llm, agent_prompts={}, run_id="r6")
        url, headers, body = factory._build_request([{"role": "user", "content": "hi"}])
        assert "api.deepseek.com" in url
        assert "sk-raw-key" in headers["Authorization"]

    def test_build_request_non_deepseek_no_thinking(self):

        from virtual_team.workflow.node_factory import NodeFactory

        mock_llm = MockLLM(openai_api_base="https://api.openai.com", model_name="gpt-4")

        factory = NodeFactory(llm=mock_llm, agent_prompts={}, run_id="r7")
        url, headers, body = factory._build_request([{"role": "user", "content": "hi"}])
        assert "thinking" not in body

    def test_build_request_with_secret_value(self):

        from virtual_team.workflow.node_factory import NodeFactory

        secret = MagicMock()
        secret.get_secret_value.return_value = "sk-secret-resolved"
        mock_llm = MagicMock()
        mock_llm.openai_api_key = secret
        mock_llm.openai_api_base = "https://api.deepseek.com"
        mock_llm.model_name = "deepseek-chat"

        factory = NodeFactory(llm=mock_llm, agent_prompts={}, run_id="r8")
        url, headers, body = factory._build_request([{"role": "user", "content": "hi"}])
        assert "sk-secret-resolved" in headers["Authorization"]

    def test_build_request_includes_temperature_and_max_tokens(self):

        from virtual_team.workflow.node_factory import NodeFactory

        mock_llm = MockLLM(temperature=0.5, max_tokens=8192)

        factory = NodeFactory(llm=mock_llm, agent_prompts={}, run_id="r9")
        url, headers, body = factory._build_request([{"role": "user", "content": "hi"}])
        assert body["temperature"] == 0.5
        assert body["max_tokens"] == 8192


class TestModelEdgeCases:
    def test_get_previous_artifacts(self):
        from virtual_team.workflow.models import (
            WorkflowConfig,
            WorkflowEdge,
            WorkflowNode,
            WorkflowState,
            get_previous_artifacts,
        )

        config = WorkflowConfig(
            id="cfg5",
            nodes=[
                WorkflowNode(id="n1", role_identifier="frontend"),
                WorkflowNode(id="n2", role_identifier="backend"),
            ],
            edges=[
                WorkflowEdge(id="e1", from_node_id="frontend", to_node_id="n2"),
            ],
        )
        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {"frontend": "<h1>Hello</h1>"},
            "round_number": 1,
            "approved": {},
        }
        current = WorkflowNode(id="n2", role_identifier="backend")
        artifacts = get_previous_artifacts(state, current, config)
        assert artifacts == {"frontend": "<h1>Hello</h1>"}

    def test_get_previous_artifacts_no_incoming(self):
        from virtual_team.workflow.models import WorkflowConfig, WorkflowNode, WorkflowState, get_previous_artifacts

        config = WorkflowConfig(id="cfg6", nodes=[WorkflowNode(id="n1")])
        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {"fe": "code"},
            "round_number": 1,
            "approved": {},
        }
        artifacts = get_previous_artifacts(state, WorkflowNode(id="n1"), config)
        assert artifacts == {}

    def test_merge_dicts(self):
        from virtual_team.workflow.models import _merge_dicts

        result = _merge_dicts({"a": 1, "b": 2}, {"b": 3, "c": 4})
        assert result == {"a": 1, "b": 3, "c": 4}

    def test_merge_dicts_empty_left(self):
        from virtual_team.workflow.models import _merge_dicts

        result = _merge_dicts({}, {"a": 1})
        assert result == {"a": 1}

    def test_merge_dicts_empty_right(self):
        from virtual_team.workflow.models import _merge_dicts

        result = _merge_dicts({"a": 1}, {})
        assert result == {"a": 1}

    def test_workflow_config_max_rounds_default(self):
        from virtual_team.workflow.models import WorkflowConfig

        cfg = WorkflowConfig()
        assert cfg.max_rounds == 5

    def test_workflow_config_max_rounds_custom(self):
        from virtual_team.workflow.models import WorkflowConfig

        cfg = WorkflowConfig(id="cfg7", max_rounds=3)
        assert cfg.max_rounds == 3

    def test_router_matches_none_condition(self):
        from virtual_team.workflow.models import WorkflowEdge, WorkflowState
        from virtual_team.workflow.router import Router

        router = Router()
        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {"output": "some text"},
            "round_number": 1,
            "approved": {},
        }
        edge = WorkflowEdge(condition_key=None)
        assert router._matches(state, edge) is False

    def test_router_matches_empty_condition(self):
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
        edge = WorkflowEdge(condition_key="bug|error")
        result = router._matches(state, edge)
        assert result is False

    def test_router_matches_empty_condition_with_artifacts(self):
        from virtual_team.workflow.models import WorkflowEdge, WorkflowState
        from virtual_team.workflow.router import Router

        router = Router()
        state: WorkflowState = {
            "messages": [],
            "requirement": "",
            "artifacts": {"output": "found a bug here"},
            "round_number": 1,
            "approved": {},
        }
        edge = WorkflowEdge(condition_key="bug")
        assert router._matches(state, edge) is True

    @pytest.mark.asyncio
    async def test_node_fn_called_with_mocked_stream(self):
        from unittest.mock import AsyncMock, patch

        from virtual_team.workflow.models import WorkflowNode, WorkflowState
        from virtual_team.workflow.node_factory import NodeFactory

        factory = NodeFactory(llm=MockLLM(), agent_prompts={"dev": "You are a developer"}, run_id="r-nodefn")
        node = WorkflowNode(id="n1", role_identifier="dev")
        fn = factory.create(node)

        state: WorkflowState = {
            "messages": [],
            "requirement": "build something",
            "artifacts": {},
            "round_number": 1,
            "approved": {},
        }

        with patch("virtual_team.workflow.node_factory.stream_llm_response") as mock_stream:
            with patch("virtual_team.workflow.node_factory.convert_messages_to_api") as mock_convert:
                with patch("virtual_team.workflow.node_factory.publish_run_message", new_callable=AsyncMock):
                    mock_convert.return_value = [{"role": "user", "content": "test"}]
                    mock_stream.return_value = (["generated code"], [], [], [], [])

                    result = await fn(state)  # type: ignore
                    assert "artifacts" in result
                    assert result["artifacts"]["dev"] == "generated code"
