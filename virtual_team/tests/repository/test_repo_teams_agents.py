"""Unit tests for virtual_team/repository/teams.py and agents.py."""

import os

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

os.environ.setdefault("KEY_VAULT_SECRET", "0123456789abcdef0123456789abcdef")
os.environ["AUTH_MODE"] = "legacy"
os.environ["AUTH_ENABLED"] = "0"
os.environ["RATE_LIMIT"] = "9999"
os.environ["CHECKPOINTER_BACKEND"] = "memory"
os.environ["DATABASE_POOL_SIZE"] = "0"

import virtual_team.database as db_mod
from virtual_team.base import Base

_sqlite_engine = create_async_engine("sqlite+aiosqlite:///:memory:")


@pytest.fixture(autouse=True)
async def setup_db():
    db_mod._async_engine = _sqlite_engine
    db_mod._async_session_factory = async_sessionmaker(_sqlite_engine, expire_on_commit=False)
    async with _sqlite_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _sqlite_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_get_team_not_found():
    from virtual_team.repository.teams import get_team

    result = await get_team("nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_get_team_found():
    from virtual_team.repository.teams import create_team, get_team

    team_obj = await create_team("Test Team", "A test team")
    assert team_obj is not None
    result = await get_team(team_obj.id)
    assert result is not None
    assert result["name"] == "Test Team"
    assert result["description"] == "A test team"


@pytest.mark.asyncio
async def test_get_teams():
    from virtual_team.repository.teams import create_team, get_teams

    t1 = await create_team("Team A")
    assert t1 is not None
    t2 = await create_team("Team B")
    assert t2 is not None
    teams = await get_teams()
    assert len(teams) >= 2


@pytest.mark.asyncio
async def test_get_teams_filtered_by_owner():
    from virtual_team.repository.teams import get_teams

    teams = await get_teams("some_owner")
    assert teams == []


@pytest.mark.asyncio
async def test_create_team_duplicate_name():
    from virtual_team.repository.teams import create_team

    t1 = await create_team("UniqueName", "first")
    assert t1 is not None
    t2 = await create_team("UniqueName", "duplicate")
    assert t2 is None


@pytest.mark.asyncio
async def test_create_team_auto_orders():
    from virtual_team.repository.teams import create_team

    t1 = await create_team("First Team")
    assert t1 is not None
    assert t1.order == 0
    t2 = await create_team("Second Team")
    assert t2 is not None
    assert t2.order == 1


@pytest.mark.asyncio
async def test_update_team_partial():
    from virtual_team.repository.teams import create_team, update_team

    team_obj = await create_team("Original", "desc")
    assert team_obj is not None
    updated = await update_team(team_obj.id, name="Updated")
    assert updated is not None
    assert updated.name == "Updated"
    assert updated.description == "desc"


@pytest.mark.asyncio
async def test_update_team_not_found():
    from virtual_team.repository.teams import update_team

    result = await update_team("nonexistent", name="test")
    assert result is None


@pytest.mark.asyncio
async def test_update_team_all_fields():
    from virtual_team.repository.teams import create_team, update_team

    team_obj = await create_team("Original", "desc")
    assert team_obj is not None
    updated = await update_team(team_obj.id, name="New", description="new desc", status="inactive", order=5, is_expanded=True)
    assert updated is not None
    assert updated.name == "New"
    assert updated.description == "new desc"
    assert updated.status == "inactive"
    assert updated.order == 5
    assert updated.is_expanded is True


@pytest.mark.asyncio
async def test_delete_team():
    from virtual_team.repository.teams import create_team, delete_team

    team_obj = await create_team("ToDelete", "bye")
    assert team_obj is not None
    assert await delete_team(team_obj.id) is True
    assert await delete_team(team_obj.id) is False


@pytest.mark.asyncio
async def test_add_team_member():
    from virtual_team.repository.teams import add_team_member, create_team

    team_obj = await create_team("TeamWithMembers", "has members")
    assert team_obj is not None
    member = await add_team_member(team_obj.id, "Agent1", "worker")
    assert member is not None
    assert member["name"] == "Agent1"
    assert member["role"] == "worker"


@pytest.mark.asyncio
async def test_add_team_member_team_not_found():
    from virtual_team.repository.teams import add_team_member

    member = await add_team_member("nonexistent", "Agent1")
    assert member is None


@pytest.mark.asyncio
async def test_remove_team_member():
    from virtual_team.repository.teams import add_team_member, create_team, remove_team_member

    team_obj = await create_team("T", "")
    assert team_obj is not None
    member = await add_team_member(team_obj.id, "Agent1")
    assert member is not None
    assert await remove_team_member(team_obj.id, member["id"]) is True
    assert await remove_team_member(team_obj.id, member["id"]) is False


@pytest.mark.asyncio
async def test_reorder_team_members():
    from virtual_team.repository.teams import add_team_member, create_team, reorder_team_members
    from virtual_team.core.infra.database import TeamAgentDB

    team_obj = await create_team("ReorderTeam", "")
    assert team_obj is not None
    m1 = await add_team_member(team_obj.id, "A")
    assert m1 is not None
    m2 = await add_team_member(team_obj.id, "B")
    assert m2 is not None
    m3 = await add_team_member(team_obj.id, "C")
    assert m3 is not None

    await reorder_team_members(team_obj.id, [m3["id"], m2["id"], m1["id"]])

    factory = db_mod.get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(TeamAgentDB).where(TeamAgentDB.team_id == team_obj.id).order_by(TeamAgentDB.order)
        )
        members = result.scalars().all()
        assert members[0].id == m3["id"]
        assert members[1].id == m2["id"]
        assert members[2].id == m1["id"]


