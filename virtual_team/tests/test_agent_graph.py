"""
Unit tests for SingleAgentGraph and related components.

These tests validate graph construction, tool binding, tool execution,
and checkpointer creation — without requiring a live LLM API key.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from virtual_team.agent_graph import (
    SingleAgentGraph,
    ToolConfig,
    _ToolWrapper,
)
from virtual_team.checkpoint import create_checkpointer

# ──────────────────────────────────────────────────────────────────────────────
# Tool binding tests
# ──────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_bind_tools_initializes_correctly():
    """bind_tools populates _tool_map and _tool_definitions from ToolConfig list."""
    graph = SingleAgentGraph(
        model="deepseek-chat",
        api_key="test-key",
        base_url="http://localhost:9999",
    )
    tool_configs = [
        ToolConfig(
            name="weather",
            description="Get weather for a city",
            parameters={"type": "object", "properties": {"city": {"type": "string"}}},
        ),
        ToolConfig(
            name="calculator",
            description="Simple math",
            parameters={"type": "object", "properties": {"expr": {"type": "string"}}},
        ),
    ]
    graph.bind_tools(tool_configs)

    assert len(graph._tool_map) == 2
    assert "weather" in graph._tool_map
    assert "calculator" in graph._tool_map
    assert len(graph._tool_definitions) == 2
    assert graph._tool_definitions[0]["function"]["name"] == "weather"
    assert graph._tool_definitions[1]["function"]["name"] == "calculator"

    # Verify wrapper is a _ToolWrapper instance
    weather_wrapper = graph._tool_map["weather"]
    assert isinstance(weather_wrapper, _ToolWrapper)
    assert weather_wrapper.name == "weather"
    assert weather_wrapper.description == "Get weather for a city"


@pytest.mark.asyncio
async def test_bind_tools_strips_empty_properties():
    """bind_tools removes empty 'properties': {} for DeepSeek compatibility."""
    graph = SingleAgentGraph(
        model="deepseek-chat",
        api_key="test-key",
        base_url="http://localhost:9999",
    )
    tool_configs = [
        ToolConfig(
            name="no_params",
            description="Tool with empty params",
            parameters={"type": "object", "properties": {}},
        ),
    ]
    graph.bind_tools(tool_configs)

    assert len(graph._tool_definitions) == 1
    params = graph._tool_definitions[0]["function"]["parameters"]
    assert "properties" not in params
    assert params["type"] == "object"


# ──────────────────────────────────────────────────────────────────────────────
# ToolWrapper execution tests
# ──────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_tool_wrapper_builtin_handler():
    """_ToolWrapper.invoke calls the correct builtin handler for known tools."""
    # weather tool
    weather_tool = _ToolWrapper(name="weather", description="Get weather")
    result = await weather_tool.invoke({"city": "Shanghai"})
    assert "Shanghai" in result
    assert "Shanghai" in result
    assert "weather" in result
    assert "humidity" in result

    # calculator tool
    calc_tool = _ToolWrapper(name="calculator", description="Math")
    result = await calc_tool.invoke({"expression": "2+3"})
    assert "5" in result

    # skill_* tool
    skill_tool = _ToolWrapper(
        name="skill_code_review",
        description="Review code",
        instructions="Look for bugs, check for security issues, suggest improvements.",
    )
    result = await skill_tool.invoke({})
    assert "Look for bugs" in result


@pytest.mark.asyncio
async def test_tool_wrapper_custom_with_llm():
    """Custom tool with no builtin handler falls back to LLM when available."""
    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="Custom tool result: done"))

    wrapper = _ToolWrapper(name="my_custom_tool", description="A custom tool")
    wrapper.set_llm(mock_llm)
    result = await wrapper.invoke({"input": "test"})
    assert "Custom tool result: done" in result
    mock_llm.ainvoke.assert_called_once()


@pytest.mark.asyncio
async def test_tool_wrapper_no_builtin_no_llm():
    """Custom tool without LLM returns a fallback executed note."""
    wrapper = _ToolWrapper(name="unknown_tool", description="No handler")
    # No LLM set — should return fallback
    result = await wrapper.invoke({"some_arg": "value"})
    assert "unknown_tool" in result
    assert "executed" in result


# ──────────────────────────────────────────────────────────────────────────────
# Checkpointer tests
# ──────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_checkpointer_returns_memory_saver():
    """create_checkpointer returns MemorySaver when backend is memory."""
    from langgraph.checkpoint.memory import MemorySaver

    cp = create_checkpointer(backend="memory")
    assert isinstance(cp, MemorySaver)


# ──────────────────────────────────────────────────────────────────────────────
# Graph construction tests
# ──────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_graph_constructor_sets_attributes():
    """SingleAgentGraph constructor sets model, api_key, temperature, etc."""
    graph = SingleAgentGraph(
        model="gpt-4",
        api_key="sk-test-key",
        base_url="http://localhost:9999",
        temperature=0.3,
        max_tokens=2048,
    )
    assert graph.model == "gpt-4"
    assert graph.api_key == "sk-test-key"
    assert graph.base_url == "http://localhost:9999"
    assert graph.temperature == 0.3
    assert graph.max_tokens == 2048
    assert graph._graph is not None
    assert graph._tool_map == {}
    assert graph._tool_definitions == []
