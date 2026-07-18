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


class TestGraphExtended:

    def test_init_with_base_url(self, mock_llm):
        with patch("virtual_team.graph.ChatOpenAI", return_value=mock_llm) as mock_init:
            g = SingleAgentGraph(
                model="test-model",
                api_key="test-key",
                base_url="https://custom.api.com/v1",
            )
        mock_init.assert_called_once()
        _, kwargs = mock_init.call_args
        assert kwargs["base_url"] == "https://custom.api.com/v1"

    def test_init_with_checkpointer(self, mock_llm):
        from langgraph.checkpoint.memory import MemorySaver
        checkpointer = MemorySaver()
        with patch("virtual_team.graph.ChatOpenAI", return_value=mock_llm):
            g = SingleAgentGraph(
                model="test-model",
                api_key="test-key",
                checkpointer=checkpointer,
            )
        assert g.checkpointer is checkpointer

    @pytest.mark.asyncio
    async def test_raw_llm_stream_calls_stream_handler(self, graph):
        mock_handler = AsyncMock(return_value=(["hello"], ["thinking"], {}, "stop", {"input_tokens": 5}))
        messages = [HumanMessage(content="hi")]
        content, thinking, tool_calls = await graph._raw_llm_stream(messages, _stream_handler=mock_handler)
        assert content == "hello"
        assert thinking == "thinking"
        assert tool_calls == []

    @pytest.mark.asyncio
    async def test_raw_llm_stream_with_tool_calls(self, graph):
        mock_handler = AsyncMock(return_value=(
            ["content"], ["think"],
            {0: {"id": "c1", "name": "search", "arguments": '{"q":"test"}'}},
            "tool_calls", {"input_tokens": 10},
        ))
        messages = [HumanMessage(content="search")]
        content, thinking, tool_calls = await graph._raw_llm_stream(messages, _stream_handler=mock_handler)
        assert content == "content"
        assert len(tool_calls) == 1
        assert tool_calls[0]["name"] == "search"

    @pytest.mark.asyncio
    async def test_agent_node_with_session_context(self, graph):
        state = {
            "messages": [HumanMessage(content="hello")],
            "system_prompt": "",
            "session_context": "Session context here",
        }
        graph._raw_llm_stream = AsyncMock(return_value=("response", "", []))
        graph._stream_cb = None
        result = await graph._agent_node(state)
        assert "messages" in result

    @pytest.mark.asyncio
    async def test_agent_node_with_tool_calls_and_thinking(self, graph):
        state = {
            "messages": [HumanMessage(content="do something")],
            "system_prompt": "",
            "session_context": "",
        }
        graph._raw_llm_stream = AsyncMock(return_value=(
            "content", "thinking text",
            [{"name": "search", "args": {"q": "test"}, "id": "c1"}],
        ))
        stream_cb = AsyncMock()
        graph._stream_cb = stream_cb
        result = await graph._agent_node(state)
        msg = result["messages"][0]
        assert msg.additional_kwargs.get("thinking") == "thinking text"
        assert len(msg.tool_calls) == 1
        stream_cb.assert_any_call({"event": "on_thinking_nodes", "data": {"nodes": [{"type": "thought", "content": "thinking text"}, {"type": "tool_call", "content": "Calling search", "toolName": "search", "toolParams": {"q": "test"}}]}})
        stream_cb.assert_any_call({"event": "on_node_end", "data": {}})

    @pytest.mark.asyncio
    async def test_agent_node_thinking_with_cb_no_tools(self, graph):
        state = {
            "messages": [HumanMessage(content="think")],
            "system_prompt": "",
            "session_context": "",
        }
        graph._raw_llm_stream = AsyncMock(return_value=("content", "thinking text", []))
        stream_cb = AsyncMock()
        graph._stream_cb = stream_cb
        await graph._agent_node(state)
        stream_cb.assert_any_call({"event": "on_thinking_nodes", "data": {"nodes": [{"type": "thought", "content": "thinking text"}]}})
        stream_cb.assert_any_call({"event": "on_node_end", "data": {}})

    @pytest.mark.asyncio
    async def test_tools_node_error_handling(self, graph):
        tool_mock = AsyncMock()
        tool_mock.invoke = AsyncMock(side_effect=Exception("tool crashed"))
        tool_mock.name = "failing_tool"
        graph._tool_map = {"failing_tool": tool_mock}
        state = {
            "messages": [
                AIMessage(
                    content="using tool",
                    tool_calls=[{"name": "failing_tool", "args": {}, "id": "tc_err", "type": "tool_call"}],
                )
            ],
            "system_prompt": "",
            "session_context": "",
        }
        result = await graph._tools_node(state)
        assert "Error: tool crashed" in result["messages"][0].content

    @pytest.mark.asyncio
    async def test_tools_node_with_stream_cb(self, graph):
        tool_mock = AsyncMock()
        tool_mock.invoke = AsyncMock(return_value="success")
        tool_mock.name = "cb_tool"
        graph._tool_map = {"cb_tool": tool_mock}
        stream_cb = AsyncMock()
        graph._stream_cb = stream_cb
        state = {
            "messages": [
                AIMessage(
                    content="using tool",
                    tool_calls=[{"name": "cb_tool", "args": {}, "id": "tc_cb", "type": "tool_call"}],
                )
            ],
            "system_prompt": "",
            "session_context": "",
        }
        result = await graph._tools_node(state)
        stream_cb.assert_any_call({"event": "on_tool_result", "data": {"tool": "cb_tool", "result": "success"}})
        stream_cb.assert_any_call({"event": "on_node_end", "data": {}})
        assert "success" in result["messages"][0].content

    @pytest.mark.asyncio
    async def test_tools_node_llm_fallback(self, graph):
        tool_mock = AsyncMock()
        tool_mock.invoke = AsyncMock(return_value='{"status": "ok", "data": "some result"}')
        tool_mock.name = "fallback_tool"
        tool_mock.description = "A tool needing fallback"
        graph._tool_map = {"fallback_tool": tool_mock}
        graph.llm.ainvoke = AsyncMock(return_value=MagicMock(content="LLM fallback result"))
        state = {
            "messages": [
                AIMessage(
                    content="using fallback",
                    tool_calls=[{"name": "fallback_tool", "args": {"input": "test"}, "id": "tc_fb", "type": "tool_call"}],
                )
            ],
            "system_prompt": "",
            "session_context": "",
        }
        result = await graph._tools_node(state)
        assert "LLM fallback result" in result["messages"][0].content

    @pytest.mark.asyncio
    async def test_tools_node_llm_fallback_error(self, graph):
        tool_mock = AsyncMock()
        tool_mock.invoke = AsyncMock(return_value='{"status": "error", "detail": "fail"}')
        tool_mock.name = "fb_err_tool"
        graph._tool_map = {"fb_err_tool": tool_mock}
        graph.llm.ainvoke = AsyncMock(side_effect=Exception("LLM fallback crashed"))
        state = {
            "messages": [
                AIMessage(
                    content="using fallback",
                    tool_calls=[{"name": "fb_err_tool", "args": {}, "id": "tc_fb2", "type": "tool_call"}],
                )
            ],
            "system_prompt": "",
            "session_context": "",
        }
        result = await graph._tools_node(state)
        assert '{"status": "error"' in result["messages"][0].content

    @pytest.mark.asyncio
    async def test_tools_node_no_stream_cb(self, graph):
        tool_mock = AsyncMock()
        tool_mock.invoke = AsyncMock(return_value="plain result")
        tool_mock.name = "no_cb_tool"
        graph._tool_map = {"no_cb_tool": tool_mock}
        graph._stream_cb = None
        state = {
            "messages": [
                AIMessage(
                    content="no cb",
                    tool_calls=[{"name": "no_cb_tool", "args": {}, "id": "tc_nocb", "type": "tool_call"}],
                )
            ],
            "system_prompt": "",
            "session_context": "",
        }
        result = await graph._tools_node(state)
        assert result["messages"][0].content == "plain result"
