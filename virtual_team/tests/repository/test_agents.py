"""
Repository tests for Agent Config CRUD operations.

Uses conftest fixtures (db_engine, async_session) against in-memory SQLite.
"""
import uuid

import pytest

from virtual_team.repository.agents import (
    create_agent_config,
    delete_agent_config,
    get_agent_config,
    get_agent_config_count,
    get_agent_configs,
    update_agent_config,
)


@pytest.mark.asyncio
async def test_create_agent(db_engine):
    """Creating an agent via repository returns a persisted AgentConfigDB row."""
    agent = await create_agent_config(
        name="Unit Test Agent",
        role_identifier=f"unit_test_agent_{uuid.uuid4().hex[:8]}",
        system_prompt="You are a unit test agent.",
    )
    assert agent is not None
    assert agent.id is not None
    assert agent.name == "Unit Test Agent"
    assert agent.is_active is True
    assert agent.is_approver is False
    assert agent.icon == "🤖"
    assert agent.system_prompt == "You are a unit test agent."


@pytest.mark.asyncio
async def test_get_agent(db_engine, sample_agent):
    """get_agent_config returns the agent by its ID."""
    fetched = await get_agent_config(sample_agent.id)
    assert fetched is not None
    assert fetched.id == sample_agent.id
    assert fetched.name == sample_agent.name


@pytest.mark.asyncio
async def test_get_agent_not_found(db_engine):
    """get_agent_config returns None for a non-existent ID."""
    fetched = await get_agent_config(str(uuid.uuid4()))
    assert fetched is None


@pytest.mark.asyncio
async def test_list_agents(db_engine, sample_agent):
    """get_agent_configs returns all agents, including the seeded sample."""
    agents = await get_agent_configs()
    assert isinstance(agents, list)
    assert len(agents) >= 1
    ids = [a.id for a in agents]
    assert sample_agent.id in ids


@pytest.mark.asyncio
async def test_update_agent(db_engine, sample_agent):
    """Updating an agent's name and is_active fields persists correctly."""
    updated = await update_agent_config(
        id=sample_agent.id,
        name="Updated Agent",
        is_active=False,
    )
    assert updated is not None
    assert updated.name == "Updated Agent"
    assert updated.is_active is False
    # Verify via fresh fetch
    refetched = await get_agent_config(sample_agent.id)
    assert refetched is not None
    assert refetched.name == "Updated Agent"


@pytest.mark.asyncio
async def test_delete_agent(db_engine, sample_agent):
    """Deleting an agent removes it from the database."""
    deleted = await delete_agent_config(sample_agent.id)
    assert deleted is True
    refetched = await get_agent_config(sample_agent.id)
    assert refetched is None


@pytest.mark.asyncio
async def test_delete_agent_not_found(db_engine):
    """Deleting a non-existent agent returns False."""
    deleted = await delete_agent_config(str(uuid.uuid4()))
    assert deleted is False


@pytest.mark.asyncio
async def test_agent_count_increments(db_engine):
    """Agent count increases after creating new agents."""
    count_before = await get_agent_config_count()
    await create_agent_config(
        name="Count Test 1",
        role_identifier=f"count_test_1_{uuid.uuid4().hex[:8]}",
        system_prompt="test",
    )
    await create_agent_config(
        name="Count Test 2",
        role_identifier=f"count_test_2_{uuid.uuid4().hex[:8]}",
        system_prompt="test",
    )
    count_after = await get_agent_config_count()
    assert count_after == count_before + 2
