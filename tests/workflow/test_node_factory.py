"""Tests for backend/workflow/node_factory.py."""

import os
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

os.environ.setdefault("AUTH_MODE", "legacy")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("KEY_VAULT_SECRET", "0123456789abcdef0123456789abcdef")
os.environ.setdefault("AUTH_ENABLED", "0")
os.environ.setdefault("RATE_LIMIT", "9999")
os.environ.setdefault("CHECKPOINTER_BACKEND", "memory")
os.environ.setdefault("DATABASE_POOL_SIZE", "0")

from langchain_core.messages import AIMessage

from backend.workflow.models import NodeStrategy, WorkflowNode, WorkflowState, create_initial_state
from backend.workflow.node_factory import NodeFactory


@dataclass
class FakeLLM:
    openai_api_key: str = "sk-test"
    openai_api_base: str | None = None
    model_name: str = "deepseek-chat"
    temperature: float = 0.7
    max_tokens: int = 65536


@dataclass
class FakeLLMWithSecret:
    openai_api_key: MagicMock = None
    openai_api_base: str | None = None
    model_name: str = "deepseek-chat"
    temperature: float = 0.7
    max_tokens: int = 65536

    def __post_init__(self):
        if self.openai_api_key is None:
            self.openai_api_key = MagicMock()
            self.openai_api_key.get_secret_value.return_value = "secret-value"


@pytest.mark.unit
class TestNodeFactoryInit:
    def test_init_defaults(self):
        llm = FakeLLM()
        factory = NodeFactory(llm, {})
        assert factory.llm is llm
        assert factory.tools == []
        assert factory.run_id == ""

    def test_init_with_tools(self):
        llm = FakeLLM()
        tools = [MagicMock()]
        factory = NodeFactory(llm, {"pm": "prompt"}, tools=tools)
        assert factory.tools is tools

    def test_init_with_run_id(self):
        llm = FakeLLM()
        factory = NodeFactory(llm, {}, run_id="run-123")
        assert factory.run_id == "run-123"


@pytest.mark.unit
class TestBuildRequest:
    def test_build_request_basic(self):
        llm = FakeLLM()
        factory = NodeFactory(llm, {"pm": "prompt"})
        api_messages = [{"role": "user", "content": "hello"}]
        url, headers, body = factory._build_request(api_messages)
        assert url == "https://api.deepseek.com/chat/completions"
        assert "Authorization" in headers
        assert "Bearer sk-test" in headers["Authorization"]
        assert body["model"] == "deepseek-chat"
        assert body["stream"] is True
        assert body["messages"] == api_messages

    def test_build_request_custom_base_url(self):
        llm = FakeLLM(openai_api_base="https://custom.api.com/v1/")
        factory = NodeFactory(llm, {})
        url, _, _ = factory._build_request([])
        assert url == "https://custom.api.com/v1/chat/completions"

    def test_build_request_default_base_url(self):
        llm = FakeLLM(openai_api_base=None)
        factory = NodeFactory(llm, {})
        url, _, _ = factory._build_request([])
        assert "api.deepseek.com" in url

    def test_build_request_thinking_enabled_for_deepseek(self):
        llm = FakeLLM(model_name="deepseek-chat")
        factory = NodeFactory(llm, {})
        _, _, body = factory._build_request([])
        assert "thinking" in body

    def test_build_request_no_thinking_for_non_deepseek(self):
        llm = FakeLLM(model_name="gpt-4", openai_api_base="https://api.openai.com/v1")
        factory = NodeFactory(llm, {})
        _, _, body = factory._build_request([])
        assert "thinking" not in body

    def test_build_request_secret_value(self):
        llm = FakeLLMWithSecret()
        factory = NodeFactory(llm, {})
        _, headers, _ = factory._build_request([])
        assert "Bearer secret-value" in headers["Authorization"]


