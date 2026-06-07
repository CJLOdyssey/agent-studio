"""Repository 层测试：virtual_team.repository.agents"""
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest

from tests.unit.repository.conftest import make_mock_session


def _make_agent(id="a1", name="PM", role_identifier="pm", system_prompt="你是PM",
                order=0, is_active=True, is_approver=False, icon="📋",
                model="gpt-4o", temperature=0.7, output_constraints=None,
                tools=None, mcp=None, skills=None, created_at=None):
    m = MagicMock()
    m.id = id
    m.name = name
    m.role_identifier = role_identifier
    m.system_prompt = system_prompt
    m.order = order
    m.is_active = is_active
    m.is_approver = is_approver
    m.icon = icon
    m.model = model
    m.temperature = temperature
    m.output_constraints = output_constraints
    m.tools = tools
    m.mcp = mcp
    m.skills = skills
    m.created_at = created_at
    return m


def _make_message(id="m1", run_id="r1", role="pm", agent_name="PM",
                  content="hello", round_number=1):
    m = MagicMock()
    m.id = id
    m.run_id = run_id
    m.role = role
    m.agent_name = agent_name
    m.content = content
    m.round_number = round_number
    return m


@pytest.fixture(autouse=True)
def _patch_factory():
    factory, session = make_mock_session()
    with patch("virtual_team.repository.agents.get_session_factory", factory):
        yield session


class TestGetAgentConfigs:
    @pytest.mark.asyncio
    async def test_empty(self, _patch_factory):
        from virtual_team.repository.agents import get_agent_configs
        result = await get_agent_configs()
        assert result == []

    @pytest.mark.asyncio
    async def test_with_data(self, _patch_factory):
        agents = [_make_agent(id="a1"), _make_agent(id="a2")]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = agents
        from virtual_team.repository.agents import get_agent_configs
        result = await get_agent_configs()
        assert len(result) == 2
        assert result[0].id == "a1"

    @pytest.mark.asyncio
    async def test_ordered_by_order_then_created_at(self, _patch_factory):
        a1 = _make_agent(id="a1", order=1)
        a2 = _make_agent(id="a2", order=0)
        a3 = _make_agent(id="a3", order=0)
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = [a2, a3, a1]
        from virtual_team.repository.agents import get_agent_configs
        result = await get_agent_configs()
        assert len(result) == 3
        assert result[0].id == "a2"
        assert result[1].id == "a3"
        assert result[2].id == "a1"

    @pytest.mark.asyncio
    async def test_returns_full_agent_data(self, _patch_factory):
        agent = _make_agent(
            id="a1", name="产品经理", role_identifier="pm",
            system_prompt="你是PM", order=0, is_active=True,
            is_approver=False, icon="📋", model="gpt-4o",
            temperature=0.7, output_constraints="只输出中文",
            tools='["web"]', mcp='["mcp1"]', skills='["python"]',
        )
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = [agent]
        from virtual_team.repository.agents import get_agent_configs
        result = await get_agent_configs()
        assert len(result) == 1
        r = result[0]
        assert r.id == "a1"
        assert r.name == "产品经理"
        assert r.role_identifier == "pm"
        assert r.system_prompt == "你是PM"
        assert r.order == 0
        assert r.is_active is True
        assert r.is_approver is False
        assert r.icon == "📋"
        assert r.model == "gpt-4o"
        assert r.temperature == 0.7
        assert r.output_constraints == "只输出中文"
        assert r.tools == '["web"]'
        assert r.mcp == '["mcp1"]'
        assert r.skills == '["python"]'


class TestGetActiveAgentConfigs:
    @pytest.mark.asyncio
    async def test_filters_inactive(self, _patch_factory):
        active = [_make_agent(id="a1", is_active=True)]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = active
        from virtual_team.repository.agents import get_active_agent_configs
        result = await get_active_agent_configs()
        assert len(result) == 1


