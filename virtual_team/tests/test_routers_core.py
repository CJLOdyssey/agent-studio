"""Integration tests for FastAPI REST API routes using in-memory SQLite and TestClient."""
import io
import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.testclient import TestClient

os.environ['AUTH_MODE'] = 'legacy'
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///:memory:'
os.environ['REDIS_URL'] = 'redis://localhost:6379/0'
os.environ['KEY_VAULT_SECRET'] = '0123456789abcdef0123456789abcdef'
os.environ['AUTH_ENABLED'] = '0'
os.environ['RATE_LIMIT'] = '9999'
os.environ['CHECKPOINTER_BACKEND'] = 'memory'
os.environ['DATABASE_POOL_SIZE'] = '0'
os.environ['UPLOAD_DIR'] = '/tmp/test_uploads'

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import virtual_team.database as db_mod

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
        assert resp.status_code == 201
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
        assert resp.status_code == 200
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

    def test_admin_logs(self, client):
        resp = client.get("/api/admin/logs")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_admin_activity(self, client):
        resp = client.get("/api/admin/activity")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_tool_plugins_list(self, client):
        resp = client.get("/api/tools/plugins")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestDebugEndpoints:

    def test_debug_health(self, client):
        resp = client.get("/api/debug/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "events_stored" in data


class TestMiscRoutes:

    def test_provider_test(self, client):
        resp = client.post("/api/providers/test", json={"provider": "openai"})
        assert resp.status_code == 200

    def test_attachment_upload(self, client):
        session_resp = client.post("/api/sessions", json={"title": "misc-att"}, headers={"X-User-ID": "admin"})
        assert session_resp.status_code == 201
        session_id = session_resp.json()["id"]
        resp = client.post(
            "/api/attachments",
            files={"file": ("quick.txt", io.BytesIO(b"quick data"), "text/plain")},
            data={"session_id": session_id},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["filename"] == "quick.txt"


class TestGapCloser:
    def test_team_404(self, c): assert c.get("/api/teams/nonexistent-id").status_code == 404
    def test_tool_val(self, c): assert c.post("/api/tools/validate", json={"code":"def f():pass","language":"python"}).status_code == 200
    def test_sess_404(self, c): assert c.get("/api/sessions/nonexistent-id").status_code == 404
    def test_skill_404(self, c): assert c.get("/api/skills/nonexistent-id").status_code == 404
    def test_agent_404(self, c): assert c.get("/api/agents/nonexistent-id").status_code == 404
    def test_run_404(self, c): assert c.get("/api/runs/nonexistent-id").status_code == 404
    def test_cmd_list(self, c): assert c.get("/api/commands").status_code == 200
    def test_prov_list(self, c): assert c.get("/api/providers").status_code == 200
    def test_sess_create(self, c): assert c.post("/api/sessions", json={"name":"s"}).status_code == 201
    def test_mcp_create(self, c): assert c.post("/api/mcps", json={"name":"m","server_type":"stdio","command":"echo"}).status_code == 201


class TestGapCloser2:
