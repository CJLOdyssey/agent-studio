"""Tests for agents.py repository."""

import uuid

import pytest

from backend.repository.agents import (
    create_agent_config,
    delete_agent_config,
    get_active_agent_configs,
    get_agent_config,
    get_agent_config_by_role,
    get_agent_config_count,
    get_agent_configs,
    update_agent_config,
)


class TestAgentRepo:
    async def test_create_agent(self, db_engine):
        agent = await create_agent_config(
            name="Test Agent",
            role_identifier=f"test_agent_{uuid.uuid4().hex[:8]}",
            system_prompt="You are a test agent.",
        )
        assert agent.id is not None
        assert agent.name == "Test Agent"
        assert agent.is_active is True
        assert agent.is_approver is False
        assert agent.icon == "🤖"

    async def test_create_agent_with_all_params(self, db_engine):
        agent = await create_agent_config(
            name="Full Agent",
            role_identifier=f"full_{uuid.uuid4().hex[:8]}",
            system_prompt="Prompt",
            output_constraints="Constraints",
            tools="[]",
            mcp="[]",
            skills="[]",
            order=5,
            is_active=False,
            is_approver=True,
            icon="🎯",
            model="gpt-4",
            temperature=0.7,
            owner_id="owner-1",
        )
        assert agent.output_constraints == "Constraints"
        assert agent.tools == "[]"
        assert agent.order == 5
        assert agent.is_active is False
        assert agent.is_approver is True
        assert agent.icon == "🎯"
        assert agent.model == "gpt-4"
        assert agent.temperature == 0.7
        assert agent.owner_id == "owner-1"

    async def test_get_agent(self, db_engine, sample_agent):
        found = await get_agent_config(sample_agent.id)
        assert found is not None
        assert found.id == sample_agent.id

    async def test_get_agent_not_found(self, db_engine):
        found = await get_agent_config(str(uuid.uuid4()))
        assert found is None

    async def test_get_agent_by_role(self, db_engine):
        role = f"role_{uuid.uuid4().hex[:8]}"
        await create_agent_config(
            name="By Role", role_identifier=role, system_prompt="p",
        )
        found = await get_agent_config_by_role(role)
        assert found is not None
        assert found.role_identifier == role

    async def test_get_agent_by_role_not_found(self, db_engine):
        found = await get_agent_config_by_role("nonexistent_role")
        assert found is None

    async def test_get_agent_configs(self, db_engine, sample_agent):
        agents = await get_agent_configs()
        assert len(agents) >= 1
        ids = [a.id for a in agents]
        assert sample_agent.id in ids

    async def test_get_active_agent_configs(self, db_engine):
        await create_agent_config(
            name="Active", role_identifier=f"act_{uuid.uuid4().hex[:8]}",
            system_prompt="p", is_active=True,
        )
        await create_agent_config(
            name="Inactive", role_identifier=f"inact_{uuid.uuid4().hex[:8]}",
            system_prompt="p", is_active=False,
        )
        active = await get_active_agent_configs()
        assert all(a.is_active for a in active)

    async def test_get_agent_config_count(self, db_engine):
        before = await get_agent_config_count()
        await create_agent_config(
            name="Count", role_identifier=f"cnt_{uuid.uuid4().hex[:8]}",
            system_prompt="p",
        )
        after = await get_agent_config_count()
        assert after == before + 1

    async def test_update_agent(self, db_engine, sample_agent):
        updated = await update_agent_config(
            id=sample_agent.id,
            name="Updated Agent",
            is_active=False,
            is_approver=True,
            icon="🎯",
            model="gpt-4",
            temperature=0.5,
        )
        assert updated is not None
        assert updated.name == "Updated Agent"
        assert updated.is_active is False
        assert updated.is_approver is True
        assert updated.icon == "🎯"

    async def test_update_agent_all_fields(self, db_engine, sample_agent):
        updated = await update_agent_config(
            id=sample_agent.id,
            name="N",
            system_prompt="SP",
            output_constraints="OC",
            tools="[]",
            mcp="[]",
            skills="[]",
            order=99,
            is_active=False,
            is_approver=True,
            icon="🔥",
            model="gpt-4",
            temperature=0.9,
        )
        assert updated is not None
        assert updated.system_prompt == "SP"
        assert updated.output_constraints == "OC"
        assert updated.order == 99

    async def test_update_agent_not_found(self, db_engine):
        result = await update_agent_config(id=str(uuid.uuid4()), name="x")
        assert result is None

    async def test_delete_agent(self, db_engine, sample_agent):
        deleted = await delete_agent_config(sample_agent.id)
        assert deleted is True
        found = await get_agent_config(sample_agent.id)
        assert found is None

    async def test_delete_agent_not_found(self, db_engine):
        deleted = await delete_agent_config(str(uuid.uuid4()))
        assert deleted is False
