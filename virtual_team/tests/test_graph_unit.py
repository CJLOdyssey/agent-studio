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


class TestSingleAgentGraphInit:
    def test_init_with_model_and_api_key(self):
        with patch("virtual_team.graph.ChatOpenAI") as mock_llm_cls:
            with patch("virtual_team.graph.StateGraph"):
                from virtual_team.graph import SingleAgentGraph

                sg = SingleAgentGraph(
                    model="deepseek-chat",
                    api_key="sk-test",
                    checkpointer=MagicMock(),
                )
                assert sg.model == "deepseek-chat"
                assert sg.api_key == "sk-test"
                mock_llm_cls.assert_called_once_with(
                    model="deepseek-chat",
                    api_key="sk-test",
                    temperature=0.7,
                    max_tokens=65536,
                )

    def test_init_with_base_url(self):
        with patch("virtual_team.graph.ChatOpenAI") as mock_llm_cls:
            with patch("virtual_team.graph.StateGraph"):
                from virtual_team.graph import SingleAgentGraph

                SingleAgentGraph(
                    model="gpt-4",
                    api_key="sk-xxx",
                    base_url="https://api.openai.com/v1",
                    checkpointer=MagicMock(),
                )
                mock_llm_cls.assert_called_once_with(
                    model="gpt-4",
                    api_key="sk-xxx",
                    temperature=0.7,
                    max_tokens=65536,
                    base_url="https://api.openai.com/v1",
                )

    def test_init_with_custom_params(self):
        with patch("virtual_team.graph.ChatOpenAI") as mock_llm_cls:
            with patch("virtual_team.graph.StateGraph"):
                from virtual_team.graph import SingleAgentGraph

                SingleAgentGraph(
                    model="deepseek-chat",
                    api_key="sk-test",
                    temperature=0.1,
                    max_tokens=2048,
                    checkpointer=MagicMock(),
                )
                mock_llm_cls.assert_called_once_with(
                    model="deepseek-chat",
                    api_key="sk-test",
                    temperature=0.1,
                    max_tokens=2048,
                )

    def test_init_with_checkpointer(self):
        with patch("virtual_team.graph.ChatOpenAI"):
            with patch("virtual_team.graph.StateGraph"):
                from langgraph.checkpoint.memory import MemorySaver

                from virtual_team.graph import SingleAgentGraph

                ms = MemorySaver()
                graph = SingleAgentGraph(model="deepseek-chat", api_key="sk-test", checkpointer=ms)
                assert graph.checkpointer is ms

    def test_init_creates_graph(self):
        with patch("virtual_team.graph.ChatOpenAI"):
            with patch("virtual_team.graph.StateGraph") as mock_sg_cls:
                mock_builder = MagicMock()
                mock_sg_cls.return_value = mock_builder
                mock_compiled = MagicMock()
                mock_builder.compile.return_value = mock_compiled

                from virtual_team.graph import SingleAgentGraph

                sg = SingleAgentGraph(
                    model="deepseek-chat",
                    api_key="sk-test",
                    checkpointer=MagicMock(),
                )
                assert sg._graph is mock_compiled

    def test_init_with_default_checkpointer(self):
        with patch("virtual_team.graph.ChatOpenAI"):
            with patch("virtual_team.graph.StateGraph"):
                with patch("virtual_team.checkpoint.create_checkpointer") as mock_cc:
                    mock_cc.return_value = MagicMock()
                    from virtual_team.graph import SingleAgentGraph

                    sg = SingleAgentGraph(model="deepseek-chat", api_key="sk-test")
                    assert sg.checkpointer is mock_cc.return_value
                    mock_cc.assert_called_once()


class TestSingleAgentGraphBuildGraph:
    def test_build_graph_adds_nodes_and_edges(self):
        sg, compiled = _make_graph()
        assert sg._graph is compiled


class TestSingleAgentGraphShouldContinue:
    def test_continue_when_tool_calls(self):
        from virtual_team.graph_state import AgentState

        sg, _ = _make_graph()
        state: AgentState = {
            "messages": [AIMessage(content="", tool_calls=[{"name": "search", "args": {}, "id": "c1"}])],
            "system_prompt": "",
            "session_context": "",
        }
        result = sg._should_continue(state)
        assert result == "tools"

    def test_end_when_no_tool_calls(self):
        from virtual_team.graph_state import AgentState

        sg, _ = _make_graph()
        state: AgentState = {
            "messages": [AIMessage(content="Hello")],
            "system_prompt": "",
            "session_context": "",
        }
        result = sg._should_continue(state)
        assert result == "__end__"

    def test_end_when_empty_messages(self):
        from virtual_team.graph_state import AgentState

        sg, _ = _make_graph()
        state: AgentState = {
            "messages": [],
            "system_prompt": "",
            "session_context": "",
        }
        result = sg._should_continue(state)
        assert result == "__end__"


class TestSingleAgentGraphBindTools:
    def test_bind_tools_adds_to_map(self):
        with patch("virtual_team.graph.build_tool_definition") as mock_btd:
            mock_wrapper = MagicMock()
            mock_btd.return_value = ("search_tool", mock_wrapper, {"name": "search_tool"})

            sg, _ = _make_graph()
            sg.bind_tools([MagicMock()])

            assert "search_tool" in sg._tool_map
            assert sg._tool_map["search_tool"] is mock_wrapper
            assert len(sg._tool_definitions) == 1


class TestSingleAgentGraphErrors:
    def test_missing_api_key_raises_on_llm_init(self):
        with patch("virtual_team.graph.ChatOpenAI") as mock_llm:
            mock_llm.side_effect = ValueError("API key required")
            with patch("virtual_team.graph.StateGraph"):
                from virtual_team.graph import SingleAgentGraph

                with pytest.raises(ValueError, match="API key required"):
                    SingleAgentGraph(model="deepseek-chat", api_key="", checkpointer=MagicMock())


class TestSingleAgentGraphProperties:
    def test_graph_property(self):
        sg, compiled = _make_graph()
        assert sg.graph is compiled

    def test_with_config_returns_self(self):
        sg, _ = _make_graph()
        result = sg.with_config(custom_key="value")
        assert result is sg

    def test_set_stream_callback(self):
        sg, _ = _make_graph()
        cb = MagicMock()
        sg.set_stream_callback(cb)
        assert sg._stream_cb is cb


class TestSingleAgentGraphRun:
    @pytest.mark.asyncio
    async def test_run_calls_ainvoke(self):
        sg, compiled = _make_graph()
        compiled.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content="Hello!")]})
        result = await sg.run(requirement="Hi")
        assert result["messages"][-1].content == "Hello!"

    @pytest.mark.asyncio
    async def test_run_with_chat_history(self):
        sg, compiled = _make_graph()
        compiled.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content="Result")]})
        result = await sg.run(
            requirement="Continue",
            chat_history=[HumanMessage(content="Previous chat")],
        )
        assert result["messages"][-1].content == "Result"

    @pytest.mark.asyncio
    async def test_run_returns_usage(self):
        sg, compiled = _make_graph()
        compiled.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content="Done")]})
        sg._last_usage = {"input_tokens": 10, "output_tokens": 20}
        result = await sg.run(requirement="test")
        assert result["input_tokens"] == 10
        assert result["output_tokens"] == 20
