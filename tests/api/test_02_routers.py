"""API tests for 01 02 routers: TestClient HTTP + WebSocket coverage."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import WebSocketDisconnect


# ============================================================
# Fixtures
# ============================================================

def _mock_session_factory():
    """Create a mock async session factory for DB-backed tests."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_scalar = MagicMock()
    mock_scalar.all.return_value = []
    mock_result.scalars.return_value = mock_scalar
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result
    mock_session.get.return_value = None
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.delete = AsyncMock()

    class _AsyncCtx:
        def __call__(self):
            return self
        async def __aenter__(self):
            return mock_session
        async def __aexit__(self, *args):
            pass

    return MagicMock(return_value=_AsyncCtx())


@pytest.fixture
def client():
    mock_redis = MagicMock()
    mock_redis.ping = AsyncMock(return_value=True)
    mock_redis.incr = AsyncMock(return_value=1)
    mock_redis.expire = AsyncMock(return_value=True)
    mock_factory = _mock_session_factory()

    with (
        patch("virtual_team.broker.get_redis", return_value=mock_redis),
        patch("virtual_team.database.get_async_engine", return_value=MagicMock()),
        patch("virtual_team.database.get_session_factory", mock_factory),
        patch("virtual_team.database.init_db", new_callable=AsyncMock),
        patch("virtual_team.repository.seed_default_agents", new_callable=AsyncMock),
        patch("virtual_team.rate_limit.get_redis", return_value=mock_redis),
        patch("virtual_team.repository.core.get_session_factory", mock_factory),
        patch("virtual_team.repository.keys.get_session_factory", mock_factory),
        patch("virtual_team.repository.teams.get_session_factory", mock_factory),
    ):
        from fastapi.testclient import TestClient
        from virtual_team.app import app
        yield TestClient(app)


# ============================================================
# runs.py — WebSocket test (covers lines 191-252)
# ============================================================

