"""API tests for runs — run detail, validation, and WebSocket edge cases."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import WebSocketDisconnect


def _mock_session_factory():
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


def _make_mock_message(id="msg-1", run_id="run-1", role="pm", agent_name="PM",
                       content="hello", round_number=1):
    m = MagicMock()
    m.id = id
    m.run_id = run_id
    m.role = role
    m.agent_name = agent_name
    m.content = content
    m.round_number = round_number
    m.created_at = MagicMock()
    m.created_at.isoformat.return_value = "2025-01-01T00:00:00"
    return m


def _make_mock_run(id="run-1", session_id="sess-1", status="pending"):
    r = MagicMock()
    r.id = id
    r.session_id = session_id
    r.requirement = "Test"
    r.pm_document = ""
    r.code = ""
    r.review = ""
    r.approved = False
    r.status = status
    r.created_at = MagicMock()
    r.created_at.isoformat.return_value = "2025-01-01T00:00:00"
    r.updated_at = MagicMock()
    r.updated_at.isoformat.return_value = "2025-01-01T00:00:00"
    return r


class TestRunDetailMessages:
    """Messages are embedded in GET /api/runs/{run_id} detail response."""

    def test_get_run_detail_includes_messages(self, client):
        msgs = [_make_mock_message(id="msg-1"), _make_mock_message(id="msg-2")]
        mock_run = _make_mock_run(id="run-1")

        with (
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock, return_value=mock_run),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=msgs),
        ):
            resp = client.get("/api/runs/run-1")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["messages"]) == 2
        assert data["messages"][0]["id"] == "msg-1"

    def test_get_run_detail_messages_empty(self, client):
        mock_run = _make_mock_run(id="run-1")
        with (
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock, return_value=mock_run),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=[]),
        ):
            resp = client.get("/api/runs/run-1")
        assert resp.status_code == 200
        assert resp.json()["messages"] == []


class TestRunCreateValidation:
    """Pydantic-level and app-level validation for run creation."""

    def test_pydantic_rejects_empty_requirement(self, client):
        resp = client.post("/api/runs", json={"requirement": ""})
        assert resp.status_code == 422

    def test_pydantic_rejects_too_long_requirement(self, client):
        resp = client.post("/api/runs", json={"requirement": "x" * 2001})
        assert resp.status_code == 422

    def test_pydantic_rejects_missing_requirement(self, client):
        resp = client.post("/api/runs", json={})
        assert resp.status_code == 422

    def test_pydantic_rejects_non_string_requirement(self, client):
        resp = client.post("/api/runs", json={"requirement": 123})
        assert resp.status_code == 422


class TestWebSocketAdditional:
    """WebSocket edge cases complementing test_02_routers coverage."""

    def test_websocket_run_not_found_connects_then_idles(self, client):
        with patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock, return_value=None), client.websocket_connect("/ws/runs/ghost-run") as ws:
                data = ws.receive_json()
                assert data["type"] == "status"
                assert data["status"] == "connected"

    def test_websocket_subscribe_error_sends_error(self, client):
        mock_run = _make_mock_run(id="run-1", status="running")

        async def _mock_subscribe_error(_run_id):
            yield {"type": "status", "status": "processing"}
            raise RuntimeError("redis connection lost")

        with (
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock, return_value=mock_run),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=[]),
            patch("virtual_team.routers.runs.subscribe_run", side_effect=_mock_subscribe_error),
            client.websocket_connect("/ws/runs/run-1") as ws,
        ):
            data = ws.receive_json()
            assert data["type"] == "status"
            assert data["status"] == "connected"

            data = ws.receive_json()
            assert data["type"] == "status"
            assert data.get("status") == "processing"

            data = ws.receive_json()
            assert data["type"] == "status"
            assert data.get("status") == "error"
            assert "redis connection lost" in data.get("error", "")

    def test_websocket_disconnect_during_subscribe(self, client):
        mock_run = _make_mock_run(id="run-1", status="running")

        async def _mock_subscribe_disconnect(_run_id):
            yield {"type": "status", "status": "processing"}
            raise WebSocketDisconnect()

        with (
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock, return_value=mock_run),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=[]),
            patch("virtual_team.routers.runs.subscribe_run", side_effect=_mock_subscribe_disconnect),
            client.websocket_connect("/ws/runs/run-1") as ws,
        ):
                data = ws.receive_json()
                assert data["type"] == "status"
                assert data.get("status") == "connected"

                data = ws.receive_json()
                assert data["type"] == "status"
                assert data.get("status") == "processing"