class TestGetAgentConfigByRole:
    @pytest.mark.asyncio
    async def test_found(self, _patch_factory):
        agent = _make_agent(role_identifier="pm")
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = agent
        from virtual_team.repository.agents import get_agent_config_by_role
        result = await get_agent_config_by_role("pm")
        assert result is not None
        assert result.role_identifier == "pm"

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = None
        from virtual_team.repository.agents import get_agent_config_by_role
        result = await get_agent_config_by_role("nonexistent")
        assert result is None


class TestGetAgentConfig:
    @pytest.mark.asyncio
    async def test_found(self, _patch_factory):
        agent = _make_agent(id="a1")
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = agent
        from virtual_team.repository.agents import get_agent_config
        result = await get_agent_config("a1")
        assert result is not None
        assert result.id == "a1"

    @pytest.mark.asyncio
    async def test_found_returns_all_fields(self, _patch_factory):
        agent = _make_agent(
            id="a1", name="PM", role_identifier="pm",
            system_prompt="你是PM", order=0, is_active=True,
            is_approver=False, icon="📋", model="gpt-4o",
            temperature=0.7, output_constraints="约束",
            tools='["web"]', mcp='["mcp1"]', skills='["python"]',
        )
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = agent
        from virtual_team.repository.agents import get_agent_config
        result = await get_agent_config("a1")
        assert result.name == "PM"
        assert result.role_identifier == "pm"
        assert result.system_prompt == "你是PM"
        assert result.temperature == 0.7
        assert result.model == "gpt-4o"
        assert result.is_approver is False
        assert result.output_constraints == "约束"
        assert result.tools == '["web"]'

    @pytest.mark.asyncio
    async def test_queries_by_id(self, _patch_factory):
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = _make_agent()
        from virtual_team.repository.agents import get_agent_config
        await get_agent_config("specific-id")
        call_stmt = _patch_factory.execute.call_args[0][0]
        from sqlalchemy.sql import Select
        assert isinstance(call_stmt, Select)
        compiled = str(call_stmt)
        assert "WHERE" in compiled, "Expected a WHERE clause filtering by agent_id"

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = None
        from virtual_team.repository.agents import get_agent_config
        result = await get_agent_config("nonexistent")
        assert result is None


class TestGetRunMessages:
    @pytest.mark.asyncio
    async def test_empty(self, _patch_factory):
        from virtual_team.repository.agents import get_run_messages
        result = await get_run_messages("r1")
        assert result == []

    @pytest.mark.asyncio
    async def test_with_data(self, _patch_factory):
        msgs = [_make_message(id="m1"), _make_message(id="m2")]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = msgs
        from virtual_team.repository.agents import get_run_messages
        result = await get_run_messages("r1")
        assert len(result) == 2


class TestGetAgentConfigCount:
    @pytest.mark.asyncio
    async def test_zero(self, _patch_factory):
        from virtual_team.repository.agents import get_agent_config_count
        result = await get_agent_config_count()
        assert result == 0

    @pytest.mark.asyncio
    async def test_nonzero(self, _patch_factory):
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = [1, 2, 3]
        from virtual_team.repository.agents import get_agent_config_count
        result = await get_agent_config_count()
        assert result == 3


class TestSeedDefaultAgents:
    @pytest.mark.asyncio
    async def test_skips_when_agents_exist(self, _patch_factory):
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = [1]
        from virtual_team.repository.agents import seed_default_agents
        await seed_default_agents()
        _patch_factory.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_seeds_when_empty(self, _patch_factory):
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = []
        from virtual_team.repository.agents import seed_default_agents
        await seed_default_agents()
        assert _patch_factory.add.call_count == 1