class TestRunsWebSocket:
    """Test the /ws/runs/{run_id} WebSocket endpoint."""

    def test_websocket_subscribe_and_close(self, client):
        """Connect via WS, receive connected msg, then handle subscribe loop."""
        mock_run = MagicMock()
        mock_run.id = "run-1"
        mock_run.session_id = "sess-1"
        mock_run.status = "running"
        mock_run.approved = False
        mock_run.pm_document = None
        mock_run.code = None
        mock_run.review = None
        mock_run.requirement = "test"

        async def _mock_subscribe(_run_id):
            yield {"type": "status", "status": "processing"}
            yield {"type": "message", "role": "pm", "content": "hello"}
            raise WebSocketDisconnect()

        with (
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock, return_value=mock_run),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=[]),
            patch("virtual_team.routers.runs.subscribe_run", side_effect=_mock_subscribe),
        ):
            with client.websocket_connect("/ws/runs/run-1") as ws:
                data = ws.receive_json()
                assert data["type"] == "status"
                assert data["status"] == "connected"

                data = ws.receive_json()
                assert data["type"] == "status"
                assert data.get("status") == "processing"

                data = ws.receive_json()
                assert data["type"] == "message"

    def test_websocket_run_already_converged(self, client):
        """Run is already converged before WS connects — sends messages then closes."""
        mock_run = MagicMock()
        mock_run.id = "run-1"
        mock_run.session_id = "sess-1"
        mock_run.status = "converged"
        mock_run.approved = True
        mock_run.pm_document = "doc"
        mock_run.code = "code"
        mock_run.review = "review"
        mock_run.requirement = "test"

        mock_msg = MagicMock()
        mock_msg.role = "pm"
        mock_msg.agent_name = "PM"
        mock_msg.content = "done"
        mock_msg.round_number = 1

        with (
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock, return_value=mock_run),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=[mock_msg]),
        ):
            with client.websocket_connect("/ws/runs/run-1") as ws:
                data = ws.receive_json()
                assert data["type"] == "status"

                data = ws.receive_json()
                assert data["type"] == "message"
                assert data["role"] == "pm"

                data = ws.receive_json()
                assert data["type"] == "result"
                assert data["status"] == "converged"

    def test_websocket_subscribe_error(self, client):
        """subscribe_run raises an exception — should catch and send error."""
        mock_run = MagicMock()
        mock_run.id = "run-1"
        mock_run.session_id = "sess-1"
        mock_run.status = "running"
        mock_run.approved = False
        mock_run.pm_document = None
        mock_run.code = None
        mock_run.review = None
        mock_run.requirement = "test"

        with (
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock, return_value=mock_run),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=[]),
            patch("virtual_team.routers.runs.subscribe_run", side_effect=Exception("redis down")),
        ):
            with client.websocket_connect("/ws/runs/run-1") as ws:
                data = ws.receive_json()
                assert data["type"] == "status"

                data = ws.receive_json()
                assert data["type"] == "status"
                assert data.get("status") == "error"

    def test_websocket_send_json_error(self, client):
        """websocket.send_json raises exception during subscribe loop."""
        mock_run = MagicMock()
        mock_run.id = "run-1"
        mock_run.session_id = "sess-1"
        mock_run.status = "running"
        mock_run.approved = False
        mock_run.pm_document = None
        mock_run.code = None
        mock_run.review = None
        mock_run.requirement = "test"

        async def _mock_subscribe(_run_id):
            yield {"type": "message", "content": "test"}
            raise StopAsyncIteration()

        with (
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock, return_value=mock_run),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=[]),
            patch("virtual_team.routers.runs.subscribe_run", side_effect=_mock_subscribe),
        ):
            with client.websocket_connect("/ws/runs/run-1") as ws:
                data = ws.receive_json()
                assert data["type"] == "status"

    def test_websocket_auth_enabled_path(self, client):
        """AUTH_ENABLED=True path (lines 195-200): verify JWT token handling."""
        mock_run = MagicMock()
        mock_run.id = "run-1"
        mock_run.status = "running"

        async def _mock_subscribe(_run_id):
            raise StopAsyncIteration()

        with (
            patch("virtual_team.auth.AUTH_ENABLED", True),
            patch("virtual_team.auth.decode_jwt", return_value={"sub": "user-1"}),
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock, return_value=mock_run),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=[]),
            patch("virtual_team.routers.runs.subscribe_run", side_effect=_mock_subscribe),
        ):
            with client.websocket_connect("/ws/runs/run-1?token=valid-token") as ws:
                data = ws.receive_json()
                assert data["type"] == "status"

    def test_websocket_pre_check_exception(self, client):
        """get_run raises exception during pre-check (lines 232-233)."""
        mock_run = MagicMock()
        mock_run.id = "run-1"
        mock_run.status = "running"

        async def _mock_subscribe(_run_id):
            raise StopAsyncIteration()

        with (
            patch("virtual_team.routers.runs.get_run", side_effect=Exception("db error")),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=[]),
            patch("virtual_team.routers.runs.subscribe_run", side_effect=_mock_subscribe),
        ):
            with client.websocket_connect("/ws/runs/run-1") as ws:
                data = ws.receive_json()
                assert data["type"] == "status"


# ============================================================
# commands.py — simple HTTP tests
# ============================================================

class TestCommandsAPI:

    def test_list_commands(self, client):
        resp = client.get("/api/commands")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert data[0]["id"] == "clear"

    def test_get_command_found(self, client):
        resp = client.get("/api/commands/clear")
        assert resp.status_code == 200
        assert resp.json()["id"] == "clear"

    def test_get_command_not_found(self, client):
        resp = client.get("/api/commands/nonexistent")
        assert resp.status_code == 404


# ============================================================
# models.py — HTTP tests
# ============================================================

class TestModelsAPI:

    def test_list_models_empty(self, client):
        with patch("virtual_team.routers.models.get_api_keys", new_callable=AsyncMock, return_value=[]):
            resp = client.get("/api/models")
            assert resp.status_code == 200
            assert resp.json() == []


# ============================================================
# keys.py — HTTP tests
# ============================================================

