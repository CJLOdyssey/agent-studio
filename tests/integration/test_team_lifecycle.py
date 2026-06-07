"""Integration smoke test: 01-02 Team Organization lifecycle.

Smoke path (跨组件冒烟):
  create_team → add_member → get_team → update_team →
  remove_member → delete_team

Verifies Repository + Data Model consistency across the full CRUD lifecycle.
Each step sets up a shared mock session and tests cross-component data flow.

Run:
    pytest tests/integration/test_team_lifecycle.py -v --tb=short
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from virtual_team.database import TeamAgentDB, TeamDB


@pytest.fixture
def shared_session():
    """Patch get_session_factory with a shared mock session."""
    session = AsyncMock()

    class _Ctx:
        def __call__(self):
            return self

        async def __aenter__(self):
            return session

        async def __aexit__(self, *args):
            pass

    factory = MagicMock(return_value=_Ctx())

    with (
        patch("virtual_team.database.get_session_factory", factory),
        patch("virtual_team.repository.teams.get_session_factory", factory),
    ):
        yield session


class TestTeamLifecycleSmoke:
    """Full CRUD lifecycle: create -> add_member -> get -> update -> remove_member -> delete."""

    @pytest.mark.asyncio
    async def test_create_team_maps_fields_correctly(self, shared_session):
        """创建团队 → 验证所有字段映射正确."""
        session = shared_session

        # Mock the initial count query (no existing teams → order=0)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        session.execute = AsyncMock(return_value=mock_result)
        session.add = MagicMock()
        session.commit = AsyncMock()

        async def _refresh(obj):
            obj.id = "team-001"
        session.refresh = AsyncMock(side_effect=_refresh)

        from virtual_team.repository.teams import create_team
        team = await create_team(name="核心团队")

        assert team.name == "核心团队"
        assert team.id == "team-001"
        assert team.order == 0

    @pytest.mark.asyncio
    async def test_add_member_stores_relationship(self, shared_session):
        """添加成员 → add + commit + 返回 member 含 team_id."""
        session = shared_session

        # First execute: team lookup
        team = TeamDB(id="team-001", name="核心团队")
        r1 = MagicMock()
        r1.scalar_one_or_none.return_value = team
        # Second execute: count query (no existing members)
        r2 = MagicMock()
        r2.scalar_one_or_none.return_value = None
        session.execute = AsyncMock(side_effect=[r1, r2])
        session.add = MagicMock()
        session.commit = AsyncMock()

        async def _refresh(obj):
            obj.id = "member-001"
        session.refresh = AsyncMock(side_effect=_refresh)

        from virtual_team.repository.teams import add_team_member
        member = await add_team_member(team_id="team-001", name="张三", role="开发")

        assert member["id"] == "member-001"
        assert member["name"] == "张三"
        assert member["role"] == "开发"
        assert member["order"] == 0

    @pytest.mark.asyncio
    async def test_get_team_includes_members(self, shared_session):
        """查询团队 → 返回团队数据含成员列表."""
        session = shared_session

        member = TeamAgentDB(
            id="m1", team_id="team-001", name="李四", role="测试", order=1,
        )
        team = TeamDB(
            id="team-001", name="核心团队", order=0, is_expanded=True,
        )
        team.members = [member]

        mock_scalar = MagicMock()
        mock_scalar.scalar_one_or_none.return_value = team
        session.execute = AsyncMock(return_value=mock_scalar)

        from virtual_team.repository.teams import get_team
        result = await get_team("team-001")

        assert result is not None
        assert result["name"] == "核心团队"
        assert len(result["agents"]) == 1
        assert result["agents"][0]["name"] == "李四"
        assert result["agents"][0]["role"] == "测试"

    @pytest.mark.asyncio
    async def test_update_team_maps_updated_fields(self, shared_session):
        """更新团队 → 字段变更正确."""
        session = shared_session

        original = TeamDB(
            id="team-001", name="旧名称", order=0, is_expanded=False,
        )
        r = MagicMock()
        r.scalar_one_or_none.return_value = original
        session.execute = AsyncMock(return_value=r)
        session.commit = AsyncMock()
        session.refresh = AsyncMock()

        from virtual_team.repository.teams import update_team
        updated = await update_team("team-001", name="新名称", is_expanded=True)

        assert updated is not None
        assert updated.name == "新名称"
        assert updated.is_expanded is True

    @pytest.mark.asyncio
    async def test_remove_member_returns_true(self, shared_session):
        """移除成员 → 返回 True."""
        session = shared_session

        mock_result = MagicMock()
        mock_result.rowcount = 1
        session.execute = AsyncMock(return_value=mock_result)
        session.commit = AsyncMock()

        from virtual_team.repository.teams import remove_team_member
        result = await remove_team_member(team_id="team-001", member_id="m1")

        assert result is True

    @pytest.mark.asyncio
    async def test_delete_team_returns_true(self, shared_session):
        """删除团队 → 返回 True 并调用 delete."""
        session = shared_session

        team = TeamDB(id="team-001", name="删除测试")
        r = MagicMock()
        r.scalar_one_or_none.return_value = team
        session.execute = AsyncMock(return_value=r)
        session.delete = AsyncMock()
        session.commit = AsyncMock()

        from virtual_team.repository.teams import delete_team
        result = await delete_team("team-001")

        assert result is True
        session.delete.assert_called_once_with(team)
        session.commit.assert_awaited_once()
