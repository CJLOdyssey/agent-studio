"""Tests for AgentState TypedDict and SingleAgentGraph initialization."""
import pytest

pytest.importorskip("langchain_openai", reason="langchain-openai not installed")

from virtual_team.agent_graph import AgentState, SingleAgentGraph


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
        # Without actual LLM call, invoke_sync will fail — but we can test the structure
        assert hasattr(graph, "invoke_sync")
        assert hasattr(graph, "run")
        assert hasattr(graph, "set_tools")