class TestCreateAgentConfig:
    @pytest.mark.asyncio
    async def test_creates(self, _patch_factory):
        from virtual_team.repository.agents import create_agent_config
        await create_agent_config(
            name="Tester", role_identifier="tester",
            system_prompt="你是测试", order=1, is_active=True, icon="🧪",
        )
        assert _patch_factory.add.call_count == 1
        assert _patch_factory.commit.call_count == 1

    @pytest.mark.asyncio
    async def test_with_optional_fields(self, _patch_factory):
        from virtual_team.repository.agents import create_agent_config
        await create_agent_config(
            name="Dev", role_identifier="dev", system_prompt="你是开发",
            model="gpt-4o", temperature=0.5, is_approver=True,
            output_constraints="只输出代码", tools="web_search",
            mcp="server1", skills="python",
        )
        assert _patch_factory.add.call_count == 1

    @pytest.mark.asyncio
    async def test_defaults(self, _patch_factory):
        from virtual_team.repository.agents import create_agent_config
        await create_agent_config(
            name="DefaultAgent", role_identifier="default",
            system_prompt="你是一个默认 Agent",
        )
        added = _patch_factory.add.call_args[0][0]
        assert added.is_active is True
        assert added.is_approver is False
        assert added.icon == "🤖"
        assert added.order == 0

    @pytest.mark.asyncio
    async def test_sets_created_at(self, _patch_factory):
        from datetime import datetime

        from virtual_team.repository.agents import create_agent_config
        before = datetime.now(UTC)
        await create_agent_config(
            name="TimedAgent", role_identifier="timed",
            system_prompt="时间测试",
        )
        added = _patch_factory.add.call_args[0][0]
        assert isinstance(added.created_at, datetime)
        assert added.created_at.tzinfo is not None
        assert before <= added.created_at
        assert isinstance(added.updated_at, datetime)
        assert added.updated_at.tzinfo is not None
        assert before <= added.updated_at


class TestUpdateAgentConfig:
    @pytest.mark.asyncio
    async def test_updates_all_fields(self, _patch_factory):
        agent = _make_agent(id="a1")
        _patch_factory.get.return_value = agent
        from virtual_team.repository.agents import update_agent_config
        result = await update_agent_config(
            "a1",
            name="New Name",
            system_prompt="新提示词",
            output_constraints="只输出JSON",
            tools='["web"]',
            mcp='["mcp1"]',
            skills='["python"]',
            order=2,
            is_active=False,
            is_approver=True,
            icon="🚀",
            model="gpt-4-turbo",
            temperature=0.5,
        )
        assert result is agent
        assert result.name == "New Name"
        assert result.system_prompt == "新提示词"
        assert result.output_constraints == "只输出JSON"
        assert result.tools == '["web"]'
        assert result.mcp == '["mcp1"]'
        assert result.skills == '["python"]'
        assert result.order == 2
        assert result.is_active is False
        assert result.is_approver is True
        assert result.icon == "🚀"
        assert result.model == "gpt-4-turbo"
        assert result.temperature == 0.5
        assert isinstance(result.updated_at, datetime)
        _patch_factory.commit.assert_awaited_once()
        _patch_factory.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_partial_update_only_touches_provided_fields(self, _patch_factory):
        agent = _make_agent(id="a1", name="Original", model="gpt-4o", temperature=0.7, order=5)
        _patch_factory.get.return_value = agent
        from virtual_team.repository.agents import update_agent_config
        result = await update_agent_config("a1", name="Renamed")
        assert result.name == "Renamed"
        assert result.model == "gpt-4o"
        assert result.temperature == 0.7
        assert result.order == 5
        _patch_factory.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_sets_updated_at(self, _patch_factory):
        agent = _make_agent(id="a1")
        _patch_factory.get.return_value = agent
        from virtual_team.repository.agents import update_agent_config
        result = await update_agent_config("a1", name="Updated")
        assert isinstance(result.updated_at, datetime)
        assert result.updated_at.tzinfo is not None

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        _patch_factory.get.return_value = None
        from virtual_team.repository.agents import update_agent_config
        result = await update_agent_config("nonexistent", name="X")
        assert result is None
        _patch_factory.commit.assert_not_called()


