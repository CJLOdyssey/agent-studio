"""Repository 层测试：virtual_team.repository.bindings — MCP Bindings (01-01-09).

Covers:
  - bind_mcp        — 绑定 MCP（含 tool_filter）
  - unbind_mcp      — 解绑 MCP（成功/不存在）
  - get_agent_mcp   — 查询 Agent MCP 列表（空/有数据）

Run:
    pytest tests/unit/repository/test_bindings_mcp.py -v --tb=short
"""
from unittest.mock import MagicMock, patch

import pytest

from tests.unit.repository.conftest import make_mock_session


def _make_mcp_binding(id="bm1", agent_id="a1", mcp_id="m1", tool_filter=None):
    m = MagicMock()
    m.id = id
    m.agent_id = agent_id
    m.mcp_id = mcp_id
    m.tool_filter = tool_filter
    return m


@pytest.fixture(autouse=True)
def _patch_factory():
    factory, session = make_mock_session()
    with patch("virtual_team.repository.bindings.get_session_factory", factory):
        yield session


class TestBindMcp:
    @pytest.mark.asyncio
    async def test_binds_mcp(self, _patch_factory):
        """绑定 MCP → add + commit + refresh + 返回 binding."""
        from virtual_team.repository.bindings import bind_mcp

        await bind_mcp(agent_id="a1", mcp_id="m1")

        _patch_factory.add.assert_called_once()
        added = _patch_factory.add.call_args[0][0]
        assert added.agent_id == "a1"
        assert added.mcp_id == "m1"
        assert added.tool_filter is None
        _patch_factory.commit.assert_awaited_once()
        _patch_factory.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_binds_with_tool_filter(self, _patch_factory):
        """绑定 MCP + tool_filter → 字段正确传递."""
        from virtual_team.repository.bindings import bind_mcp

        await bind_mcp(agent_id="a1", mcp_id="m1", tool_filter="web,file")

        added = _patch_factory.add.call_args[0][0]
        assert added.tool_filter == "web,file"

    @pytest.mark.asyncio
    async def test_returns_binding(self, _patch_factory):
        """bind_mcp → 返回 binding 对象，含 agent_id 和 mcp_id."""
        from virtual_team.repository.bindings import bind_mcp

        result = await bind_mcp(agent_id="a2", mcp_id="m2", tool_filter="db")
        assert result is not None
        assert result.agent_id == "a2"
        assert result.mcp_id == "m2"


class TestUnbindMcp:
    @pytest.mark.asyncio
    async def test_unbinds_existing(self, _patch_factory):
        """解绑已存在的 MCP → 返回 True + commit."""
        _patch_factory.execute.return_value.rowcount = 1

        from virtual_team.repository.bindings import unbind_mcp
        result = await unbind_mcp(agent_id="a1", mcp_id="m1")

        assert result is True
        _patch_factory.execute.assert_awaited_once()
        _patch_factory.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_unbind_not_found(self, _patch_factory):
        """解绑不存在的 MCP → 返回 False."""
        _patch_factory.execute.return_value.rowcount = 0

        from virtual_team.repository.bindings import unbind_mcp
        result = await unbind_mcp(agent_id="a1", mcp_id="nonexistent")

        assert result is False
        _patch_factory.execute.assert_awaited_once()
        _patch_factory.commit.assert_awaited_once()


class TestGetAgentMcp:
    @pytest.mark.asyncio
    async def test_empty(self, _patch_factory):
        """Agent 无 MCP → 返回空列表."""
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = []
        from virtual_team.repository.bindings import get_agent_mcp

        result = await get_agent_mcp("a1")
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_mcp(self, _patch_factory):
        """Agent 有 MCP → 返回列表."""
        bindings = [
            _make_mcp_binding(id="bm1", mcp_id="m1"),
            _make_mcp_binding(id="bm2", mcp_id="m2", tool_filter="web"),
        ]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = bindings

        from virtual_team.repository.bindings import get_agent_mcp
        result = await get_agent_mcp("a1")

        assert len(result) == 2
        assert result[0].mcp_id == "m1"
        assert result[1].tool_filter == "web"
