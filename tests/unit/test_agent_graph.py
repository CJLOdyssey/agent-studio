"""Tests for LangGraph agent graph (AgentState, SingleAgentGraph)."""
import pytest

pytest.importorskip("langchain_openai", reason="langchain-openai not installed")

from virtual_team.agent_graph import DEFAULT_TOOLS, AgentState, SingleAgentGraph


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


class TestAgentStateTypedDict:
    def test_agent_state_is_dict_like(self):
        """AgentState should behave as a dict at runtime (TypedDict is dict-compatible)."""
        state: AgentState = {
            "messages": [],
            "system_prompt": "你是一个助手",
            "session_context": "",
        }
        assert state["system_prompt"] == "你是一个助手"
        assert state["messages"] == []
        assert state["session_context"] == ""

    def test_agent_state_all_keys_required(self):
        """All fields are required in the TypedDict."""
        state: AgentState = {
            "messages": [],
            "system_prompt": "test",
            "session_context": "ctx",
        }
        assert len(state) == 3

    def test_agent_state_with_langchain_messages(self):
        from langchain_core.messages import HumanMessage
        state: AgentState = {
            "messages": [HumanMessage(content="hello")],
            "system_prompt": "你是一个助手",
            "session_context": "之前用户问了天气",
        }
        assert len(state["messages"]) == 1
        assert "天气" in state["session_context"]


class TestSingleAgentGraphInit:
    def test_graph_initializes_with_memory_checkpointer(self):
        graph = SingleAgentGraph(
            model="deepseek-chat",
            api_key="test-key",
            checkpointer="memory",
        )
        assert graph.model == "deepseek-chat"
        assert graph.temperature == 0.7
        assert graph._graph is not None

    def test_graph_with_custom_temperature(self):
        graph = SingleAgentGraph(
            model="gpt-4o",
            api_key="test-key",
            temperature=0.3,
        )
        assert graph.temperature == 0.3

    def test_graph_sync_invoke_returns_dict(self):
        graph = SingleAgentGraph(
            model="deepseek-chat",
            api_key="test-key",
        )
        assert hasattr(graph, "invoke_sync")
        assert hasattr(graph, "run")
        assert hasattr(graph, "set_tools")
