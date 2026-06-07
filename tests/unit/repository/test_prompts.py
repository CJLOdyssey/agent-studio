"""Repository 层测试：virtual_team.repository.prompts"""
from unittest.mock import MagicMock, patch

import pytest

from tests.unit.repository.conftest import make_mock_session


def _make_prompt(id="p1", agent_id="agent-1", version=1, content="test",
                 change_reason=None, is_active=False):
    m = MagicMock()
    m.id = id
    m.agent_id = agent_id
    m.version = version
    m.content = content
    m.change_reason = change_reason
    m.is_active = is_active
    return m


@pytest.fixture(autouse=True)
def _patch_factory():
    factory, session = make_mock_session()
    with patch("virtual_team.repository.prompts.get_session_factory", factory):
        yield session


class TestCreatePrompt:
    @pytest.mark.asyncio
    async def test_creates_first_version_auto_active(self, _patch_factory):
        """第一个版本 version=1 且 is_active=True."""
        from virtual_team.repository.prompts import create_prompt
        result = await create_prompt("agent-1", "你是一个PM", "初始版本")
        assert result.agent_id == "agent-1"
        assert result.content == "你是一个PM"
        assert result.change_reason == "初始版本"
        assert result.version == 1
        assert result.is_active is True
        _patch_factory.add.assert_called_once()
        _patch_factory.commit.assert_awaited_once()
        _patch_factory.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_increments_version(self, _patch_factory):
        """已有版本 5 时创建 version=6."""
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = 5
        from virtual_team.repository.prompts import create_prompt
        result = await create_prompt("agent-1", "v2")
        assert result.version == 6
        assert result.is_active is False

    @pytest.mark.asyncio
    async def test_version_counts_per_agent(self, _patch_factory):
        """不同 agent 的版本号独立递增."""
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = None
        from virtual_team.repository.prompts import create_prompt
        r1 = await create_prompt("agent-1", "a1")
        assert r1.version == 1

        _patch_factory.execute.return_value.scalar_one_or_none.return_value = 3
        r2 = await create_prompt("agent-2", "a2")
        assert r2.version == 4


class TestGetPrompts:
    @pytest.mark.asyncio
    async def test_empty(self, _patch_factory):
        """无提示词返回空列表."""
        from virtual_team.repository.prompts import get_prompts
        result = await get_prompts("agent-1")
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_all(self, _patch_factory):
        """返回指定 agent 的全部提示词."""
        prompts = [_make_prompt(agent_id="agent-1", version=1)]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = prompts
        from virtual_team.repository.prompts import get_prompts
        result = await get_prompts("agent-1")
        assert len(result) == 1
        assert result[0].version == 1

    @pytest.mark.asyncio
    async def test_filters_by_agent(self, _patch_factory):
        """只返回指定 agent 的提示词."""
        p1 = _make_prompt(id="p1", agent_id="agent-1")
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = [p1]
        from virtual_team.repository.prompts import get_prompts
        await get_prompts("other-agent")
        _patch_factory.execute.assert_awaited_once()


class TestActivatePrompt:
    @pytest.mark.asyncio
    async def test_activates_target_deactivates_others(self, _patch_factory):
        """激活目标版本，其他版本去激活."""
        prompt = _make_prompt(id="p1", agent_id="agent-1", is_active=False)
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = prompt
        from virtual_team.repository.prompts import activate_prompt
        result = await activate_prompt("agent-1", "p1")
        assert result is prompt
        assert result.is_active is True
        _patch_factory.commit.assert_awaited_once()
        _patch_factory.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        """不存在的 prompt_id 返回 None."""
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = None
        from virtual_team.repository.prompts import activate_prompt
        result = await activate_prompt("agent-1", "nonexistent")
        assert result is None