@pytest.mark.unit
class TestNodeFactoryCreate:
    def test_create_returns_callable(self):
        llm = FakeLLM()
        factory = NodeFactory(llm, {"pm": "Be a PM"})
        node = WorkflowNode(id="n1", role_identifier="pm", strategy=NodeStrategy.GENERATOR)
        fn = factory.create(node)
        assert callable(fn)

    @pytest.mark.asyncio
    @patch("backend.workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    @patch("backend.workflow.node_factory.convert_messages_to_api")
    async def test_node_fn_calls_llm(self, mock_convert, mock_stream):
        mock_convert.return_value = [{"role": "user", "content": "ctx"}]
        mock_stream.return_value = (["hello world"], None, None, None, None)

        llm = FakeLLM()
        factory = NodeFactory(llm, {"pm": "prompt"}, run_id="run-1")
        node = WorkflowNode(id="n1", role_identifier="pm", strategy=NodeStrategy.GENERATOR)
        fn = factory.create(node)

        state = create_initial_state("requirement")
        result = await fn(state)
        mock_stream.assert_called_once()
        assert "artifacts" in result
        assert result["artifacts"]["pm"] == "hello world"
        assert any(isinstance(m, AIMessage) for m in result["messages"])

    @pytest.mark.asyncio
    @patch("backend.workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    @patch("backend.workflow.node_factory.convert_messages_to_api")
    async def test_node_fn_empty_prompt_context(self, mock_convert, mock_stream):
        mock_convert.return_value = [{"role": "user", "content": ""}]
        mock_stream.return_value = (["output"], None, None, None, None)

        llm = FakeLLM()
        factory = NodeFactory(llm, {"dev": ""})
        node = WorkflowNode(id="n1", role_identifier="dev")
        fn = factory.create(node)

        state = create_initial_state("req")
        result = await fn(state)
        assert result["artifacts"]["dev"] == "output"

    @pytest.mark.asyncio
    @patch("backend.workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    @patch("backend.workflow.node_factory.convert_messages_to_api")
    async def test_node_fn_no_run_id_skips_publish(self, mock_convert, mock_stream):
        mock_convert.return_value = [{"role": "user", "content": "ctx"}]

        async def fake_stream(url, headers, body, cb):
            await cb({"event": "on_llm_stream", "data": {"content": "chunk"}})
            return ["result"], None, None, None, None

        mock_stream.side_effect = fake_stream

        llm = FakeLLM()
        factory = NodeFactory(llm, {"pm": "prompt"}, run_id="")
        node = WorkflowNode(id="n1", role_identifier="pm", strategy=NodeStrategy.GENERATOR)
        fn = factory.create(node)

        state = create_initial_state("req")
        result = await fn(state)
        assert "artifacts" in result


@pytest.mark.unit
class TestNodeFnStreamCallback:
    @pytest.mark.asyncio
    @patch("backend.workflow.node_factory.publish_run_message", new_callable=AsyncMock)
    @patch("backend.workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    @patch("backend.workflow.node_factory.convert_messages_to_api")
    async def test_stream_cb_publishes_content(self, mock_convert, mock_stream, mock_publish):
        mock_convert.return_value = [{"role": "user", "content": "ctx"}]

        async def fake_stream(url, headers, body, cb):
            await cb({"event": "on_llm_stream", "data": {"content": "chunk1"}})
            await cb({"event": "on_custom_thinking", "data": {"content": "thinking..."}})
            return ["result"], None, None, None, None

        mock_stream.side_effect = fake_stream

        llm = FakeLLM()
        factory = NodeFactory(llm, {"pm": "prompt"}, run_id="run-123")
        node = WorkflowNode(id="n1", role_identifier="pm", strategy=NodeStrategy.GENERATOR)
        fn = factory.create(node)

        state = create_initial_state("req")
        await fn(state)
        assert mock_publish.call_count == 2
        first_call = mock_publish.call_args_list[0]
        assert first_call[0][1]["type"] == "stream"
        second_call = mock_publish.call_args_list[1]
        assert second_call[0][1]["type"] == "thinking_stream"

    @pytest.mark.asyncio
    @patch("backend.workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    @patch("backend.workflow.node_factory.convert_messages_to_api")
    async def test_stream_cb_empty_content_skipped(self, mock_convert, mock_stream):
        mock_convert.return_value = [{"role": "user", "content": "ctx"}]

        async def fake_stream(url, headers, body, cb):
            await cb({"event": "on_llm_stream", "data": {"content": ""}})
            await cb({"event": "on_llm_stream", "data": {}})
            return ["out"], None, None, None, None

        mock_stream.side_effect = fake_stream

        llm = FakeLLM()
        factory = NodeFactory(llm, {"pm": "prompt"}, run_id="run-1")
        node = WorkflowNode(id="n1", role_identifier="pm", strategy=NodeStrategy.GENERATOR)
        fn = factory.create(node)

        state = create_initial_state("req")
        result = await fn(state)
        assert "artifacts" in result

    @pytest.mark.asyncio
    @patch("backend.workflow.node_factory.publish_run_message", new_callable=AsyncMock)
    @patch("backend.workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    @patch("backend.workflow.node_factory.convert_messages_to_api")
    async def test_stream_cb_publish_exception_suppressed(self, mock_convert, mock_stream, mock_publish):
        mock_convert.return_value = [{"role": "user", "content": "ctx"}]
        mock_publish.side_effect = RuntimeError("redis down")

        async def fake_stream(url, headers, body, cb):
            await cb({"event": "on_llm_stream", "data": {"content": "data"}})
            return ["out"], None, None, None, None

        mock_stream.side_effect = fake_stream

        llm = FakeLLM()
        factory = NodeFactory(llm, {"pm": "prompt"}, run_id="run-1")
        node = WorkflowNode(id="n1", role_identifier="pm", strategy=NodeStrategy.GENERATOR)
        fn = factory.create(node)

        state = create_initial_state("req")
        result = await fn(state)
        assert "artifacts" in result
