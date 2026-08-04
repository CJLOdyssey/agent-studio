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

from services.tool_config import ToolConfig
from workflow.models import NodeStrategy, WorkflowNode, WorkflowState, create_initial_state
from workflow.node_factory import NodeFactory


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
    @patch("workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    @patch("workflow.node_factory.convert_messages_to_api")
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
    @patch("workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    @patch("workflow.node_factory.convert_messages_to_api")
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
    @patch("workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    @patch("workflow.node_factory.convert_messages_to_api")
    async def test_node_fn_no_run_id_skips_publish(self, mock_convert, mock_stream):
        mock_convert.return_value = [{"role": "user", "content": "ctx"}]

        async def fake_stream(url, headers, body, cb, tool_definitions=None):
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
class TestBuildRequestTools:
    def test_build_request_with_tools_disables_thinking(self):
        llm = FakeLLM(model_name="deepseek-chat")
        factory = NodeFactory(llm, {})
        defs = [{"type": "function", "function": {"name": "web_search"}}]
        _, _, body = factory._build_request([], defs)
        assert body["tools"] == defs
        assert body["tool_choice"] == "auto"
        assert "thinking" not in body

    def test_build_request_no_tools_keeps_thinking(self):
        llm = FakeLLM(model_name="deepseek-chat")
        factory = NodeFactory(llm, {})
        _, _, body = factory._build_request([])
        assert "tools" not in body
        assert body["thinking"] == {"type": "enabled"}


@pytest.mark.unit
class TestNodeToolConfigs:
    def test_empty_by_default(self):
        llm = FakeLLM()
        factory = NodeFactory(llm, {})
        defs, tool_map = factory._node_tool_configs(WorkflowNode(id="n1", role_identifier="pm"))
        assert defs == []
        assert tool_map == {}

    def test_node_tools_registered(self):
        llm = FakeLLM()
        factory = NodeFactory(
            llm, {},
            node_tools={"pm": [ToolConfig(name="web_search", description="Search the web")]},
        )
        defs, tool_map = factory._node_tool_configs(WorkflowNode(id="n1", role_identifier="pm"))
        assert "web_search" in tool_map
        assert len(defs) == 1
        assert defs[0]["function"]["name"] == "web_search"

    def test_falls_back_to_tools_when_role_unmapped(self):
        llm = FakeLLM()
        factory = NodeFactory(llm, {}, tools=[ToolConfig(name="fallback_tool")])
        defs, tool_map = factory._node_tool_configs(WorkflowNode(id="n1", role_identifier="pm"))
        assert "fallback_tool" in tool_map
        assert len(defs) == 1

    def test_node_tools_take_precedence_over_fallback(self):
        llm = FakeLLM()
        factory = NodeFactory(
            llm, {},
            tools=[ToolConfig(name="fallback_tool")],
            node_tools={"pm": [ToolConfig(name="role_tool")]},
        )
        defs, tool_map = factory._node_tool_configs(WorkflowNode(id="n1", role_identifier="pm"))
        assert "role_tool" in tool_map
        assert "fallback_tool" not in tool_map

    def test_empty_node_tools_does_not_fall_back(self):
        llm = FakeLLM()
        factory = NodeFactory(
            llm, {},
            tools=[ToolConfig(name="fallback_tool")],
            node_tools={"pm": []},
        )
        defs, tool_map = factory._node_tool_configs(WorkflowNode(id="n1", role_identifier="pm"))
        assert defs == []
        assert tool_map == {}


@pytest.mark.unit
class TestNodeFnToolExecution:
    def _factory(self, **kwargs):
        llm = FakeLLM()
        defaults = {"llm": llm, "agent_prompts": {"pm": "Be a PM"}}
        defaults.update(kwargs)
        return NodeFactory(**defaults)

    @pytest.mark.asyncio
    @patch("workflow.node_factory.build_tool_definition")
    @patch("workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    async def test_node_fn_executes_tool_calls(self, mock_stream, mock_build_def):
        wrapper = AsyncMock()
        wrapper.invoke.return_value = "weather result: sunny"
        wrapper.set_run_id = MagicMock()
        wrapper.name = "web_search"
        definition = {"type": "function", "function": {"name": "web_search", "description": "Search"}}
        mock_build_def.return_value = ("web_search", wrapper, definition)

        # First LLM turn requests a tool call; second turn answers after tools ran.
        mock_stream.side_effect = [
            ([""], [], {0: {"id": "call_1", "name": "web_search", "arguments": '{"query": "weather"}'}}, "tool_calls", {}),
            (["It is sunny."], [], {}, "stop", {}),
        ]

        factory = self._factory(
            node_tools={"pm": [ToolConfig(name="web_search", description="Search the web")]}
        )
        node = WorkflowNode(id="n1", role_identifier="pm", strategy=NodeStrategy.GENERATOR)
        fn = factory.create(node)

        state = create_initial_state("requirement")
        result = await fn(state)

        wrapper.invoke.assert_awaited_once_with({"query": "weather"})
        assert mock_stream.await_count == 2
        assert result["artifacts"]["pm"] == "It is sunny."
        assert any(isinstance(m, AIMessage) for m in result["messages"])

    @pytest.mark.asyncio
    @patch("workflow.node_factory.publish_run_message", new_callable=AsyncMock)
    @patch("workflow.node_factory.build_tool_definition")
    @patch("workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    async def test_node_fn_publishes_tool_events(self, mock_stream, mock_build_def, mock_publish):
        wrapper = AsyncMock()
        wrapper.invoke.return_value = "the result payload"
        wrapper.set_run_id = MagicMock()
        wrapper.name = "mcp_search"
        mock_build_def.return_value = (
            "mcp_search", wrapper,
            {"type": "function", "function": {"name": "mcp_search", "description": ""}},
        )
        mock_stream.side_effect = [
            ([""], [], {0: {"id": "c1", "name": "mcp_search", "arguments": "{}"}}, "tool_calls", {}),
            (["done"], [], {}, "stop", {}),
        ]

        factory = self._factory(
            node_tools={"pm": [ToolConfig(name="mcp_search", mcp_type="stdio", mcp_endpoint="npx")]},
            run_id="run-1",
        )
        node = WorkflowNode(id="n1", role_identifier="pm", strategy=NodeStrategy.GENERATOR)
        fn = factory.create(node)

        await fn(create_initial_state("req"))

        thinking_msgs = [
            c[0][1]["content"]
            for c in mock_publish.call_args_list
            if c[0][1]["type"] == "thinking_stream"
        ]
        assert any("[mcp] mcp_search" in m for m in thinking_msgs)
        assert any("[result] mcp_search" in m for m in thinking_msgs)

    @pytest.mark.asyncio
    @patch("workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    async def test_node_fn_tool_call_limit_capped(self, mock_stream):
        wrapper = AsyncMock()
        wrapper.invoke.return_value = "tool out"
        wrapper.set_run_id = MagicMock()
        wrapper.name = "loop_tool"
        with patch(
            "workflow.node_factory.build_tool_definition",
            return_value=("loop_tool", wrapper, {"type": "function", "function": {"name": "loop_tool"}}),
        ):
            factory = self._factory(
                node_tools={"pm": [ToolConfig(name="loop_tool", instructions="loop")]}
            )
            node = WorkflowNode(id="n1", role_identifier="pm", strategy=NodeStrategy.GENERATOR)
            fn = factory.create(node)

            def tool_call_turn(*_args, **_kwargs):
                return ([""], [], {0: {"id": "c", "name": "loop_tool", "arguments": "{}"}}, "tool_calls", {})

            mock_stream.side_effect = tool_call_turn

            result = await fn(create_initial_state("req"))
            # 1 initial + capped extra rounds; loop must terminate.
            assert mock_stream.await_count <= 9
            assert "artifacts" in result

    @pytest.mark.asyncio
    @patch("workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    async def test_node_fn_no_tools_single_call(self, mock_stream):
        mock_stream.return_value = (["hello world"], None, None, None, None)
        factory = self._factory()
        node = WorkflowNode(id="n1", role_identifier="pm", strategy=NodeStrategy.GENERATOR)
        fn = factory.create(node)

        result = await fn(create_initial_state("req"))
        mock_stream.assert_called_once()
        assert result["artifacts"]["pm"] == "hello world"
    @pytest.mark.asyncio
    @patch("workflow.node_factory.publish_run_message", new_callable=AsyncMock)
    @patch("workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    @patch("workflow.node_factory.convert_messages_to_api")
    async def test_stream_cb_publishes_content(self, mock_convert, mock_stream, mock_publish):
        mock_convert.return_value = [{"role": "user", "content": "ctx"}]

        async def fake_stream(url, headers, body, cb, tool_definitions=None):
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
    @patch("workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    @patch("workflow.node_factory.convert_messages_to_api")
    async def test_stream_cb_empty_content_skipped(self, mock_convert, mock_stream):
        mock_convert.return_value = [{"role": "user", "content": "ctx"}]

        async def fake_stream(url, headers, body, cb, tool_definitions=None):
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
    @patch("workflow.node_factory.publish_run_message", new_callable=AsyncMock)
    @patch("workflow.node_factory.stream_llm_response", new_callable=AsyncMock)
    @patch("workflow.node_factory.convert_messages_to_api")
    async def test_stream_cb_publish_exception_suppressed(self, mock_convert, mock_stream, mock_publish):
        mock_convert.return_value = [{"role": "user", "content": "ctx"}]
        mock_publish.side_effect = RuntimeError("redis down")

        async def fake_stream(url, headers, body, cb, tool_definitions=None):
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
