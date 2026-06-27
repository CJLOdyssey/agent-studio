"""
Repository tests for Team CRUD and member management.
"""

import uuid

import pytest

from virtual_team.repository.teams import (
    add_team_member,
    create_team,
    delete_team,
    get_team,
    get_teams,
    link_agent_config,
    remove_team_member,
    reorder_team_members,
    update_team,
)


@pytest.mark.asyncio
async def test_create_team(db_engine):
    """create_team persists a new TeamDB row with a unique name."""
    team = await create_team(name=f"test-team-{uuid.uuid4().hex[:6]}")
    assert team is not None
    assert team.id is not None
    assert team.name.startswith("test-team-")
    assert team.order >= 0
    assert team.is_expanded is False


@pytest.mark.asyncio
async def test_team_name_unique_409(db_engine):
    """Creating a team with a duplicate name returns None (unique constraint)."""
    unique_name = f"unique-{uuid.uuid4().hex[:6]}"
    first = await create_team(name=unique_name)
    assert first is not None
    second = await create_team(name=unique_name)
    assert second is None  # Duplicate → None


@pytest.mark.asyncio
async def test_add_and_list_team_members(db_engine):
    """Adding members to a team and verifying they appear in get_team."""
    team = await create_team(name=f"members-team-{uuid.uuid4().hex[:6]}")
    member1 = await add_team_member(team.id, name="Alice", role="Frontend")
    member2 = await add_team_member(team.id, name="Bob", role="Backend")
    assert member1 is not None
    assert member2 is not None
    assert member1["name"] == "Alice"
    assert member2["name"] == "Bob"

    fetched = await get_team(team.id)
    assert fetched is not None
    assert len(fetched["agents"]) == 2
    names = [m["name"] for m in fetched["agents"]]
    assert "Alice" in names
    assert "Bob" in names


@pytest.mark.asyncio
async def test_remove_team_member(db_engine):
    """Removing a member removes it from the team."""
    team = await create_team(name=f"remove-test-{uuid.uuid4().hex[:6]}")
    member = await add_team_member(team.id, name="Charlie", role="Tester")
    assert member is not None

    removed = await remove_team_member(team.id, member["id"])
    assert removed is True

    fetched = await get_team(team.id)
    assert fetched is not None
    assert len(fetched["agents"]) == 0


@pytest.mark.asyncio
async def test_link_agent_to_team(db_engine, sample_agent):
    """Linking an agent config to a team member updates agent_config_id."""
    team = await create_team(name=f"link-team-{uuid.uuid4().hex[:6]}")
    member = await add_team_member(team.id, name="Linked Member", role="Developer")
    assert member is not None

    linked = await link_agent_config(member["id"], sample_agent.id)
    assert linked is True

    fetched = await get_team(team.id)
    assert fetched is not None
    linked_member = next((m for m in fetched["agents"] if m["id"] == member["id"]), None)
    assert linked_member is not None
    assert linked_member["agent_config_id"] == sample_agent.id


@pytest.mark.asyncio
async def test_link_agent_to_nonexistent_member(db_engine):
    """Linking to a non-existent member returns False."""
    linked = await link_agent_config(str(uuid.uuid4()), str(uuid.uuid4()))
    assert linked is False


@pytest.mark.asyncio
async def test_reorder_team_members(db_engine):
    """Reordering members updates their order values."""
    team = await create_team(name=f"reorder-team-{uuid.uuid4().hex[:6]}")
    m1 = await add_team_member(team.id, name="First", role="PM")
    m2 = await add_team_member(team.id, name="Second", role="Dev")
    m3 = await add_team_member(team.id, name="Third", role="Tester")

    # Reverse the order
    await reorder_team_members(team.id, [m3["id"], m2["id"], m1["id"]])

    fetched = await get_team(team.id)
    assert fetched is not None
    agents = fetched["agents"]
    assert len(agents) == 3
    assert agents[0]["name"] == "Third"
    assert agents[1]["name"] == "Second"
    assert agents[2]["name"] == "First"


@pytest.mark.asyncio
async def test_update_team_name(db_engine):
    """update_team changes the team name."""
    team = await create_team(name=f"orig-name-{uuid.uuid4().hex[:6]}")
    updated = await update_team(team.id, name="New Team Name")
    assert updated is not None
    assert updated.name == "New Team Name"


@pytest.mark.asyncio
async def test_delete_team(db_engine):
    """Deleting a team removes it and its members."""
    team = await create_team(name=f"del-team-{uuid.uuid4().hex[:6]}")
    await add_team_member(team.id, name="Temp", role="Dev")
    deleted = await delete_team(team.id)
    assert deleted is True
    fetched = await get_team(team.id)
    assert fetched is None


@pytest.mark.asyncio
async def test_get_teams_list(db_engine):
    """get_teams returns a list of team dicts with expected structure."""
    await create_team(name=f"list-test-{uuid.uuid4().hex[:6]}")
    teams = await get_teams()
    assert isinstance(teams, list)
    if teams:
        t = teams[0]
        assert "id" in t
        assert "name" in t
        assert "agents" in t
