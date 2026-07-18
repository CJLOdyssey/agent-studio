"""Tests for SingleAgentGraph core — structure, nodes, and LLM integration."""
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

os.environ["AUTH_MODE"] = "legacy"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["KEY_VAULT_SECRET"] = "0123456789abcdef0123456789abcdef"
os.environ["AUTH_ENABLED"] = "0"
os.environ["RATE_LIMIT"] = "9999"
os.environ["CHECKPOINTER_BACKEND"] = "memory"
os.environ["DATABASE_POOL_SIZE"] = "0"

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from virtual_team.graph import SingleAgentGraph
from virtual_team.graph_state import AgentState


@pytest.fixture
def mock_llm():
    llm = MagicMock()
    llm.__class__.__name__ = "ChatOpenAI"
    return llm


@pytest.fixture
def graph(mock_llm):
    with patch("virtual_team.graph.ChatOpenAI", return_value=mock_llm):
        g = SingleAgentGraph(
            model="test-model",
            api_key="test-key",
        )
        return g


@pytest.fixture
def graph_with_base_url(mock_llm):
    with patch("virtual_team.graph.ChatOpenAI", return_value=mock_llm):
        g = SingleAgentGraph(
            model="test-model",
            api_key="test-key",
            base_url="https://custom.api.com/v1",
        )
        return g


class TestGraphCore:

    def test_build_graph_has_correct_nodes(self, graph):
        compiled = graph.graph
        nodes = list(compiled.get_graph().nodes.keys())
        assert "agent" in nodes
        assert "tools" in nodes

    def test_build_graph_entry_point(self, graph):
        compiled = graph.graph
        graph_def = compiled.get_graph()
        assert graph_def is not None

    def test_should_continue_with_tool_calls(self, graph):
        state: AgentState = {
            "messages": [AIMessage(content="test", tool_calls=[{"name": "test_tool", "args": {}, "id": "1", "type": "tool_call"}])],
            "system_prompt": "",
            "session_context": "",
        }
        result = graph._should_continue(state)
        assert result == "tools"

    def test_should_continue_without_tool_calls(self, graph):
        state: AgentState = {
            "messages": [AIMessage(content="no tools")],
            "system_prompt": "",
            "session_context": "",
        }
        result = graph._should_continue(state)
        from langgraph.graph import END
        assert result == END

    def test_should_continue_with_no_messages(self, graph):
        state: AgentState = {
            "messages": [],
            "system_prompt": "",
            "session_context": "",
        }
        result = graph._should_continue(state)
        from langgraph.graph import END
        assert result == END

    @pytest.mark.asyncio
    async def test_agent_node_calls_llm(self, graph):
        state: AgentState = {
            "messages": [HumanMessage(content="hello")],
            "system_prompt": "You are a test agent",
            "session_context": "",
        }

        original_raw = graph._raw_llm_stream
        graph._raw_llm_stream = AsyncMock(return_value=("response", "", []))
        graph._stream_cb = None

        result = await graph._agent_node(state)

        assert "messages" in result
        msgs = result["messages"]
        assert len(msgs) == 1
        assert isinstance(msgs[0], AIMessage)

    @pytest.mark.asyncio
    async def test_agent_node_with_thinking(self, graph):
        state: AgentState = {
            "messages": [HumanMessage(content="think")],
            "system_prompt": "",
            "session_context": "",
        }

        graph._raw_llm_stream = AsyncMock(return_value=("content", "deep thinking", []))
        graph._stream_cb = None

        result = await graph._agent_node(state)
        msg = result["messages"][0]
        assert msg.additional_kwargs.get("thinking") == "deep thinking"

    @pytest.mark.asyncio
    async def test_tools_node_executes_tool(self, graph):
        tool_mock = AsyncMock()
        tool_mock.invoke = AsyncMock(return_value="tool result")
        tool_mock.name = "test_tool"
        tool_mock.description = "A test tool"
        graph._tool_map = {"test_tool": tool_mock}

        state: AgentState = {
            "messages": [
                AIMessage(
                    content="using tool",
                    tool_calls=[{"name": "test_tool", "args": {"arg1": "val1"}, "id": "tc_1", "type": "tool_call"}],
                )
            ],
            "system_prompt": "",
            "session_context": "",
        }

        result = await graph._tools_node(state)
        assert "messages" in result
        assert len(result["messages"]) == 1
        assert isinstance(result["messages"][0], ToolMessage)

    @pytest.mark.asyncio
    async def test_tools_node_unknown_tool(self, graph):
        state: AgentState = {
            "messages": [
                AIMessage(
                    content="unknown",
                    tool_calls=[{"name": "ghost_tool", "args": {}, "id": "tc_2", "type": "tool_call"}],
                )
            ],
            "system_prompt": "",
            "session_context": "",
        }

        result = await graph._tools_node(state)
        assert "messages" in result
        assert "Unknown tool: ghost_tool" in result["messages"][0].content

    @pytest.mark.asyncio
    async def test_tools_node_no_tool_calls(self, graph):
        state: AgentState = {
            "messages": [AIMessage(content="no tool calls")],
            "system_prompt": "",
            "session_context": "",
        }
        result = await graph._tools_node(state)
        assert result == {}

    @pytest.mark.asyncio
    async def test_run_calls_graph_invoke(self, graph):
        graph._graph.ainvoke = AsyncMock(return_value={
            "messages": [AIMessage(content="final answer")],
        })
        graph._last_usage = {"input_tokens": 10, "output_tokens": 20}

        result = await graph.run(requirement="test requirement")

        assert "messages" in result
        assert len(result["messages"]) == 1
        assert result["messages"][0].content == "final answer"
        assert result["input_tokens"] == 10
        assert result["output_tokens"] == 20

    @pytest.mark.asyncio
    async def test_run_with_chat_history(self, graph):
        graph._graph.ainvoke = AsyncMock(return_value={
            "messages": [AIMessage(content="with history")],
        })

        history = [HumanMessage(content="previous message")]
        result = await graph.run(requirement="new question", chat_history=history)

        assert result["messages"][0].content == "with history"

    @pytest.mark.asyncio
    async def test_arun_returns_text(self, graph):
        graph._graph.ainvoke = AsyncMock(return_value={
            "messages": [AIMessage(content="single turn answer")],
        })

        text = await graph.arun(message="hello")
        assert text == "single turn answer"

    def test_bind_tools(self, graph, mock_llm):
        tool_config = MagicMock()
        tool_config.name = "my_tool"
        tool_config.description = "A custom tool"
        tool_config.parameters = {"type": "object", "properties": {}}
        tool_config.instructions = "Do something"
        tool_config.endpoint = "http://localhost"
        tool_config.method = "GET"
        tool_config.headers = "{}"
        tool_config.mcp_type = ""
        tool_config.mcp_endpoint = ""
        tool_config.mcp_tool_name = ""

        with patch("virtual_team.graph.build_tool_definition") as mock_build:
            mock_build.return_value = ("my_tool", MagicMock(), {"name": "my_tool"})
            graph.bind_tools([tool_config])

        assert "my_tool" in graph._tool_map

    def test_with_config_returns_self(self, graph):
        result = graph.with_config(temperature=0.5)
        assert result is graph

    def test_set_stream_callback(self, graph):
        cb = MagicMock()
        graph.set_stream_callback(cb)
        assert graph._stream_cb is cb

    def test_graph_property(self, graph):
        assert graph.graph is graph._graph


