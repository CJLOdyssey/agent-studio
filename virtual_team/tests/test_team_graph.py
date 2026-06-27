"""
Unit tests for TeamGraph — multi-agent collaboration graph.

Tests graph construction, agent configuration, and state structure
without requiring a live LLM API key.
"""
from unittest.mock import MagicMock, patch

import pytest

from virtual_team.team_graph import (
    APPROVAL_KEYWORD,
    DIRECT_REPLY_KEYWORD,
    TeamGraph,
    TeamState,
    _replace_section,
)


# ──────────────────────────────────────────────────────────────────────────────
# TeamGraph initialization tests
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_team_graph_initialization():
    """TeamGraph constructor sets model, api_key, temperature, max_rounds."""
    graph = TeamGraph(
        model="deepseek-chat",
        api_key="test-key",
        base_url="http://localhost:9999",
        temperature=0.5,
        max_tokens=2048,
        max_rounds=3,
    )
    assert graph.model == "deepseek-chat"
    assert graph.api_key == "test-key"
    assert graph.base_url == "http://localhost:9999"
    assert graph.temperature == 0.5
    assert graph.max_tokens == 2048
    assert graph.max_rounds == 3
    assert graph._agent_prompts == {}
    assert graph._graph is not None


@pytest.mark.asyncio
async def test_set_agents_populates_prompts():
    """set_agents populates _agent_prompts from agent config dicts."""
    graph = TeamGraph(
        model="deepseek-chat",
        api_key="test-key",
        base_url="http://localhost:9999",
    )
    agents = [
        {
            "role_identifier": "product_manager",
            "system_prompt": "You are a PM. Analyze requirements.",
            "name": "Alice",
        },
        {
            "role_identifier": "programmer",
            "system_prompt": "You are a senior programmer. Write clean code.",
            "name": "Bob",
        },
        {
            "role_identifier": "tester",
            "system_prompt": "You are a tester. Review thoroughly.",
            "name": "Charlie",
        },
    ]
    graph.set_agents(agents)

    assert len(graph._agent_prompts) == 3
    assert graph._agent_prompts["product_manager"] == "You are a PM. Analyze requirements."
    assert graph._agent_prompts["programmer"] == "You are a senior programmer. Write clean code."
    assert graph._agent_prompts["tester"] == "You are a tester. Review thoroughly."


@pytest.mark.asyncio
async def test_set_agents_empty_list():
    """set_agents with empty list leaves _agent_prompts empty."""
    graph = TeamGraph(
        model="deepseek-chat",
        api_key="test-key",
        base_url="http://localhost:9999",
    )
    graph.set_agents([])
    assert graph._agent_prompts == {}
    # After set_agents, _graph is still compiled
    assert graph._graph is not None


# ──────────────────────────────────────────────────────────────────────────────
# TeamState structure tests
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_team_state_structure():
    """TeamState has all required keys: messages, requirement, pm_document, etc."""
    state = TeamState.__annotations__
    assert "messages" in state
    assert "requirement" in state
    assert "pm_document" in state
    assert "code" in state
    assert "review" in state
    assert "approved" in state
    assert "round_number" in state

    # Verify we can construct a minimal state
    from langchain_core.messages import HumanMessage

    initial = TeamState(
        messages=[HumanMessage(content="Build a todo app")],
        requirement="Build a todo app",
        pm_document="",
        code="",
        review="",
        approved=False,
        round_number=0,
    )
    assert initial["requirement"] == "Build a todo app"
    assert initial["approved"] is False
    assert initial["round_number"] == 0
    assert len(initial["messages"]) == 1


# ──────────────────────────────────────────────────────────────────────────────
# _replace_section unit tests
# ──────────────────────────────────────────────────────────────────────────────

def test_replace_section_empty_existing():
    """When existing is empty, _replace_section appends header + content."""
    result = _replace_section("", "## Code", "print('hello')")
    assert result == "## Code\nprint('hello')"


def test_replace_section_updates_existing():
    """When section exists, its content is replaced.
    
    Note: section_header must NOT have trailing newline — the function adds one.
    """
    existing = (
        "## Frontend Code\nold frontend\n\n"
        "## Backend Code\nold backend\n\n"
        "## Tests\nold tests"
    )
    result = _replace_section(existing, "## Frontend Code", "new frontend\nwith more code")
    assert "new frontend" in result
    assert "with more code" in result
    assert "old frontend" not in result
    assert "old backend" in result  # Other sections preserved
    assert "old tests" in result


def test_replace_section_appends_when_not_found():
    """When section header is not found, it appends at the end."""
    existing = "## Existing Section\nexisting content"
    result = _replace_section(existing, "## New Section\n", "new content")
    assert "Existing Section" in result
    assert "New Section" in result
    assert "new content" in result
    # New section should be at the end
    assert result.index("New Section") > result.index("Existing Section")


# ──────────────────────────────────────────────────────────────────────────────
# Constants test
# ──────────────────────────────────────────────────────────────────────────────

def test_approval_keyword():
    """APPROVAL_KEYWORD is the expected Chinese marker."""
    assert APPROVAL_KEYWORD == "【批准】"


def test_direct_reply_keyword():
    """DIRECT_REPLY_KEYWORD is the expected Chinese marker."""
    assert DIRECT_REPLY_KEYWORD == "【直接回复】"
