"""Tests for structured output validation + schema retry + JSON verdict parsing."""

import os
from dataclasses import dataclass
from unittest.mock import patch

import pytest

os.environ.setdefault("AUTH_MODE", "legacy")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("KEY_VAULT_SECRET", "0123456789abcdef0123456789abcdef")
os.environ.setdefault("AUTH_ENABLED", "0")
os.environ.setdefault("RATE_LIMIT", "9999")
os.environ.setdefault("CHECKPOINTER_BACKEND", "memory")
os.environ.setdefault("DATABASE_POOL_SIZE", "0")

from workflow.models import NodeStrategy, WorkflowNode, WorkflowState, create_initial_state
from workflow.node_factory import NodeFactory, _validate_json
from workflow.strategies import ReviewerStrategy


@dataclass
class FakeLLM:
    openai_api_key: str = "sk-test"
    openai_api_base: str | None = None
    model_name: str = "deepseek-chat"
    temperature: float = 0.7
    max_tokens: int = 65536


@pytest.mark.unit
class TestValidateJson:
    def test_valid_json_ok(self):
        assert _validate_json('{"approved": true, "reason": "ok"}', ReviewerStrategy.output_schema)

    def test_invalid_json_fails(self):
        assert not _validate_json("not json at all", ReviewerStrategy.output_schema)

    def test_missing_required_field_fails(self):
        assert not _validate_json('{"approved": true}', ReviewerStrategy.output_schema)

    def test_json_fenced_in_code_block_ok(self):
        text = '```json\n{"approved": false, "reason": "nope", "score": 3}\n```'
        assert _validate_json(text, ReviewerStrategy.output_schema)

    def test_json_embedded_in_prose_ok(self):
        text = '评审结果：{"approved": true, "reason": "pass"}，overall good'
        assert _validate_json(text, ReviewerStrategy.output_schema)


@pytest.mark.unit
class TestReviewerJsonVerdict:
    def _state(self) -> WorkflowState:
        state = create_initial_state("task")
        state["artifacts"] = {"pm": "draft"}
        return state

    def test_json_verdict_rejected(self):
        strategy = ReviewerStrategy()
        node = WorkflowNode(id="r1", role_identifier="reviewer", strategy=NodeStrategy.REVIEWER)
        result = strategy.process_output(
            self._state(), node, '{"approved": false, "reason": "needs work", "score": 3}'
        )
        assert result["approved"]["reviewer"] is False
        assert result["verdicts"]["reviewer"]["reason"] == "needs work"
        assert result["verdicts"]["reviewer"]["rounds"] == 1

    def test_json_verdict_approved(self):
        strategy = ReviewerStrategy()
        node = WorkflowNode(id="r1", role_identifier="reviewer", strategy=NodeStrategy.REVIEWER)
        result = strategy.process_output(self._state(), node, '{"approved": true, "reason": "good"}')
        assert result["approved"]["reviewer"] is True
        assert result["verdicts"]["reviewer"]["approved"] is True

    def test_json_overrides_keyword(self):
        strategy = ReviewerStrategy()
        node = WorkflowNode(id="r1", role_identifier="reviewer", strategy=NodeStrategy.REVIEWER)
        result = strategy.process_output(self._state(), node, '{"approved": false} APPROVED')
        assert result["approved"]["reviewer"] is False

    def test_fenced_json_parsed(self):
        strategy = ReviewerStrategy()
        node = WorkflowNode(id="r1", role_identifier="reviewer", strategy=NodeStrategy.REVIEWER)
        output = '```json\n{"approved": true, "reason": "looks good"}\n```'
        result = strategy.process_output(self._state(), node, output)
        assert result["approved"]["reviewer"] is True
        assert result["verdicts"]["reviewer"]["reason"] == "looks good"


@pytest.mark.unit
class TestReviewerSchemaRetry:
    @pytest.mark.asyncio
    @patch("workflow.node_factory.convert_messages_to_api")
    async def test_retries_until_schema_valid(self, mock_convert):
        calls = {"n": 0}

        async def fake_stream(url, headers, body, cb, tool_definitions=None):
            calls["n"] += 1
            if calls["n"] == 1:
                return ["not json"], None, None, None, None
            return ['{"approved": true, "reason": "fixed"}'], None, None, None, None

        mock_convert.return_value = [{"role": "user", "content": "ctx"}]
        with patch("workflow.node_factory.stream_llm_response", side_effect=fake_stream):
            factory = NodeFactory(FakeLLM(), {"reviewer": "prompt"}, run_id="run-1")
            node = WorkflowNode(
                id="r1", role_identifier="reviewer", strategy=NodeStrategy.REVIEWER
            )
            fn = factory.create(node)
            result = await fn(create_initial_state("req"))

        assert calls["n"] == 2
        assert result["approved"]["reviewer"] is True
        assert result["verdicts"]["reviewer"]["approved"] is True

    @pytest.mark.asyncio
    @patch("workflow.node_factory.convert_messages_to_api")
    async def test_valid_first_response_no_retry(self, mock_convert):
        async def fake_stream(url, headers, body, cb, tool_definitions=None):
            return ['{"approved": false, "reason": "bad"}'], None, None, None, None

        mock_convert.return_value = [{"role": "user", "content": "ctx"}]
        with patch("workflow.node_factory.stream_llm_response", side_effect=fake_stream):
            factory = NodeFactory(FakeLLM(), {"reviewer": "prompt"}, run_id="run-1")
            node = WorkflowNode(
                id="r1", role_identifier="reviewer", strategy=NodeStrategy.REVIEWER
            )
            fn = factory.create(node)
            result = await fn(create_initial_state("req"))

        assert result["approved"]["reviewer"] is False
        assert result["verdicts"]["reviewer"]["reason"] == "bad"

    @pytest.mark.asyncio
    @patch("workflow.node_factory.convert_messages_to_api")
    async def test_generator_without_schema_skips_validation(self, mock_convert):
        async def fake_stream(url, headers, body, cb, tool_definitions=None):
            return ["plain free text"], None, None, None, None

        mock_convert.return_value = [{"role": "user", "content": "ctx"}]
        with patch("workflow.node_factory.stream_llm_response", side_effect=fake_stream):
            factory = NodeFactory(FakeLLM(), {"dev": "prompt"}, run_id="run-1")
            node = WorkflowNode(id="d1", role_identifier="dev", strategy=NodeStrategy.GENERATOR)
            fn = factory.create(node)
            result = await fn(create_initial_state("req"))

        assert result["artifacts"]["dev"] == "plain free text"
