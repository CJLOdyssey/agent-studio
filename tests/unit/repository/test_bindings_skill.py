"""Repository 层测试：virtual_team.repository.bindings — Skill Bindings (01-01-10).

Covers:
  - bind_skill       — 绑定技能
  - unbind_skill     — 解绑技能（成功/不存在）
  - get_agent_skills — 查询 Agent 技能列表（空/有数据）

Run:
    pytest tests/unit/repository/test_bindings_skill.py -v --tb=short
"""
from unittest.mock import MagicMock, patch

import pytest

from tests.unit.repository.conftest import make_mock_session


def _make_skill_binding(id="bs1", agent_id="a1", skill_id="s1"):
    m = MagicMock()
    m.id = id
    m.agent_id = agent_id
    m.skill_id = skill_id
    return m


@pytest.fixture(autouse=True)
def _patch_factory():
    factory, session = make_mock_session()
    with patch("virtual_team.repository.bindings.get_session_factory", factory):
        yield session


class TestBindSkill:
    @pytest.mark.asyncio
    async def test_binds_skill(self, _patch_factory):
        """绑定技能 → add + commit + refresh + 返回 binding."""
        from virtual_team.repository.bindings import bind_skill

        await bind_skill(agent_id="a1", skill_id="s1")

        _patch_factory.add.assert_called_once()
        added = _patch_factory.add.call_args[0][0]
        assert added.agent_id == "a1"
        assert added.skill_id == "s1"
        _patch_factory.commit.assert_awaited_once()
        _patch_factory.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_binding(self, _patch_factory):
        """bind_skill → 返回 binding 对象，含 agent_id 和 skill_id."""
        from virtual_team.repository.bindings import bind_skill

        result = await bind_skill(agent_id="a2", skill_id="s2")
        assert result is not None
        assert result.agent_id == "a2"
        assert result.skill_id == "s2"


class TestUnbindSkill:
    @pytest.mark.asyncio
    async def test_unbinds_existing(self, _patch_factory):
        """解绑已存在的技能 → 返回 True + commit."""
        _patch_factory.execute.return_value.rowcount = 1

        from virtual_team.repository.bindings import unbind_skill
        result = await unbind_skill(agent_id="a1", skill_id="s1")

        assert result is True
        _patch_factory.execute.assert_awaited_once()
        _patch_factory.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_unbind_not_found(self, _patch_factory):
        """解绑不存在的技能 → 返回 False."""
        _patch_factory.execute.return_value.rowcount = 0

        from virtual_team.repository.bindings import unbind_skill
        result = await unbind_skill(agent_id="a1", skill_id="nonexistent")

        assert result is False
        _patch_factory.execute.assert_awaited_once()
        _patch_factory.commit.assert_awaited_once()


class TestGetAgentSkills:
    @pytest.mark.asyncio
    async def test_empty(self, _patch_factory):
        """Agent 无技能 → 返回空列表."""
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = []
        from virtual_team.repository.bindings import get_agent_skills

        result = await get_agent_skills("a1")
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_skills(self, _patch_factory):
        """Agent 有技能 → 返回列表."""
        bindings = [
            _make_skill_binding(id="bs1", skill_id="s1"),
            _make_skill_binding(id="bs2", skill_id="s2"),
        ]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = bindings

        from virtual_team.repository.bindings import get_agent_skills
        result = await get_agent_skills("a1")

        assert len(result) == 2
        assert result[0].skill_id == "s1"
        assert result[1].skill_id == "s2"