class TestKeysAPI:

    def test_list_keys_empty(self, client):
        with patch("virtual_team.routers.keys.get_api_keys", new_callable=AsyncMock, return_value=[]):
            resp = client.get("/api/keys")
            assert resp.status_code == 200
            assert resp.json() == []

    def test_list_keys_server_error(self, client):
        with patch("virtual_team.routers.keys.get_api_keys", new_callable=AsyncMock, side_effect=Exception("db error")):
            resp = client.get("/api/keys")
            assert resp.status_code == 500

    def test_remove_key_not_found(self, client):
        with patch("virtual_team.routers.keys.delete_api_key", new_callable=AsyncMock, return_value=False):
            resp = client.delete("/api/keys/key-1")
            assert resp.status_code == 404

    def test_remove_key_success(self, client):
        with patch("virtual_team.routers.keys.delete_api_key", new_callable=AsyncMock, return_value=True):
            resp = client.delete("/api/keys/key-1")
            assert resp.status_code == 200
            assert resp.json() == {"status": "deleted", "id": "key-1"}

    def test_key_usage_error(self, client):
        with patch("virtual_team.routers.keys.get_key_usage_stats", new_callable=AsyncMock, side_effect=Exception("error")):
            resp = client.get("/api/keys/usage")
            assert resp.status_code == 500


# ============================================================
# sessions.py — HTTP tests
# ============================================================

class TestSessionsAPI:

    def test_list_sessions_error(self, client):
        with patch("virtual_team.routers.sessions.get_sessions", new_callable=AsyncMock, side_effect=Exception("db error")):
            resp = client.get("/api/sessions")
            assert resp.status_code == 500

    def test_create_session(self, client):
        mock_session = MagicMock()
        mock_session.id = "sess-new"
        mock_session.title = "新对话"
        mock_session.created_at = None
        mock_session.updated_at = None

        with patch("virtual_team.routers.sessions.create_session", new_callable=AsyncMock, return_value=mock_session):
            resp = client.post("/api/sessions", json={"title": "新对话"})
            assert resp.status_code == 201
            assert resp.json()["id"] == "sess-new"

    def test_create_session_error(self, client):
        with patch("virtual_team.routers.sessions.create_session", new_callable=AsyncMock, side_effect=Exception("db error")):
            resp = client.post("/api/sessions", json={"title": "新对话"})
            assert resp.status_code == 500

    def test_export_memories_invalid_format(self, client):
        with patch("virtual_team.routers.sessions.get_session", new_callable=AsyncMock, return_value=MagicMock()):
            resp = client.get("/api/sessions/sess-1/memories/export?format=invalid")
            assert resp.status_code == 400

    def test_export_memories_session_not_found(self, client):
        with patch("virtual_team.routers.sessions.get_session", new_callable=AsyncMock, return_value=None):
            resp = client.get("/api/sessions/sess-1/memories/export?format=json")
            assert resp.status_code == 404


# ============================================================
# skills.py — HTTP tests
# ============================================================

class TestSkillsAPI:

    def test_generate_skill_error(self, client):
        with patch("virtual_team.routers.skills._generate_skill_from_description", side_effect=Exception("fail")):
            resp = client.post("/api/skills/generate", json={"description": "test", "category": "general"})
            assert resp.status_code == 500

    def test_validate_skill_error(self, client):
        with patch("virtual_team.routers.skills._validate_skill_content", side_effect=Exception("fail")):
            resp = client.post("/api/skills/validate", json={"content": "---\nname: t\n---\n# H"})
            assert resp.status_code == 500


# ============================================================
# tools.py — HTTP tests
# ============================================================

class TestToolsAPI:

    def test_generate_tool_error(self, client):
        with patch("virtual_team.routers.tools._generate_tool_from_description", side_effect=Exception("fail")):
            resp = client.post("/api/tools/generate", json={"description": "test", "language": "python"})
            assert resp.status_code == 500

    def test_validate_tool_error(self, client):
        with patch("virtual_team.routers.tools._validate_tool_code", side_effect=Exception("fail")):
            resp = client.post("/api/tools/validate", json={"code": "print(1)", "language": "python"})
            assert resp.status_code == 500


# ============================================================
# system_team.py — HTTP tests
# ============================================================

class TestSystemTeamAPI:

    def test_get_agent_config_not_found(self, client):
        mock_mgr = MagicMock()
        mock_mgr.get_agent_config.return_value = None
        with patch("virtual_team.routers.system_team.get_system_team_manager", return_value=mock_mgr):
            resp = client.get("/api/system-team/agents/bad-id/config")
            assert resp.status_code == 404
