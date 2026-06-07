"""Supplementary repository unit tests for conversation CRUD edge cases.

NOTE: Primary test coverage lives in test_01_core.py.
This file covers gaps: get_run_messages, get_session_messages, and edge cases
not exercised by the primary test suite.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _mock_factory(rows=None, scalar_one=None):
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_scalar = MagicMock()
    mock_scalar.all.return_value = rows or []
    mock_result.scalars.return_value = mock_scalar
    mock_result.scalar_one_or_none.return_value = scalar_one
    mock_result.rowcount = len(rows) if rows else 0
    mock_session.execute.return_value = mock_result
    mock_session.get.return_value = None
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.delete = AsyncMock()
    mock_session.flush = AsyncMock()

    class _Ctx:
        def __call__(self):
            return self
        async def __aenter__(self):
            return mock_session
        async def __aexit__(self, *args):
            pass

    return MagicMock(return_value=_Ctx()), mock_session


def _make_session(id="s1", user_id="default", title="新对话"):
    m = MagicMock()
    m.id = id
    m.user_id = user_id
    m.title = title
    m.created_at = None
    m.updated_at = None
    return m


def _make_run(id="r1", user_id="default", session_id="s1", requirement="需求",
              status="pending", pm_document="", code="", review="", approved=False):
    m = MagicMock()
    m.id = id
    m.user_id = user_id
    m.session_id = session_id
    m.requirement = requirement
    m.status = status
    m.pm_document = pm_document
    m.code = code
    m.review = review
    m.approved = approved
    return m


def _make_message(id="msg1", run_id="r1", role="pm", agent_name="PM",
                  content="hello", round_number=1):
    m = MagicMock()
    m.id = id
    m.run_id = run_id
    m.role = role
    m.agent_name = agent_name
    m.content = content
    m.round_number = round_number
    return m


def _make_memory(id="m1", user_id="default", session_id="s1", run_id="r1",
                 agent_role="pm", content_type="decision", summary="summary"):
    m = MagicMock()
    m.id = id
    m.user_id = user_id
    m.session_id = session_id
    m.run_id = run_id
    m.agent_role = agent_role
    m.content_type = content_type
    m.summary = summary
    return m


@pytest.fixture(autouse=True)
def _patch_factory():
    factory, session = _mock_factory()
    with patch("virtual_team.repository.core.get_session_factory", factory):
        yield session


class TestGetRunMessages:
    """get_run_messages is an alias for get_messages — same body, different name."""

    @pytest.mark.asyncio
    async def test_empty(self, _patch_factory):
        from virtual_team.repository.core import get_run_messages
        result = await get_run_messages("r1")
        assert result == []

    @pytest.mark.asyncio
    async def test_with_data(self, _patch_factory):
        msgs = [_make_message(id="msg1"), _make_message(id="msg2")]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = msgs
        from virtual_team.repository.core import get_run_messages
        result = await get_run_messages("r1")
        assert len(result) == 2
        assert result[0].id == "msg1"
        assert result[1].id == "msg2"

    @pytest.mark.asyncio
    async def test_orders_by_created_at(self, _patch_factory):
        msgs = [_make_message(id="msg2", run_id="r1"), _make_message(id="msg1", run_id="r1")]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = msgs
        from virtual_team.repository.core import get_run_messages
        result = await get_run_messages("r1")
        assert result[0].id == "msg2"
        assert result[1].id == "msg1"


class TestGetSessionMessages:
    """get_session_messages queries messages across all runs in a session."""

    @pytest.mark.asyncio
    async def test_empty_when_no_runs(self, _patch_factory):
        mock_result = _patch_factory.execute.return_value
        mock_result.all.return_value = []
        from virtual_team.repository.core import get_session_messages
        result = await get_session_messages("s1")
        assert result == []

    @pytest.mark.asyncio
    async def test_with_messages_from_single_run(self, _patch_factory):
        mock_result = _patch_factory.execute.return_value
        mock_result.all.return_value = [("r1",)]
        msgs = [_make_message(id="msg1"), _make_message(id="msg2")]
        mock_result.scalars.return_value.all.return_value = msgs
        from virtual_team.repository.core import get_session_messages
        result = await get_session_messages("s1")
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_with_messages_from_multiple_runs(self, _patch_factory):
        mock_result = _patch_factory.execute.return_value
        mock_result.all.return_value = [("r1",), ("r2",)]
        msgs = [
            _make_message(id="msg1", run_id="r1"),
            _make_message(id="msg2", run_id="r2"),
        ]
        mock_result.scalars.return_value.all.return_value = msgs
        from virtual_team.repository.core import get_session_messages
        result = await get_session_messages("s1")
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_exclude_run_id(self, _patch_factory):
        mock_result = _patch_factory.execute.return_value
        mock_result.all.return_value = [("r2",)]
        msgs = [_make_message(id="msg2", run_id="r2")]
        mock_result.scalars.return_value.all.return_value = msgs
        from virtual_team.repository.core import get_session_messages
        result = await get_session_messages("s1", exclude_run_id="r1")
        assert len(result) == 1
        assert result[0].run_id == "r2"

    @pytest.mark.asyncio
    async def test_with_user_id(self, _patch_factory):
        mock_result = _patch_factory.execute.return_value
        mock_result.all.return_value = [("r1",)]
        msgs = [_make_message(id="msg1")]
        mock_result.scalars.return_value.all.return_value = msgs
        from virtual_team.repository.core import get_session_messages
        result = await get_session_messages("s1", user_id="u1")
        assert len(result) == 1


class TestCreateSessionEdgeCases:
    """Additional edge cases for create_session beyond test_01_core."""

    @pytest.mark.asyncio
    async def test_default_user_id(self, _patch_factory):
        from virtual_team.repository.core import create_session
        await create_session(title="新对话")
        added = _patch_factory.add.call_args[0][0]
        assert added.user_id == "default"

    @pytest.mark.asyncio
    async def test_generates_uuid_id(self, _patch_factory):
        from virtual_team.repository.core import create_session
        await create_session()
        added = _patch_factory.add.call_args[0][0]
        assert added.id is not None
        assert isinstance(added.id, str)
        assert len(added.id) > 0

    @pytest.mark.asyncio
    async def test_title_passthrough(self, _patch_factory):
        from virtual_team.repository.core import create_session
        await create_session(title="自定义标题", user_id="u1")
        added = _patch_factory.add.call_args[0][0]
        assert added.title == "自定义标题"
        assert added.user_id == "u1"


class TestDeleteSessionEdgeCases:
    """Edge cases for delete_session beyond test_01_core."""

    @pytest.mark.asyncio
    async def test_delete_with_user_id_found(self, _patch_factory):
        session = _make_session(user_id="u1")
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = session
        from virtual_team.repository.core import delete_session
        result = await delete_session("s1", user_id="u1")
        assert result is True
        _patch_factory.delete.assert_called_once_with(session)

    @pytest.mark.asyncio
    async def test_delete_with_user_id_not_found(self, _patch_factory):
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = None
        from virtual_team.repository.core import delete_session
        result = await delete_session("s1", user_id="other_user")
        assert result is False
        _patch_factory.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_with_user_id_wrong_user(self, _patch_factory):
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = None
        from virtual_team.repository.core import delete_session
        result = await delete_session("s1", user_id="wrong_user")
        assert result is False
        _patch_factory.delete.assert_not_called()


class TestDeleteMemoryEdgeCases:
    """Edge cases for delete_memory_entry beyond test_01_core."""

    @pytest.mark.asyncio
    async def test_delete_with_user_id_found(self, _patch_factory):
        memory = _make_memory(user_id="u1")
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = memory
        from virtual_team.repository.core import delete_memory_entry
        result = await delete_memory_entry("m1", user_id="u1")
        assert result is True
        _patch_factory.delete.assert_called_once_with(memory)

    @pytest.mark.asyncio
    async def test_delete_with_user_id_not_found(self, _patch_factory):
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = None
        from virtual_team.repository.core import delete_memory_entry
        result = await delete_memory_entry("nonexistent", user_id="u1")
        assert result is False
        _patch_factory.delete.assert_not_called()


class TestGetSessionEdgeCases:
    """Edge cases for get_session beyond test_01_core."""

    @pytest.mark.asyncio
    async def test_wrong_user_id_returns_none(self, _patch_factory):
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = None
        from virtual_team.repository.core import get_session
        result = await get_session("s1", user_id="wrong_user")
        assert result is None

    @pytest.mark.asyncio
    async def test_session_with_different_user_not_found(self, _patch_factory):
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = None
        from virtual_team.repository.core import get_session
        result = await get_session("s1", user_id="u2")
        assert result is None


class TestGetSessionsEdgeCases:
    """Edge cases for get_sessions beyond test_01_core."""

    @pytest.mark.asyncio
    async def test_limit_zero(self, _patch_factory):
        from virtual_team.repository.core import get_sessions
        result = await get_sessions(limit=0)
        assert result == []

    @pytest.mark.asyncio
    async def test_custom_user_id_empty(self, _patch_factory):
        from virtual_team.repository.core import get_sessions
        result = await get_sessions(user_id="other")
        assert result == []


class TestCreateRunEdgeCases:
    """Edge cases for create_run beyond test_01_core."""

    @pytest.mark.asyncio
    async def test_default_user_id(self, _patch_factory):
        from virtual_team.repository.core import create_run
        await create_run("需求")
        added = _patch_factory.add.call_args[0][0]
        assert added.user_id == "default"

    @pytest.mark.asyncio
    async def test_default_status(self, _patch_factory):
        from virtual_team.repository.core import create_run
        await create_run("需求")
        added = _patch_factory.add.call_args[0][0]
        assert added.status == "pending"

    @pytest.mark.asyncio
    async def test_session_updated_at_touched(self, _patch_factory):
        session = _make_session()
        _patch_factory.get.return_value = session
        from virtual_team.repository.core import create_run
        await create_run("需求", session_id="s1", user_id="u1")
        assert _patch_factory.get.called
        assert _patch_factory.commit.await_count >= 2


class TestGetRunsEdgeCases:
    """Edge cases for get_runs beyond test_01_core."""

    @pytest.mark.asyncio
    async def test_limit_zero(self, _patch_factory):
        from virtual_team.repository.core import get_runs
        result = await get_runs(limit=0)
        assert result == []

    @pytest.mark.asyncio
    async def test_custom_user_id_empty(self, _patch_factory):
        from virtual_team.repository.core import get_runs
        result = await get_runs(user_id="other")
        assert result == []


class TestClearSessionMemoriesEdgeCases:
    """Edge cases for clear_session_memories beyond test_01_core."""

    @pytest.mark.asyncio
    async def test_with_user_id_no_matches(self, _patch_factory):
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = []
        from virtual_team.repository.core import clear_session_memories
        await clear_session_memories("s1", "nonexistent")
        _patch_factory.delete.assert_not_called()
        _patch_factory.commit.assert_awaited_once()
