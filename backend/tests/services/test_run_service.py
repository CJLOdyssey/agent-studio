"""Unit tests for """

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestRunService:
    """Test RunService class — constructor, create_run, continue_run, error handling."""

    @pytest.mark.asyncio
    async def test_import(self):
        from services.run_service import RunService, run_service

        assert RunService is not None
        assert run_service is not None
        assert isinstance(run_service, RunService)

    @pytest.mark.asyncio
    async def test_create_run_requires_requirement(self):
        from services.run_service import RunService

        svc = RunService()
        with pytest.raises(TypeError):
            await svc.create_run()  # type: ignore[call-arg]

    @pytest.mark.asyncio
    async def test_create_run_no_api_key_raises(self):
        from services.run_service import RunService

        svc = RunService()
        with (
            patch("services.run_service.load_config") as mock_load,
            patch("services.run_service.create_session") as mock_create_sess,
            patch("services.run_service.get_api_key_for_use") as mock_get_key,
            patch("services.run_service.get_api_key_for_model") as mock_get_model,
            patch("services.run_service.get_default_api_key") as mock_get_default,
        ):
            mock_load.return_value.model = "gpt-4"
            mock_sess = MagicMock()
            mock_sess.id = "sess-123"
            mock_create_sess.return_value = mock_sess
            mock_get_key.return_value = None
            mock_get_model.return_value = None
            mock_get_default.return_value = None

            with pytest.raises(ValueError, match="API Key"):
                await svc.create_run(
                    requirement="test requirement",
                    session_id=None,
                    user_id="user-1",
                )

    @pytest.mark.asyncio
    async def test_create_run_with_key_id_success(self):
        from services.run_service import RunService

        svc = RunService()
        with (
            patch("services.run_service.load_config") as mock_load,
            patch("services.run_service.create_session") as mock_create_sess,
            patch("services.run_service.get_api_key_for_use") as mock_get_key,
            patch("services.run_service.save_message", new_callable=AsyncMock),
            patch("services.run_service.buffer_run_messages") as mock_buffer,
            patch("services.run_service.asyncio.create_task"),
            patch("services.run_service.get_session") as mock_get_sess,
            patch("services.run_service.update_session_title"),
            patch("repository.create_run") as mock_db_create_run,
        ):
            mock_load.return_value.model = "gpt-4"
            mock_sess = MagicMock()
            mock_sess.id = "sess-456"
            mock_create_sess.return_value = mock_sess
            mock_get_key.return_value = {"api_key": "sk-test", "base_url": None}
            mock_get_sess.return_value = mock_sess
            mock_db_create_run.return_value = "run-789"
            mock_buffer.return_value = None

            result = await svc.create_run(
                requirement="hello world",
                session_id=None,
                user_id="user-1",
                key_id="key-1",
            )
            assert result["run_id"] == "run-789"
            assert result["status"] == "pending"
            assert result["session_id"] == "sess-456"

    @pytest.mark.asyncio
    async def test_create_run_with_existing_session(self):
        from services.run_service import RunService

        svc = RunService()
        with (
            patch("services.run_service.load_config") as mock_load,
            patch("services.run_service.get_session") as mock_get_sess,
            patch("services.run_service.get_api_key_for_use"),
            patch("services.run_service.get_api_key_for_model") as mock_get_model,
            patch("services.run_service.get_default_api_key") as mock_get_default,
            patch("services.run_service.save_message", new_callable=AsyncMock),
            patch("services.run_service.buffer_run_messages"),
            patch("services.run_service.asyncio.create_task"),
            patch("services.run_service.update_session_title"),
            patch("repository.create_run") as mock_db_create_run,
        ):
            mock_load.return_value.model = "gpt-4"
            existing = MagicMock()
            existing.id = "sess-existing"
            existing.title = "Existing Session"
            mock_get_sess.return_value = existing
            mock_get_model.return_value = None
            mock_get_default.return_value = {"api_key": "sk-test", "base_url": None}
            mock_db_create_run.return_value = "run-999"

            result = await svc.create_run(
                requirement="continue this",
                session_id="sess-existing",
                user_id="user-1",
            )
            assert result["run_id"] == "run-999"
            assert result["session_id"] == "sess-existing"

    @pytest.mark.asyncio
    async def test_create_run_session_not_found_creates_new(self):
        from services.run_service import RunService

        svc = RunService()
        with (
            patch("services.run_service.load_config") as mock_load,
            patch("services.run_service.get_session") as mock_get_sess,
            patch("services.run_service.create_session") as mock_create_sess,
            patch("services.run_service.get_api_key_for_model") as mock_get_model,
            patch("services.run_service.get_default_api_key") as mock_get_default,
            patch("services.run_service.save_message", new_callable=AsyncMock),
            patch("services.run_service.buffer_run_messages"),
            patch("services.run_service.asyncio.create_task"),
            patch("services.run_service.update_session_title"),
            patch("repository.create_run") as mock_db_create_run,
        ):
            mock_load.return_value.model = "gpt-4"
            mock_get_sess.return_value = None
            new_sess = MagicMock()
            new_sess.id = "sess-new"
            mock_create_sess.return_value = new_sess
            mock_get_model.return_value = None
            mock_get_default.return_value = {"api_key": "sk-test", "base_url": None}
            mock_db_create_run.return_value = "run-new"

            result = await svc.create_run(
                requirement="new session please",
                session_id="sess-nonexistent",
                user_id="user-1",
            )
            assert result["session_id"] == "sess-new"

    @pytest.mark.asyncio
    async def test_create_run_db_error_raises(self):
        from services.run_service import RunService

        svc = RunService()
        with (
            patch("services.run_service.load_config") as mock_load,
            patch("services.run_service.create_session") as mock_create_sess,
            patch("services.run_service.get_api_key_for_model") as mock_get_model,
            patch("services.run_service.get_default_api_key") as mock_get_default,
            patch("repository.create_run") as mock_db_create_run,
        ):
            mock_load.return_value.model = "gpt-4"
            mock_sess = MagicMock()
            mock_sess.id = "sess-err"
            mock_create_sess.return_value = mock_sess
            mock_get_model.return_value = None
            mock_get_default.return_value = {"api_key": "sk-test", "base_url": None}
            mock_db_create_run.side_effect = Exception("DB down")

            with pytest.raises(Exception, match="DB down"):
                await svc.create_run(
                    requirement="fail",
                    session_id=None,
                    user_id="user-1",
                )

    @pytest.mark.asyncio
    async def test_create_run_team_with_workflow_dispatches_team_pipeline(self):
        """F1: team + workflow must schedule _run_team_pipeline, not _run_agent_pipeline."""
        from services.run_service import RunService

        svc = RunService()
        mock_workflow = MagicMock()
        mock_workflow.nodes = ["n1", "n2"]
        with (
            patch("services.run_service.load_config") as mock_load,
            patch("services.run_service.create_session") as mock_create_sess,
            patch("services.run_service.get_api_key_for_use") as mock_get_key,
            patch("services.run_service.save_message", new_callable=AsyncMock),
            patch("services.run_service.buffer_run_messages") as mock_buffer,
            patch("services.run_service.asyncio.create_task") as mock_create_task,
            patch("services.run_service.get_session") as mock_get_sess,
            patch("services.run_service.update_session_title"),
            patch("repository.create_run") as mock_db_create_run,
            patch("repository.workflows.get_workflow_config_by_team") as mock_get_wf,
            patch("tasks.team_pipeline._run_team_pipeline", new_callable=MagicMock) as mock_team_pipeline,
        ):
            mock_load.return_value.model = "gpt-4"
            mock_sess = MagicMock()
            mock_sess.id = "sess-team"
            mock_create_sess.return_value = mock_sess
            mock_get_key.return_value = {"api_key": "sk-team", "base_url": None}
            mock_get_sess.return_value = mock_sess
            mock_db_create_run.return_value = "run-team"
            mock_buffer.return_value = None
            mock_get_wf.return_value = mock_workflow

            result = await svc.create_run(
                requirement="team task",
                session_id=None,
                user_id="user-1",
                team_id="team-1",
                key_id="key-1",
            )
            assert result["run_id"] == "run-team"
            assert result["status"] == "pending"
            assert result["session_id"] == "sess-team"
            mock_get_wf.assert_called_once_with("team-1")
            mock_create_task.assert_called_once()
            called_task = mock_create_task.call_args[0][0]
            assert called_task is mock_team_pipeline.return_value
            mock_team_pipeline.assert_called_once_with(
                requirement="team task",
                run_id="run-team",
                session_id="sess-team",
                team_id="team-1",
                key_id="key-1",
                model="gpt-4",
                api_key="sk-team",
                api_base=None,
            )

    @pytest.mark.asyncio
    async def test_continue_run_creates_session_when_none(self):
        from services.run_service import RunService

        svc = RunService()
        with (
            patch("services.run_service.load_config") as mock_load,
            patch("services.run_service.create_session") as mock_create_sess,
            patch("services.run_service.get_api_key_for_model") as mock_get_model,
            patch("services.run_service.get_default_api_key") as mock_get_default,
            patch("services.run_service.save_message", new_callable=AsyncMock),
            patch("services.run_service.buffer_run_messages"),
            patch("services.run_service.asyncio.create_task"),
            patch("repository.create_run") as mock_db_create_run,
        ):
            mock_load.return_value.model = "gpt-4"
            mock_sess = MagicMock()
            mock_sess.id = "sess-cont"
            mock_create_sess.return_value = mock_sess
            mock_get_model.return_value = None
            mock_get_default.return_value = {"api_key": "sk-test", "base_url": None}
            mock_db_create_run.return_value = "run-cont"

            result = await svc.continue_run(
                content="keep going",
                session_id=None,
                user_id="user-1",
            )
            assert result["run_id"] == "run-cont"
            assert result["status"] == "running"

    @pytest.mark.asyncio
    async def test_continue_run_no_api_key_raises(self):
        from services.run_service import RunService

        svc = RunService()
        with (
            patch("services.run_service.load_config"),
            patch("services.run_service.get_api_key_for_model") as mock_get_model,
            patch("services.run_service.get_default_api_key") as mock_get_default,
        ):
            mock_get_model.side_effect = Exception("vault down")
            mock_get_default.side_effect = Exception("vault down")

            with pytest.raises(ValueError, match="API Key"):
                await svc.continue_run(
                    content="continue",
                    session_id="sess-1",
                    user_id="user-1",
                )

    @pytest.mark.asyncio
    async def test_get_run_returns_none_when_missing(self):
        from services.run_service import RunService

        svc = RunService()
        with patch("services.run_service.get_run") as mock_get_run:
            mock_get_run.return_value = None
            result = await svc.get_run("nonexistent")
            assert result is None

    @pytest.mark.asyncio
    async def test_get_run_with_messages(self):
        from services.run_service import RunService

        svc = RunService()
        with (
            patch("services.run_service.get_run") as mock_get_run,
            patch("services.run_service.get_messages") as mock_get_msgs,
        ):
            mock_run = MagicMock()
            mock_run.id = "run-1"
            mock_run.session_id = "sess-1"
            mock_run.requirement = "test"
            mock_run.pm_document = None
            mock_run.code = None
            mock_run.review = None
            mock_run.approved = False
            mock_run.status = "completed"
            mock_run.created_at = datetime(2025, 1, 1, tzinfo=UTC)
            mock_run.updated_at = datetime(2025, 1, 2, tzinfo=UTC)
            mock_get_run.return_value = mock_run

            mock_msg = MagicMock()
            mock_msg.id = "msg-1"
            mock_msg.role = "user"
            mock_msg.agent_name = None
            mock_msg.content = "hello"
            mock_msg.thinking = None
            mock_msg.round_number = 1
            mock_msg.created_at = datetime(2025, 1, 1, tzinfo=UTC)
            mock_get_msgs.return_value = [mock_msg]

            result = await svc.get_run("run-1")
            assert result["id"] == "run-1"
            assert len(result["messages"]) == 1
            assert result["messages"][0]["content"] == "hello"

    @pytest.mark.asyncio
    async def test_list_runs_returns_list(self):
        from services.run_service import RunService

        svc = RunService()
        with patch("services.run_service.get_runs") as mock_get_runs:
            mock_run = MagicMock()
            mock_run.id = "run-list"
            mock_run.session_id = "sess-1"
            mock_run.requirement = "list test"
            mock_run.pm_document = None
            mock_run.code = None
            mock_run.review = None
            mock_run.approved = False
            mock_run.status = "completed"
            mock_run.created_at = datetime(2025, 1, 1, tzinfo=UTC)
            mock_run.updated_at = datetime(2025, 1, 2, tzinfo=UTC)
            mock_get_runs.return_value = [mock_run]

            result = await svc.list_runs(limit=10)
            assert len(result) == 1
            assert result[0]["id"] == "run-list"

    @pytest.mark.asyncio
    async def test_list_runs_enforces_max_limit(self):
        from services.run_service import RunService

        svc = RunService()
        with patch("services.run_service.get_runs") as mock_get_runs:
            mock_get_runs.return_value = []
            await svc.list_runs(limit=999)
            mock_get_runs.assert_called_once_with(limit=100, user_id=None)

    @pytest.mark.asyncio
    async def test_list_runs_scopes_to_user(self):
        from services.run_service import RunService

        svc = RunService()
        with patch("services.run_service.get_runs") as mock_get_runs:
            mock_get_runs.return_value = []
            await svc.list_runs(limit=10, user_id="u-1")
            mock_get_runs.assert_called_once_with(limit=10, user_id="u-1")

    @pytest.mark.asyncio
    async def test_create_run_dispatches_agent_to_celery_when_enabled(self, monkeypatch):
        """RUN_DISPATCH=celery → run_agent.delay, no in-process create_task."""
        from services import run_service as rs
        from tasks import registry as _reg

        monkeypatch.setenv("RUN_DISPATCH", "celery")
        monkeypatch.setattr(rs, "RUN_DISPATCH", "celery")

        captured: dict = {}
        monkeypatch.setattr(
            _reg, "run_agent",
            type("FakeTask", (), {"delay": lambda *a, **kw: captured.update(kw) or None})(),
        )

        svc = rs.RunService()
        with (
            patch("services.run_service.load_config") as mock_load,
            patch("services.run_service.create_session") as mock_create_sess,
            patch("services.run_service.get_api_key_for_use") as mock_get_key,
            patch("services.run_service.save_message", new_callable=AsyncMock),
            patch("services.run_service.buffer_run_messages"),
            patch("services.run_service.asyncio.create_task") as mock_create_task,
            patch("services.run_service.get_session") as mock_get_sess,
            patch("services.run_service.update_session_title"),
            patch("repository.create_run") as mock_db_create_run,
        ):
            mock_load.return_value.model = "gpt-4"
            mock_sess = MagicMock()
            mock_sess.id = "sess-celery"
            mock_create_sess.return_value = mock_sess
            mock_get_key.return_value = {"api_key": "sk-test", "base_url": None}
            mock_get_sess.return_value = mock_sess
            mock_db_create_run.return_value = "run-celery"

            result = await svc.create_run(
                requirement="hi",
                session_id=None,
                user_id="user-1",
                key_id="key-1",
                agent_id="agent-1",
            )

        assert result == {"run_id": "run-celery", "status": "pending", "session_id": "sess-celery"}
        assert captured["agent_id"] == "agent-1"
        assert captured["user_id"] == "user-1"
        assert captured["model"] == "gpt-4"
        assert captured["run_id"] == "run-celery"
        mock_create_task.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_run_team_dispatches_run_team_to_celery_when_enabled(self, monkeypatch):
        """RUN_DISPATCH=celery + team workflow → run_team.delay (no user_id), not run_agent."""
        from services import run_service as rs
        from tasks import registry as _reg

        monkeypatch.setenv("RUN_DISPATCH", "celery")
        monkeypatch.setattr(rs, "RUN_DISPATCH", "celery")

        captured: dict = {}
        monkeypatch.setattr(
            _reg, "run_team",
            type("FakeTeam", (), {"delay": lambda *a, **kw: captured.update(kw) or None})(),
        )
        agent_delayed: list = []
        monkeypatch.setattr(
            _reg, "run_agent",
            type("FakeAgent", (), {"delay": lambda *a, **kw: agent_delayed.append(kw)})(),
        )

        mock_workflow = MagicMock()
        mock_workflow.nodes = ["n1"]
        svc = rs.RunService()
        with (
            patch("services.run_service.load_config") as mock_load,
            patch("services.run_service.create_session") as mock_create_sess,
            patch("services.run_service.get_api_key_for_use") as mock_get_key,
            patch("services.run_service.save_message", new_callable=AsyncMock),
            patch("services.run_service.buffer_run_messages"),
            patch("services.run_service.get_session") as mock_get_sess,
            patch("services.run_service.update_session_title"),
            patch("repository.create_run") as mock_db_create_run,
            patch("repository.workflows.get_workflow_config_by_team") as mock_get_wf,
        ):
            mock_load.return_value.model = "gpt-4"
            mock_sess = MagicMock()
            mock_sess.id = "sess-celery-team"
            mock_create_sess.return_value = mock_sess
            mock_get_key.return_value = {"api_key": "sk-team", "base_url": None}
            mock_get_sess.return_value = mock_sess
            mock_db_create_run.return_value = "run-celery-team"
            mock_get_wf.return_value = mock_workflow

            result = await svc.create_run(
                requirement="team task",
                session_id=None,
                user_id="user-1",
                key_id="key-1",
                team_id="team-1",
            )

        assert result == {"run_id": "run-celery-team", "status": "pending", "session_id": "sess-celery-team"}
        assert captured["team_id"] == "team-1"
        assert captured["key_id"] == "key-1"
        assert "user_id" not in captured
        assert agent_delayed == []

    @pytest.mark.asyncio
    async def test_create_run_uses_in_process_task_by_default(self):
        """RUN_DISPATCH 缺省 thread → asyncio.create_task, no .delay()."""
        from services import run_service as rs

        assert rs.RUN_DISPATCH == "thread"
        svc = rs.RunService()
        with (
            patch("services.run_service.load_config") as mock_load,
            patch("services.run_service.create_session") as mock_create_sess,
            patch("services.run_service.get_api_key_for_use") as mock_get_key,
            patch("services.run_service.save_message", new_callable=AsyncMock),
            patch("services.run_service.buffer_run_messages"),
            patch("services.run_service.asyncio.create_task") as mock_create_task,
            patch("services.run_service.get_session") as mock_get_sess,
            patch("services.run_service.update_session_title"),
            patch("repository.create_run") as mock_db_create_run,
        ):
            mock_load.return_value.model = "gpt-4"
            mock_sess = MagicMock()
            mock_sess.id = "sess-thread"
            mock_create_sess.return_value = mock_sess
            mock_get_key.return_value = {"api_key": "sk-test", "base_url": None}
            mock_get_sess.return_value = mock_sess
            mock_db_create_run.return_value = "run-thread"

            result = await svc.create_run(
                requirement="hi",
                session_id=None,
                user_id="user-1",
                key_id="key-1",
                agent_id="agent-1",
            )

        assert result == {"run_id": "run-thread", "status": "pending", "session_id": "sess-thread"}
        mock_create_task.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_run_persists_user_message(self):
        """create_run 在 db_create_run 之后落库用户消息（role=user, agent_name=我）。"""
        from services.run_service import RunService

        svc = RunService()
        with (
            patch("services.run_service.load_config") as mock_load,
            patch("services.run_service.create_session") as mock_create_sess,
            patch("services.run_service.save_message", new_callable=AsyncMock) as mock_save,
            patch("services.run_service.get_api_key_for_use") as mock_get_key,
            patch("services.run_service.buffer_run_messages"),
            patch("services.run_service.asyncio.create_task"),
            patch("services.run_service.get_session") as mock_get_sess,
            patch("services.run_service.update_session_title"),
            patch("repository.create_run") as mock_db_create_run,
        ):
            mock_load.return_value.model = "gpt-4"
            mock_sess = MagicMock()
            mock_sess.id = "sess-msg"
            mock_create_sess.return_value = mock_sess
            mock_get_key.return_value = {"api_key": "sk-test", "base_url": None}
            mock_get_sess.return_value = mock_sess
            mock_db_create_run.return_value = "run-msg"

            await svc.create_run(
                requirement="hello world",
                session_id=None,
                user_id="user-1",
                key_id="key-1",
            )
            mock_save.assert_awaited_once_with(
                run_id="run-msg",
                role="user",
                agent_name="我",
                content="hello world",
                round_number=1,
            )

    @pytest.mark.asyncio
    async def test_continue_run_persists_user_message_with_question(self):
        """continue_run 带 question → 落库用户消息 = 原问题（question 语义）。"""
        from services.run_service import RunService

        svc = RunService()
        with (
            patch("services.run_service.load_config") as mock_load,
            patch("services.run_service.create_session") as mock_create_sess,
            patch("services.run_service.save_message", new_callable=AsyncMock) as mock_save,
            patch("services.run_service.get_api_key_for_model") as mock_get_model,
            patch("services.run_service.get_default_api_key") as mock_get_default,
            patch("services.run_service.buffer_run_messages"),
            patch("services.run_service.asyncio.create_task"),
            patch("repository.create_run") as mock_db_create_run,
        ):
            mock_load.return_value.model = "gpt-4"
            mock_sess = MagicMock()
            mock_sess.id = "sess-cont-msg"
            mock_create_sess.return_value = mock_sess
            mock_get_model.return_value = None
            mock_get_default.return_value = {"api_key": "sk-test", "base_url": None}
            mock_db_create_run.return_value = "run-cont-msg"

            await svc.continue_run(
                content="half draft",
                session_id=None,
                user_id="user-1",
                question="原问题",
            )
            mock_save.assert_awaited_once_with(
                run_id="run-cont-msg",
                role="user",
                agent_name="我",
                content="原问题",
                round_number=1,
            )

    @pytest.mark.asyncio
    async def test_continue_run_persists_user_message_falls_back_to_content(self):
        """continue_run 无 question → 用户消息回退到 content。"""
        from services.run_service import RunService

        svc = RunService()
        with (
            patch("services.run_service.load_config") as mock_load,
            patch("services.run_service.create_session") as mock_create_sess,
            patch("services.run_service.save_message", new_callable=AsyncMock) as mock_save,
            patch("services.run_service.get_api_key_for_model") as mock_get_model,
            patch("services.run_service.get_default_api_key") as mock_get_default,
            patch("services.run_service.buffer_run_messages"),
            patch("services.run_service.asyncio.create_task"),
            patch("repository.create_run") as mock_db_create_run,
        ):
            mock_load.return_value.model = "gpt-4"
            mock_sess = MagicMock()
            mock_sess.id = "sess-cont-fb"
            mock_create_sess.return_value = mock_sess
            mock_get_model.return_value = None
            mock_get_default.return_value = {"api_key": "sk-test", "base_url": None}
            mock_db_create_run.return_value = "run-cont-fb"

            await svc.continue_run(
                content="half draft",
                session_id=None,
                user_id="user-1",
            )
            mock_save.assert_awaited_once_with(
                run_id="run-cont-fb",
                role="user",
                agent_name="我",
                content="half draft",
                round_number=1,
            )

    @pytest.mark.asyncio
    async def test_continue_run_uses_model_param_for_key_resolution(self):
        """continue_run 的 model 参数优先于 config.model 做 key 解析。"""
        from services.run_service import RunService

        svc = RunService()
        with (
            patch("services.run_service.load_config") as mock_load,
            patch("services.run_service.create_session") as mock_create_sess,
            patch("services.run_service.save_message", new_callable=AsyncMock),
            patch("services.run_service.get_api_key_for_model") as mock_get_model,
            patch("services.run_service.get_default_api_key") as mock_get_default,
            patch("services.run_service.save_message", new_callable=AsyncMock),
            patch("services.run_service.buffer_run_messages"),
            patch("services.run_service.asyncio.create_task"),
            patch("repository.create_run") as mock_db_create_run,
        ):
            mock_load.return_value.model = "gpt-4"
            mock_sess = MagicMock()
            mock_sess.id = "sess-model"
            mock_create_sess.return_value = mock_sess
            mock_get_model.return_value = {"api_key": "sk-model", "base_url": None}
            mock_get_default.return_value = {"api_key": "sk-default", "base_url": None}
            mock_db_create_run.return_value = "run-model"

            await svc.continue_run(
                content="keep going",
                session_id=None,
                user_id="user-1",
                model="deepseek-chat",
            )
            mock_get_model.assert_awaited_once_with("deepseek-chat", "user-1")
            mock_get_default.assert_not_awaited()


# ─────────────────────────────────────────────────────────────────────
# 8. backend/services/generators/_models.py — GeneratedTool
# ─────────────────────────────────────────────────────────────────────


