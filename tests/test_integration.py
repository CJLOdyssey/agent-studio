"""Integration tests: API endpoints via FastAPI TestClient."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture
def client():
    """Create a TestClient with all external dependencies mocked.

    Mocks are applied BEFORE importing app to catch module-level decorator
    evaluation (e.g., File/Form params requiring python-multipart).
    """
    mock_redis = MagicMock()
    mock_redis.ping = AsyncMock(return_value=True)

    with patch("virtual_team.broker.get_redis", return_value=mock_redis), \
         patch("virtual_team.database.get_async_engine", return_value=MagicMock()), \
         patch("virtual_team.database.get_session_factory", return_value=MagicMock()), \
         patch("virtual_team.database.init_db", new_callable=AsyncMock), \
         patch("virtual_team.repository.seed_default_agents", new_callable=AsyncMock), \
         patch("virtual_team.rate_limit.get_redis", return_value=mock_redis):
        from virtual_team.app import app
        from fastapi.testclient import TestClient
        yield TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_ok(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data

    def test_health_is_public(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200


class TestModelsEndpoint:
    def test_list_models_returns_list(self, client):
        response = client.get("/api/models")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestCommandsEndpoint:
    def test_list_commands_returns_builtins(self, client):
        response = client.get("/api/commands")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert any(c["id"] == "help" for c in data)

    def test_get_command_by_id(self, client):
        response = client.get("/api/commands/help")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "help"

    def test_get_unknown_command_returns_404(self, client):
        response = client.get("/api/commands/nonexistent")
        assert response.status_code == 404


class TestSessionsEndpoint:
    def test_list_sessions(self, client):
        with patch("virtual_team.routers.sessions.get_sessions", new_callable=AsyncMock) as mock_list, \
             patch("virtual_team.routers.sessions.get_runs_by_session_ids", new_callable=AsyncMock) as mock_runs:
            mock_list.return_value = []
            mock_runs.return_value = {}
            response = client.get("/api/sessions")
            assert response.status_code == 200
            assert isinstance(response.json(), list)

    def test_get_nonexistent_session_returns_404(self, client):
        with patch("virtual_team.routers.sessions.get_session", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None
            response = client.get("/api/sessions/nonexistent-id")
            assert response.status_code == 404


class TestRunsEndpoint:
    def test_list_runs(self, client):
        with patch("virtual_team.routers.runs.get_runs", new_callable=AsyncMock) as mock_runs:
            mock_runs.return_value = []
            response = client.get("/api/runs")
            assert response.status_code == 200
            assert isinstance(response.json(), list)

    def test_get_nonexistent_run_returns_404(self, client):
        with patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None
            response = client.get("/api/runs/nonexistent-id")
            assert response.status_code == 404

    def test_create_run_empty_requirement(self, client):
        response = client.post("/api/runs", json={"requirement": ""})
        assert response.status_code == 422

    def test_create_run_too_long_requirement(self, client):
        response = client.post("/api/runs", json={"requirement": "a" * 5000})
        assert response.status_code == 422


class TestAgentsEndpoint:
    def test_list_agents(self, client):
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock) as mock_agents:
            mock_agents.return_value = []
            response = client.get("/api/agents")
            assert response.status_code == 200
            assert isinstance(response.json(), list)

    def test_get_nonexistent_agent_toggle_returns_404(self, client):
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock) as mock_agents:
            mock_agents.return_value = []
            response = client.put("/api/agents/nonexistent/toggle")
            assert response.status_code == 404
