"""Tests for LangGraph agent graph (SingleAgentGraph)."""
import pytest

pytest.importorskip("langchain_openai", reason="langchain-openai not installed")

from virtual_team.agent_graph import DEFAULT_TOOLS, AgentState


class TestAgentState:
    def test_agent_state_defaults(self):
        state = AgentState(messages=[], system_prompt="test", session_context="")
        assert state["messages"] == []
        assert state["system_prompt"] == "test"
        assert state["session_context"] == ""

    def test_agent_state_with_messages(self):
        state = AgentState(
            messages=[{"role": "user", "content": "hello"}],
            system_prompt="你是一个助手",
            session_context="历史：用户之前问了天气",
        )
        assert len(state["messages"]) == 1
        assert state["system_prompt"] == "你是一个助手"
        assert "天气" in state["session_context"]

    def test_agent_state_is_dict(self):
        state = AgentState(messages=[], system_prompt="p", session_context="c")
        assert isinstance(state, dict)


class TestDefaultTools:
    def test_tools_have_invoke_method(self):
        for tool in DEFAULT_TOOLS:
            assert hasattr(tool, "invoke")

    def test_tool_names(self):
        names = {t.name for t in DEFAULT_TOOLS}
        assert names == {"web_search", "read_file", "write_file"}

    def test_web_search_tool_description(self):
        web_tool = next(t for t in DEFAULT_TOOLS if t.name == "web_search")
        assert "search" in web_tool.description.lower()
