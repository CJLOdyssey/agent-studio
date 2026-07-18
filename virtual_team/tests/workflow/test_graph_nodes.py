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
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, HumanMessage


def _make_graph(**kwargs):
    with patch("virtual_team.graph.ChatOpenAI") as mock_llm:
        with patch("virtual_team.graph.StateGraph") as mock_sg_cls:
            mock_llm.return_value = MagicMock()
            mock_builder = MagicMock()
            mock_sg_cls.return_value = mock_builder
            compiled = MagicMock()
            mock_builder.compile.return_value = compiled

            from virtual_team.graph import SingleAgentGraph

            params = {"model": "deepseek-chat", "api_key": "sk-test", "checkpointer": MagicMock()}
            params.update(kwargs)
            sg = SingleAgentGraph(**params)
            return sg, compiled


