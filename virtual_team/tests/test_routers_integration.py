"""Integration tests for FastAPI REST API routes using in-memory SQLite and TestClient."""
import json
import os
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
import pytest

os.environ['AUTH_MODE'] = 'legacy'
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///:memory:'
os.environ['REDIS_URL'] = 'redis://localhost:6379/0'
os.environ['KEY_VAULT_SECRET'] = '0123456789abcdef0123456789abcdef'
os.environ['AUTH_ENABLED'] = '0'
os.environ['RATE_LIMIT'] = '9999'
os.environ['CHECKPOINTER_BACKEND'] = 'memory'
os.environ['DATABASE_POOL_SIZE'] = '0'

import virtual_team.database as db_mod
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

_sqlite_engine = create_async_engine('sqlite+aiosqlite:///:memory:')
db_mod._async_engine = _sqlite_engine
db_mod._async_session_factory = async_sessionmaker(_sqlite_engine, expire_on_commit=False)
db_mod.DATABASE_URL = 'sqlite+aiosqlite:///:memory:'

from virtual_team.app import app
from virtual_team.base import Base


@pytest.fixture
def client():
    from virtual_team import app_lifespan as lifespan_mod

    async def _safe_init_db():
        engine = db_mod.get_async_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        from virtual_team.seed import seed_default_roles_and_admin
        await seed_default_roles_and_admin()

    lifespan_mod.init_db = _safe_init_db

    mock_redis = AsyncMock()
    mock_redis.incr.return_value = 1
    mock_redis.expire.return_value = True
    mock_redis.ping.return_value = True
    mock_redis.publish.return_value = 1

    with patch('virtual_team.rate_limit.get_redis', return_value=mock_redis):
        with patch('virtual_team.app_lifespan.get_redis', return_value=mock_redis):
            with TestClient(app) as c:
                yield c