@pytest.mark.asyncio
async def test_link_agent_config():
    from virtual_team.repository.teams import add_team_member, create_team, link_agent_config
    from virtual_team.repository.agents import create_agent_config

    team_obj = await create_team("LinkTeam", "")
    assert team_obj is not None
    member = await add_team_member(team_obj.id, "Agent1")
    assert member is not None
    cfg = await create_agent_config("CFG", "cfg-role", "prompt")
    result = await link_agent_config(member["id"], cfg.id)
    assert result is True


@pytest.mark.asyncio
async def test_link_agent_config_member_not_found():
    from virtual_team.repository.teams import link_agent_config

    result = await link_agent_config("nonexistent", "some-config-id")
    assert result is False


@pytest.mark.asyncio
async def test_get_agent_configs():
    from virtual_team.repository.agents import create_agent_config, get_agent_configs

    await create_agent_config("Agent1", "role-1", "prompt 1")
    await create_agent_config("Agent2", "role-2", "prompt 2")
    configs = await get_agent_configs()
    assert len(configs) >= 2


@pytest.mark.asyncio
async def test_get_active_agent_configs():
    from virtual_team.repository.agents import create_agent_config, get_active_agent_configs

    await create_agent_config("Active", "active-role", "prompt", is_active=True)
    await create_agent_config("Inactive", "inactive-role", "prompt", is_active=False)
    configs = await get_active_agent_configs()
    assert all(c.is_active for c in configs)
    assert any(c.role_identifier == "active-role" for c in configs)
    assert not any(c.role_identifier == "inactive-role" for c in configs)


@pytest.mark.asyncio
async def test_get_agent_config_by_role():
    from virtual_team.repository.agents import create_agent_config, get_agent_config_by_role

    await create_agent_config("Agent1", "pm-role", "prompt")
    found = await get_agent_config_by_role("pm-role")
    assert found is not None
    assert found.name == "Agent1"


@pytest.mark.asyncio
async def test_get_agent_config_by_role_not_found():
    from virtual_team.repository.agents import get_agent_config_by_role

    found = await get_agent_config_by_role("nonexistent")
    assert found is None


@pytest.mark.asyncio
async def test_get_agent_config():
    from virtual_team.repository.agents import create_agent_config, get_agent_config

    cfg = await create_agent_config("Agent1", "role-1", "prompt")
    found = await get_agent_config(cfg.id)
    assert found is not None
    assert found.name == "Agent1"


@pytest.mark.asyncio
async def test_get_agent_config_not_found():
    from virtual_team.repository.agents import get_agent_config

    assert await get_agent_config("nonexistent") is None


@pytest.mark.asyncio
async def test_get_agent_config_count():
    from virtual_team.repository.agents import create_agent_config, get_agent_config_count

    count_before = await get_agent_config_count()
    await create_agent_config("Agent1", "role-1", "prompt")
    count_after = await get_agent_config_count()
    assert count_after == count_before + 1


@pytest.mark.asyncio
async def test_create_agent_config():
    from virtual_team.repository.agents import create_agent_config

    cfg = await create_agent_config(
        "TestAgent", "test-role", "Be helpful",
        output_constraints="no markdown",
        tools='{"type": "function"}',
        mcp='{"servers": []}',
        skills="python",
        order=1,
        is_active=True,
        is_approver=False,
        icon="🤖",
        model="gpt-4",
        temperature=0.7,
        owner_id="owner-1",
    )
    assert cfg.name == "TestAgent"
    assert cfg.role_identifier == "test-role"
    assert cfg.system_prompt == "Be helpful"
    assert cfg.icon == "🤖"
    assert cfg.model == "gpt-4"


@pytest.mark.asyncio
async def test_update_agent_config():
    from virtual_team.repository.agents import create_agent_config, update_agent_config

    cfg = await create_agent_config("Original", "role-1", "prompt")
    updated = await update_agent_config(cfg.id, name="Updated", system_prompt="new prompt")
    assert updated is not None
    assert updated.name == "Updated"
    assert updated.system_prompt == "new prompt"


@pytest.mark.asyncio
async def test_update_agent_config_not_found():
    from virtual_team.repository.agents import update_agent_config

    result = await update_agent_config("nonexistent", name="test")
    assert result is None


@pytest.mark.asyncio
async def test_update_agent_config_all_fields():
    from virtual_team.repository.agents import create_agent_config, update_agent_config

    cfg = await create_agent_config("Original", "role-1", "prompt")
    updated = await update_agent_config(
        cfg.id,
        name="New",
        system_prompt="new sys",
        output_constraints="no constraints",
        tools="{}",
        mcp="{}",
        skills="[]",
        order=10,
        is_active=False,
        is_approver=True,
        icon="🔥",
        model="claude-3",
        temperature=0.5,
    )
    assert updated is not None
    assert updated.name == "New"
    assert updated.is_active is False
    assert updated.is_approver is True
    assert updated.model == "claude-3"
    assert updated.temperature == 0.5
    assert updated.icon == "🔥"


@pytest.mark.asyncio
async def test_delete_agent_config():
    from virtual_team.repository.agents import create_agent_config, delete_agent_config

    cfg = await create_agent_config("ToDelete", "del-role", "prompt")
    assert await delete_agent_config(cfg.id) is True
    assert await delete_agent_config(cfg.id) is False


@pytest.mark.asyncio
async def test_delete_agent_config_not_found():
    from virtual_team.repository.agents import delete_agent_config

    assert await delete_agent_config("nonexistent") is False