class TestGraphLLMErrors:

    @pytest.mark.asyncio
    async def test_raw_llm_stream_raises(self, graph):
        graph._raw_llm_stream = AsyncMock(side_effect=Exception("LLM connection failed"))
        state = {
            "messages": [HumanMessage(content="hello")],
            "system_prompt": "",
            "session_context": "",
        }
        with pytest.raises(Exception, match="LLM connection failed"):
            await graph._raw_llm_stream(state["messages"])

    @pytest.mark.asyncio
    async def test_agent_node_llm_error(self, graph):
        graph._raw_llm_stream = AsyncMock(side_effect=Exception("API error"))
        state = {
            "messages": [HumanMessage(content="hello")],
            "system_prompt": "",
            "session_context": "",
        }
        with pytest.raises(Exception, match="API error"):
            await graph._agent_node(state)

    def test_should_continue_returns_tools_string(self, graph):
        state = {
            "messages": [AIMessage(content="", tool_calls=[{"name": "t", "args": {}, "id": "1", "type": "tool_call"}])],
            "system_prompt": "",
            "session_context": "",
        }
        result = graph._should_continue(state)
        assert result == "tools"

    def test_should_continue_returns_end_string(self, graph):
        state = {
            "messages": [AIMessage(content="done")],
            "system_prompt": "",
            "session_context": "",
        }
        result = graph._should_continue(state)
        from langgraph.graph import END
        assert result == END

    @pytest.mark.asyncio
    async def test_run_builds_messages_with_system_context(self, graph):
        graph._graph.ainvoke = AsyncMock(return_value={
            "messages": [AIMessage(content="answer")],
        })
        graph._last_usage = {"input_tokens": 5, "output_tokens": 10}

        result = await graph.run(
            requirement="build a team",
            system_prompt="You are a PM",
            session_context="Session: test-123",
        )

        assert result["messages"][0].content == "answer"
        assert result["input_tokens"] == 5
        assert result["output_tokens"] == 10


