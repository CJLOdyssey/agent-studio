"""Repository 层测试：virtual_team.repository.bindings — Tool Bindings (01-01-08).

Covers:
  - bind_tool      — 绑定工具（含 config_override）
  - unbind_tool    — 解绑工具（成功/不存在）
  - get_agent_tools — 查询 Agent 工具列表（空/有数据）

Run:
    pytest tests/unit/repository/test_bindings.py -v --tb=short
"""
from unittest.mock import MagicMock, patch

import pytest

from tests.unit.repository.conftest import make_mock_session


def _make_tool_binding(id="b1", agent_id="a1", tool_id="t1", config_override=None):
    m = MagicMock()
    m.id = id
    m.agent_id = agent_id
    m.tool_id = tool_id
    m.config_override = config_override
    return m


@pytest.fixture(autouse=True)
def _patch_factory():
    factory, session = make_mock_session()
    with patch("virtual_team.repository.bindings.get_session_factory", factory):
        yield session


# ── bind_tool ──────────────────────────────────────────────────────────────────

class TestBindTool:
    @pytest.mark.asyncio
    async def test_binds_tool(self, _patch_factory):
        """绑定工具 → add + commit + refresh + 返回 binding."""
        from virtual_team.repository.bindings import bind_tool

        await bind_tool(agent_id="a1", tool_id="t1")

        _patch_factory.add.assert_called_once()
        added = _patch_factory.add.call_args[0][0]
        assert added.agent_id == "a1"
        assert added.tool_id == "t1"
        assert added.config_override is None
        assert added.id is not None
        _patch_factory.commit.assert_awaited_once()
        _patch_factory.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_binds_with_config_override(self, _patch_factory):
        """绑定工具 + config_override → 字段正确传递."""
        from virtual_team.repository.bindings import bind_tool

        await bind_tool(agent_id="a1", tool_id="t1", config_override='{"key": "val"}')

        added = _patch_factory.add.call_args[0][0]
        assert added.config_override == '{"key": "val"}'

    @pytest.mark.asyncio
    async def test_returns_binding(self, _patch_factory):
        """bind_tool → 返回 binding 对象，含 agent_id 和 tool_id."""
        from virtual_team.repository.bindings import bind_tool

        result = await bind_tool(agent_id="a2", tool_id="t2", config_override="{}")
        assert result is not None
        assert result.agent_id == "a2"
        assert result.tool_id == "t2"


# ── unbind_tool ────────────────────────────────────────────────────────────────

class TestUnbindTool:
    @pytest.mark.asyncio
    async def test_unbinds_existing(self, _patch_factory):
        """解绑已存在的绑定 → 返回 True + commit."""
        _patch_factory.execute.return_value.rowcount = 1

        from virtual_team.repository.bindings import unbind_tool
        result = await unbind_tool(agent_id="a1", tool_id="t1")

        assert result is True
        _patch_factory.execute.assert_awaited_once()
        _patch_factory.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_unbind_not_found(self, _patch_factory):
        """解绑不存在的绑定 → 返回 False."""
        _patch_factory.execute.return_value.rowcount = 0

        from virtual_team.repository.bindings import unbind_tool
        result = await unbind_tool(agent_id="a1", tool_id="nonexistent")

        assert result is False
        _patch_factory.execute.assert_awaited_once()
        _patch_factory.commit.assert_awaited_once()


# ── get_agent_tools ────────────────────────────────────────────────────────────

class TestGetAgentTools:
    @pytest.mark.asyncio
    async def test_empty(self, _patch_factory):
        """Agent 无工具 → 返回空列表."""
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = []
        from virtual_team.repository.bindings import get_agent_tools

        result = await get_agent_tools("a1")
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_tools(self, _patch_factory):
        """Agent 有工具 → 返回列表."""
        bindings = [
            _make_tool_binding(id="b1", tool_id="t1"),
            _make_tool_binding(id="b2", tool_id="t2", config_override="{}"),
        ]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = bindings

        from virtual_team.repository.bindings import get_agent_tools
        result = await get_agent_tools("a1")

        assert len(result) == 2
        assert result[0].tool_id == "t1"
        assert result[1].config_override == "{}"
