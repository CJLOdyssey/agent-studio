"""Repository unit tests for Module 01 — session/run/message/memory CRUD operations."""
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


@pytest.fixture(autouse=True)
def _patch_factory():
    factory, session = _mock_factory()
    with patch("virtual_team.repository.core.get_session_factory", factory):
        yield session


class TestCreateSession:
    @pytest.mark.asyncio
    async def test_creates_session(self, _patch_factory):
        from virtual_team.repository.core import create_session
        result = await create_session("测试对话", "u1")
        assert _patch_factory.add.called
        _patch_factory.commit.assert_awaited_once()
        _patch_factory.refresh.assert_awaited_once()
        assert result.title == _patch_factory.add.call_args[0][0].title

    @pytest.mark.asyncio
    async def test_defaults(self, _patch_factory):
        from virtual_team.repository.core import create_session
        result = await create_session()
        _patch_factory.commit.assert_awaited_once()
        assert result is not None


class TestGetSession:
    @pytest.mark.asyncio
    async def test_found(self, _patch_factory):
        session = _make_session()
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = session
        from virtual_team.repository.core import get_session
        result = await get_session("s1")
        assert result is not None
        assert result.id == "s1"

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = None
        from virtual_team.repository.core import get_session
        result = await get_session("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_with_user_id(self, _patch_factory):
        session = _make_session(id="s1", user_id="u1")
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = session
        from virtual_team.repository.core import get_session
        result = await get_session("s1", "u1")
        assert result is not None
        assert result.user_id == "u1"


class TestGetSessions:
    @pytest.mark.asyncio
    async def test_empty(self, _patch_factory):
        from virtual_team.repository.core import get_sessions
        result = await get_sessions()
        assert result == []

    @pytest.mark.asyncio
    async def test_with_data(self, _patch_factory):
        sessions = [_make_session(id="s1"), _make_session(id="s2")]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = sessions
        from virtual_team.repository.core import get_sessions
        result = await get_sessions(limit=10, user_id="u1")
        assert len(result) == 2
        assert result[0].id == "s1"
        assert result[1].id == "s2"

    @pytest.mark.asyncio
    async def test_default_limit(self, _patch_factory):
        from virtual_team.repository.core import get_sessions
        result = await get_sessions()
        assert result == []


class TestUpdateSessionTitle:
    @pytest.mark.asyncio
    async def test_updates_title(self, _patch_factory):
        session = _make_session(id="s1", title="旧标题")
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = session
        from virtual_team.repository.core import update_session_title
        result = await update_session_title("s1", "新标题")
        assert result is not None
        assert result.title == "新标题"
        _patch_factory.commit.assert_awaited_once()
        _patch_factory.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = None
        from virtual_team.repository.core import update_session_title
        result = await update_session_title("nonexistent", "新标题")
        assert result is None
        _patch_factory.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_with_user_id_filter(self, _patch_factory):
        session = _make_session(id="s1", user_id="u1")
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = session
        from virtual_team.repository.core import update_session_title
        result = await update_session_title("s1", "新标题", "u1")
        assert result is not None
        assert result.title == "新标题"


class TestDeleteSession:
    @pytest.mark.asyncio
    async def test_deletes(self, _patch_factory):
        session = _make_session()
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = session
        from virtual_team.repository.core import delete_session
        result = await delete_session("s1")
        assert result is True
        _patch_factory.delete.assert_called_once_with(session)
        _patch_factory.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = None
        from virtual_team.repository.core import delete_session
        result = await delete_session("nonexistent")
        assert result is False
        _patch_factory.delete.assert_not_called()


class TestGetSessionRuns:
    @pytest.mark.asyncio
    async def test_empty(self, _patch_factory):
        from virtual_team.repository.core import get_session_runs
        result = await get_session_runs("s1")
        assert result == []

    @pytest.mark.asyncio
    async def test_with_data(self, _patch_factory):
        runs = [_make_run(id="r1"), _make_run(id="r2")]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = runs
        from virtual_team.repository.core import get_session_runs
        result = await get_session_runs("s1")
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_with_user_id(self, _patch_factory):
        runs = [_make_run(id="r1", user_id="u1")]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = runs
        from virtual_team.repository.core import get_session_runs
        result = await get_session_runs("s1", "u1")
        assert len(result) == 1
        assert result[0].user_id == "u1"


class TestGetRunsBySessionIds:
    @pytest.mark.asyncio
    async def test_empty_ids(self, _patch_factory):
        from virtual_team.repository.core import get_runs_by_session_ids
        result = await get_runs_by_session_ids([])
        assert result == {}

    @pytest.mark.asyncio
    async def test_groups_by_session(self, _patch_factory):
        runs = [
            _make_run(id="r1", session_id="s1"),
            _make_run(id="r2", session_id="s1"),
            _make_run(id="r3", session_id="s2"),
        ]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = runs
        from virtual_team.repository.core import get_runs_by_session_ids
        result = await get_runs_by_session_ids(["s1", "s2"])
        assert len(result["s1"]) == 2
        assert len(result["s2"]) == 1

    @pytest.mark.asyncio
    async def test_empty_result(self, _patch_factory):
        from virtual_team.repository.core import get_runs_by_session_ids
        result = await get_runs_by_session_ids(["s1"])
        assert result == {}


class TestGetSessionMemories:
    @pytest.mark.asyncio
    async def test_empty(self, _patch_factory):
        from virtual_team.repository.core import get_session_memories
        result = await get_session_memories("s1")
        assert result == []

    @pytest.mark.asyncio
    async def test_with_data(self, _patch_factory):
        memories = [_make_memory(id="m1"), _make_memory(id="m2")]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = memories
        from virtual_team.repository.core import get_session_memories
        result = await get_session_memories("s1")
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_with_user_id(self, _patch_factory):
        memories = [_make_memory(id="m1", user_id="u1")]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = memories
        from virtual_team.repository.core import get_session_memories
        result = await get_session_memories("s1", "u1")
        assert len(result) == 1
        assert result[0].user_id == "u1"


class TestCreateMemoryEntry:
    @pytest.mark.asyncio
    async def test_creates(self, _patch_factory):
        from virtual_team.repository.core import create_memory_entry
        await create_memory_entry("s1", "r1", "pm", "decision", "摘要")
        assert _patch_factory.add.call_count == 1
        _patch_factory.commit.assert_awaited_once()
        _patch_factory.refresh.assert_awaited_once()
        added = _patch_factory.add.call_args[0][0]
        assert added.session_id == "s1"
        assert added.run_id == "r1"
        assert added.agent_role == "pm"
        assert added.content_type == "decision"
        assert added.summary == "摘要"

    @pytest.mark.asyncio
    async def test_with_details(self, _patch_factory):
        from virtual_team.repository.core import create_memory_entry
        await create_memory_entry("s1", "r1", "programmer", "code", "摘要", details="详细内容")
        added = _patch_factory.add.call_args[0][0]
        assert added.details == "详细内容"
        assert added.agent_role == "programmer"


class TestClearSessionMemories:
    @pytest.mark.asyncio
    async def test_clears_all(self, _patch_factory):
        memories = [_make_memory(id="m1"), _make_memory(id="m2")]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = memories
        from virtual_team.repository.core import clear_session_memories
        await clear_session_memories("s1")
        assert _patch_factory.delete.call_count == 2
        _patch_factory.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_empty(self, _patch_factory):
        from virtual_team.repository.core import clear_session_memories
        await clear_session_memories("s1")
        _patch_factory.delete.assert_not_called()
        _patch_factory.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_with_user_id(self, _patch_factory):
        memories = [_make_memory(id="m1", user_id="u1")]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = memories
        from virtual_team.repository.core import clear_session_memories
        await clear_session_memories("s1", "u1")
        assert _patch_factory.delete.call_count == 1


class TestDeleteMemoryEntry:
    @pytest.mark.asyncio
    async def test_deletes(self, _patch_factory):
        memory = _make_memory()
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = memory
        from virtual_team.repository.core import delete_memory_entry
        result = await delete_memory_entry("m1")
        assert result is True
        _patch_factory.delete.assert_called_once_with(memory)
        _patch_factory.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = None
        from virtual_team.repository.core import delete_memory_entry
        result = await delete_memory_entry("nonexistent")
        assert result is False
        _patch_factory.delete.assert_not_called()


class TestCreateRun:
    @pytest.mark.asyncio
    async def test_creates_without_session(self, _patch_factory):
        from virtual_team.repository.core import create_run
        result = await create_run("测试需求", user_id="u1")
        assert isinstance(result, str)
        assert len(result) > 0
        _patch_factory.add.assert_called_once()
        _patch_factory.commit.assert_awaited_once()
        added = _patch_factory.add.call_args[0][0]
        assert added.requirement == "测试需求"
        assert added.user_id == "u1"
        assert added.status == "pending"

    @pytest.mark.asyncio
    async def test_creates_with_session(self, _patch_factory):
        session = _make_session()
        _patch_factory.get.return_value = session
        from virtual_team.repository.core import create_run
        await create_run("需求", session_id="s1", user_id="u1")
        assert _patch_factory.get.called
        _patch_factory.commit.assert_awaited()

    @pytest.mark.asyncio
    async def test_creates_with_session_not_found(self, _patch_factory):
        _patch_factory.get.return_value = None
        from virtual_team.repository.core import create_run
        result = await create_run("需求", session_id="nonexistent")
        assert result is not None


class TestUpdateRunStatus:
    @pytest.mark.asyncio
    async def test_updates(self, _patch_factory):
        run = _make_run()
        _patch_factory.get.return_value = run
        from virtual_team.repository.core import update_run_status
        await update_run_status("r1", "running")
        assert run.status == "running"
        _patch_factory.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        _patch_factory.get.return_value = None
        from virtual_team.repository.core import update_run_status
        await update_run_status("nonexistent", "running")
        _patch_factory.commit.assert_not_called()


class TestUpdateRunResult:
    @pytest.mark.asyncio
    async def test_updates_all_fields(self, _patch_factory):
        run = _make_run()
        _patch_factory.get.return_value = run
        from virtual_team.repository.core import update_run_result
        await update_run_result("r1", pm_document="文档", code="代码",
                                review="审查", approved=True, status="converged")
        assert run.pm_document == "文档"
        assert run.code == "代码"
        assert run.review == "审查"
        assert run.approved is True
        assert run.status == "converged"
        _patch_factory.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        _patch_factory.get.return_value = None
        from virtual_team.repository.core import update_run_result
        await update_run_result("nonexistent", pm_document="", code="",
                                review="", approved=False, status="error")
        _patch_factory.commit.assert_not_called()


class TestGetRun:
    @pytest.mark.asyncio
    async def test_found(self, _patch_factory):
        run = _make_run()
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = run
        from virtual_team.repository.core import get_run
        result = await get_run("r1")
        assert result is not None
        assert result.id == "r1"

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = None
        from virtual_team.repository.core import get_run
        result = await get_run("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_with_user_id(self, _patch_factory):
        run = _make_run(user_id="u1")
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = run
        from virtual_team.repository.core import get_run
        result = await get_run("r1", "u1")
        assert result is not None
        assert result.user_id == "u1"


class TestGetRuns:
    @pytest.mark.asyncio
    async def test_empty(self, _patch_factory):
        from virtual_team.repository.core import get_runs
        result = await get_runs()
        assert result == []

    @pytest.mark.asyncio
    async def test_with_data(self, _patch_factory):
        runs = [_make_run(id="r1"), _make_run(id="r2")]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = runs
        from virtual_team.repository.core import get_runs
        result = await get_runs(limit=10, user_id="u1")
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_default_limit(self, _patch_factory):
        from virtual_team.repository.core import get_runs
        result = await get_runs()
        assert result == []


class TestSaveMessage:
    @pytest.mark.asyncio
    async def test_saves(self, _patch_factory):
        from virtual_team.repository.core import save_message
        await save_message("r1", "pm", "PM", "你好", round_number=1)
        _patch_factory.add.assert_called_once()
        _patch_factory.commit.assert_awaited_once()
        added = _patch_factory.add.call_args[0][0]
        assert added.run_id == "r1"
        assert added.role == "pm"
        assert added.agent_name == "PM"
        assert added.content == "你好"
        assert added.round_number == 1

    @pytest.mark.asyncio
    async def test_saves_round_2(self, _patch_factory):
        from virtual_team.repository.core import save_message
        await save_message("r1", "programmer", "程序员", "代码", round_number=2)
        added = _patch_factory.add.call_args[0][0]
        assert added.round_number == 2


class TestGetMessages:
    @pytest.mark.asyncio
    async def test_empty(self, _patch_factory):
        from virtual_team.repository.core import get_messages
        result = await get_messages("r1")
        assert result == []

    @pytest.mark.asyncio
    async def test_with_data(self, _patch_factory):
        msgs = [_make_message(id="msg1"), _make_message(id="msg2")]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = msgs
        from virtual_team.repository.core import get_messages
        result = await get_messages("r1")
        assert len(result) == 2
        assert result[0].id == "msg1"