class TestApiEndpoints:

    def test_health_check(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_version_endpoint(self, client):
        resp = client.get("/api/version")
        assert resp.status_code == 200
        assert "version" in resp.json()

    def test_metrics_endpoint(self, client):
        resp = client.get("/api/metrics")
        assert resp.status_code == 200

    def test_models_list(self, client):
        resp = client.get("/api/models")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_admin_stats(self, client):
        resp = client.get("/api/admin/stats")
        assert resp.status_code == 200
        data = resp.json()
        for key in ("agents", "prompts", "tools", "mcps", "skills", "teams", "logs_today"):
            assert key in data

    def test_agents_list_empty(self, client):
        resp = client.get("/api/agents")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_and_list_agents(self, client):
        payload = {
            "name": "test-agent",
            "role_identifier": "test_role",
            "system_prompt": "You are a test agent",
        }
        resp = client.post("/api/agents", json=payload)
        assert resp.status_code == 201, f"Create failed: {resp.text}"
        created = resp.json()
        assert "id" in created
        assert created.get("status") == "created"

        resp = client.get("/api/agents")
        assert resp.status_code == 200
        ids = [a["id"] for a in resp.json()]
        assert created["id"] in ids

    def test_tools_list(self, client):
        resp = client.get("/api/tools")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_tools_validate(self, client):
        payload = {"code": "def hello():\n    return 'world'", "language": "python"}
        resp = client.post("/api/tools/validate", json=payload)
        assert resp.status_code == 200, f"Validate failed: {resp.text}"
        assert "is_valid" in resp.json()

    def test_skills_list(self, client):
        resp = client.get("/api/skills")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_mcps_list(self, client):
        resp = client.get("/api/mcps")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_teams_list(self, client):
        resp = client.get("/api/teams")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_prompts_list(self, client):
        resp = client.get("/api/prompts")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_providers_list(self, client):
        resp = client.get("/api/providers")
        assert resp.status_code == 200
        data = resp.json()
        assert "openai" in data

    def test_versions_list(self, client):
        resp = client.get("/api/versions/agent/test-nonexistent")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_keys_list(self, client):
        resp = client.get("/api/keys")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_commands_list(self, client):
        resp = client.get("/api/commands")
        assert resp.status_code == 200
        cmds = resp.json()
        assert isinstance(cmds, list)
        assert len(cmds) > 0

    def test_workflows_list(self, client):
        resp = client.get("/api/workflows")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestAgentCRUD:

    def test_agent_create_and_get_by_id(self, client):
        payload = {
            "name": "crud-agent",
            "role_identifier": "crud_role",
            "system_prompt": "You are a CRUD test agent",
        }
        resp = client.post("/api/agents", json=payload)
        assert resp.status_code == 201
        agent_id = resp.json()["id"]

        resp = client.get(f"/api/agents/{agent_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "crud-agent"
        assert data["role_identifier"] == "crud_role"
        assert data["system_prompt"] == "You are a CRUD test agent"

    def test_agent_update(self, client):
        payload = {
            "name": "update-agent",
            "role_identifier": "update_role",
            "system_prompt": "Original prompt",
        }
        resp = client.post("/api/agents", json=payload)
        agent_id = resp.json()["id"]

        resp = client.put(f"/api/agents/{agent_id}", json={
            "name": "updated-agent",
            "system_prompt": "Updated prompt",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "updated"

        resp = client.get(f"/api/agents/{agent_id}")
        assert resp.json()["name"] == "updated-agent"
        assert resp.json()["system_prompt"] == "Updated prompt"

    def test_agent_delete(self, client):
        payload = {
            "name": "delete-agent",
            "role_identifier": "delete_role",
            "system_prompt": "Delete me",
        }
        resp = client.post("/api/agents", json=payload)
        agent_id = resp.json()["id"]

        resp = client.delete(f"/api/agents/{agent_id}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

        resp = client.get(f"/api/agents/{agent_id}")
        assert resp.status_code == 404


class TestToolCRUD:

    def test_tool_create(self, client):
        payload = {
            "name": "test-tool",
            "category": "api",
            "description": "A test tool",
        }
        resp = client.post("/api/tools", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["name"] == "test-tool"

    def test_tool_update(self, client):
        payload = {
            "name": "tool-to-update",
            "category": "api",
            "description": "Original description",
        }
        resp = client.post("/api/tools", json=payload)
        tool_id = resp.json()["id"]

        resp = client.put(f"/api/tools/{tool_id}", json={
            "name": "updated-tool",
            "description": "Updated description",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "updated-tool"

    def test_tool_delete(self, client):
        payload = {
            "name": "tool-to-delete",
            "category": "api",
        }
        resp = client.post("/api/tools", json=payload)
        tool_id = resp.json()["id"]

        resp = client.delete(f"/api/tools/{tool_id}")
        assert resp.status_code == 204


class TestTeamCRUD:

    def test_team_create_and_get(self, client):
        payload = {"name": "test-team", "description": "A test team"}
        resp = client.post("/api/teams", json=payload)
        assert resp.status_code == 201
        team_id = resp.json()["id"]

        resp = client.get(f"/api/teams/{team_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "test-team"
        assert data.get("description") == "A test team"

    def test_team_delete(self, client):
        payload = {"name": "team-to-delete"}
        resp = client.post("/api/teams", json=payload)
        team_id = resp.json()["id"]

        resp = client.delete(f"/api/teams/{team_id}")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


class TestSessionCRUD:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_session_create_and_list(self, client):
        resp = client.post("/api/sessions", json={"title": "test-session"}, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        session_id = resp.json()["id"]
        assert resp.json()["title"] == "test-session"

        resp = client.get("/api/sessions", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        ids = [s["id"] for s in resp.json()]
        assert session_id in ids

    def test_session_detail(self, client):
        resp = client.post("/api/sessions", json={"title": "detail-session"}, headers=self.USER_HEADERS)
        session_id = resp.json()["id"]

        resp = client.get(f"/api/sessions/{session_id}", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "detail-session"
        assert "runs" in data
        assert "memories" in data


class TestRunBasic:

    def test_create_run(self, client):
        import virtual_team.routers.runs as runs_router

        mock_result = {
            "run_id": "test-run-id-123",
            "session_id": "test-session-id-456",
            "status": "running",
        }
        with patch.object(runs_router.run_service, 'create_run', new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_result
            resp = client.post("/api/runs", json={"requirement": "test requirement"}, headers={"X-User-ID": "admin"})
            assert resp.status_code == 200
            data = resp.json()
            assert data["run_id"] == "test-run-id-123"
            assert data["status"] == "running"
            assert data["session_id"] == "test-session-id-456"

    def test_list_runs(self, client):
        import virtual_team.routers.runs as runs_router

        with patch.object(runs_router.run_service, 'list_runs', new_callable=AsyncMock) as mock_list:
            mock_list.return_value = [
                {"id": "run-1", "requirement": "test 1", "status": "converged"},
                {"id": "run-2", "requirement": "test 2", "status": "running"},
            ]
            resp = client.get("/api/runs")
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) == 2
            assert data[0]["id"] == "run-1"


class TestDebugEndpoints:

    def test_debug_health(self, client):
        resp = client.get("/api/debug/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "events_stored" in data


class TestErrorCases:

    def test_get_nonexistent_agent_returns_404(self, client):
        resp = client.get("/api/agents/nonexistent-id-12345")
        assert resp.status_code == 404

    def test_delete_nonexistent_agent_returns_404(self, client):
        resp = client.delete("/api/agents/nonexistent-id-12345")
        assert resp.status_code == 404

    def test_create_agent_empty_body_returns_422(self, client):
        resp = client.post("/api/agents", json={})
        assert resp.status_code == 422