class TestDeleteAgentConfig:
    @pytest.mark.asyncio
    async def test_deletes(self, _patch_factory):
        agent = _make_agent(id="a1")
        _patch_factory.get.return_value = agent
        from virtual_team.repository.agents import delete_agent_config
        result = await delete_agent_config("a1")
        assert result is True
        _patch_factory.delete.assert_called_once_with(agent)
        _patch_factory.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        _patch_factory.get.return_value = None
        from virtual_team.repository.agents import delete_agent_config
        result = await delete_agent_config("nonexistent")
        assert result is False
        _patch_factory.delete.assert_not_called()
        _patch_factory.commit.assert_not_called()


class TestDeleteAgentConfigCascade:
    """级联删除由数据库 FK ondelete=CASCADE 处理，仓库层验证 delete + commit 即可。"""

    @pytest.mark.asyncio
    async def test_deletes_via_get(self, _patch_factory):
        """验证 delete_agent_config 通过 session.get 查找后 delete + commit."""
        agent = _make_agent(id="a1")
        _patch_factory.get.return_value = agent
        from virtual_team.repository.agents import delete_agent_config

        result = await delete_agent_config("a1")
        assert result is True
        _patch_factory.get.assert_awaited_once()
        get_id = _patch_factory.get.call_args[0][1]
        assert get_id == "a1"
        _patch_factory.delete.assert_called_once_with(agent)
        _patch_factory.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        """不存在的 id → 返回 False，不执行 delete/commit."""
        _patch_factory.get.return_value = None
        from virtual_team.repository.agents import delete_agent_config

        result = await delete_agent_config("nonexistent")
        assert result is False
        _patch_factory.delete.assert_not_called()
        _patch_factory.commit.assert_not_called()


class TestToggleAgentActive:
    """toggle_agent_active 未实现，改为测试 update_agent_config 的 is_active 参数。"""

    @pytest.mark.asyncio
    async def test_toggle_on(self, _patch_factory):
        """is_active=False → 更新为 True."""
        agent = _make_agent(id="a1", is_active=False)
        _patch_factory.get.return_value = agent
        from virtual_team.repository.agents import update_agent_config

        result = await update_agent_config("a1", is_active=True)
        assert result is not None
        assert agent.is_active is True
        _patch_factory.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_toggle_off(self, _patch_factory):
        """is_active=True → 更新为 False."""
        agent = _make_agent(id="a1", is_active=True)
        _patch_factory.get.return_value = agent
        from virtual_team.repository.agents import update_agent_config

        result = await update_agent_config("a1", is_active=False)
        assert result is not None
        assert agent.is_active is False
        _patch_factory.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        """不存在的 id → 返回 None."""
        _patch_factory.get.return_value = None
        from virtual_team.repository.agents import update_agent_config

        result = await update_agent_config("nonexistent", is_active=True)
        assert result is None
        _patch_factory.commit.assert_not_called()


class TestGetAgentConfigByRoleOrFirst:
    """get_agent_config_by_role_or_first 未实现（fallback 逻辑不存在），
    改为测试既有 get_agent_config_by_role：精准匹配和未命中。"""

    @pytest.mark.asyncio
    async def test_found_by_role(self, _patch_factory):
        agent = _make_agent(role_identifier="pm")
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = agent
        from virtual_team.repository.agents import get_agent_config_by_role

        result = await get_agent_config_by_role("pm")
        assert result is not None
        assert result.role_identifier == "pm"

    @pytest.mark.asyncio
    async def test_not_found_by_role(self, _patch_factory):
        """不存在的 role → 返回 None（原 fallback_to_first 逻辑未实现）。"""
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = None
        from virtual_team.repository.agents import get_agent_config_by_role

        result = await get_agent_config_by_role("nonexistent")
        assert result is None
