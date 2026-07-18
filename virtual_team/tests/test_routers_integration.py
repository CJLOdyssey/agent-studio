"""Integration tests for FastAPI REST API routes using in-memory SQLite and TestClient."""
import os
from unittest.mock import AsyncMock, patch

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


class TestAgentCRUD:

    USER_HEADERS = {"X-User-ID": "admin"}

    def _create_agent(self, client, name="crud-agent", role="crud_role", prompt="You are a CRUD test agent"):
        payload = {"name": name, "role_identifier": role, "system_prompt": prompt}
        resp = client.post("/api/agents", json=payload, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_agent_create_and_get_by_id(self, client):
        agent_id = self._create_agent(client)
        resp = client.get(f"/api/agents/{agent_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "crud-agent"
        assert data["role_identifier"] == "crud_role"

    def test_agent_update(self, client):
        agent_id = self._create_agent(client, "update-agent", "update_role")
        resp = client.put(f"/api/agents/{agent_id}", json={
            "name": "updated-agent",
            "system_prompt": "Updated prompt",
        }, headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "updated"

        resp = client.get(f"/api/agents/{agent_id}")
        assert resp.json()["name"] == "updated-agent"
        assert resp.json()["system_prompt"] == "Updated prompt"

    def test_agent_delete(self, client):
        agent_id = self._create_agent(client, "delete-agent", "delete_role", "Delete me")
        resp = client.delete(f"/api/agents/{agent_id}", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

        resp = client.get(f"/api/agents/{agent_id}")
        assert resp.status_code == 404

    def test_agent_duplicate_role_returns_409(self, client):
        payload = {"name": "dup-agent", "role_identifier": "dup_role", "system_prompt": "dup"}
        resp = client.post("/api/agents", json=payload, headers=self.USER_HEADERS)
        assert resp.status_code == 201

        resp = client.post("/api/agents", json=payload, headers=self.USER_HEADERS)
        assert resp.status_code == 409

    def test_agent_get_nonexistent_returns_404(self, client):
        resp = client.get("/api/agents/nonexistent-id-99999")
        assert resp.status_code == 404

    def test_agent_update_nonexistent_returns_404(self, client):
        resp = client.put("/api/agents/nonexistent-id-99999", json={"name": "nope"}, headers=self.USER_HEADERS)
        assert resp.status_code == 404

    def test_agent_delete_nonexistent_returns_404(self, client):
        resp = client.delete("/api/agents/nonexistent-id-99999", headers=self.USER_HEADERS)
        assert resp.status_code == 404

    def test_agent_create_empty_body_returns_422(self, client):
        resp = client.post("/api/agents", json={}, headers=self.USER_HEADERS)
        assert resp.status_code == 422

    def test_agent_toggle(self, client):
        agent_id = self._create_agent(client, "toggle-agent", "toggle_role")
        resp = client.put(f"/api/agents/{agent_id}/toggle", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_active"] is False

        resp = client.put(f"/api/agents/{agent_id}/toggle", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True


class TestToolCRUD:

    def _create_tool(self, client, name="test-tool", category="api"):
        payload = {"name": name, "category": category, "description": "A test tool"}
        resp = client.post("/api/tools", json=payload)
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_tool_create(self, client):
        payload = {"name": "test-tool", "category": "api", "description": "A test tool"}
        resp = client.post("/api/tools", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["name"] == "test-tool"

    def test_tool_update(self, client):
        tool_id = self._create_tool(client, "tool-to-update", "api")
        resp = client.put(f"/api/tools/{tool_id}", json={
            "name": "updated-tool",
            "description": "Updated description",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "updated-tool"

    def test_tool_delete(self, client):
        tool_id = self._create_tool(client, "tool-to-delete", "api")
        resp = client.delete(f"/api/tools/{tool_id}")
        assert resp.status_code == 204

    def test_tool_get_nonexistent_returns_404(self, client):
        resp = client.put("/api/tools/nonexistent-id-99999", json={"name": "nope"})
        assert resp.status_code == 404

    def test_tool_delete_nonexistent_returns_404(self, client):
        resp = client.delete("/api/tools/nonexistent-id-99999")
        assert resp.status_code == 404

    def test_tool_create_empty_body_returns_422(self, client):
        resp = client.post("/api/tools", json={})
        assert resp.status_code == 422


class TestTeamCRUD:

    def _create_team(self, client, name="test-team"):
        resp = client.post("/api/teams", json={"name": name, "description": "A test team"})
        assert resp.status_code == 201
        return resp.json()["id"]

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

    def test_team_update(self, client):
        team_id = self._create_team(client, "team-to-update")
        resp = client.put(f"/api/teams/{team_id}", json={"name": "updated-team", "description": "Updated"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "updated-team"
        assert data["description"] == "Updated"

    def test_team_delete(self, client):
        team_id = self._create_team(client, "team-to-delete")
        resp = client.delete(f"/api/teams/{team_id}")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_team_get_nonexistent_returns_404(self, client):
        resp = client.get("/api/teams/nonexistent-id-99999")
        assert resp.status_code == 404

    def test_team_update_nonexistent_returns_404(self, client):
        resp = client.put("/api/teams/nonexistent-id-99999", json={"name": "nope"})
        assert resp.status_code == 404

    def test_team_delete_nonexistent_returns_404(self, client):
        resp = client.delete("/api/teams/nonexistent-id-99999")
        assert resp.status_code == 404

    def test_team_create_empty_body_returns_422(self, client):
        resp = client.post("/api/teams", json={})
        assert resp.status_code == 422


class TestMCPCRUD:

    def _create_mcp(self, client, name="test-mcp"):
        payload = {"name": name, "type": "stdio", "endpoint": "/usr/bin/env"}
        resp = client.post("/api/mcps", json=payload)
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_mcp_create(self, client):
        payload = {"name": "test-mcp", "type": "stdio", "endpoint": "/usr/bin/env"}
        resp = client.post("/api/mcps", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["name"] == "test-mcp"

    def test_mcp_list(self, client):
        self._create_mcp(client, "mcp-for-list")
        resp = client.get("/api/mcps")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_mcp_update(self, client):
        mcp_id = self._create_mcp(client, "mcp-to-update")
        resp = client.put(f"/api/mcps/{mcp_id}", json={"name": "updated-mcp"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "updated-mcp"

    def test_mcp_delete(self, client):
        mcp_id = self._create_mcp(client, "mcp-to-delete")
        resp = client.delete(f"/api/mcps/{mcp_id}")
        assert resp.status_code == 204

    def test_mcp_get_nonexistent_returns_404(self, client):
        resp = client.put("/api/mcps/nonexistent-id-99999", json={"name": "nope"})
        assert resp.status_code == 404

    def test_mcp_delete_nonexistent_returns_404(self, client):
        resp = client.delete("/api/mcps/nonexistent-id-99999")
        assert resp.status_code == 404

    def test_mcp_create_empty_body_returns_422(self, client):
        resp = client.post("/api/mcps", json={})
        assert resp.status_code == 422


class TestSkillCRUD:

    def _create_skill(self, client, name="test-skill", category="general"):
        payload = {"name": name, "category": category, "description": "A test skill"}
        resp = client.post("/api/skills", json=payload)
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_skill_create(self, client):
        payload = {"name": "test-skill", "category": "general", "description": "A test skill"}
        resp = client.post("/api/skills", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["name"] == "test-skill"

    def test_skill_update(self, client):
        skill_id = self._create_skill(client, "skill-to-update")
        resp = client.put(f"/api/skills/{skill_id}", json={"name": "updated-skill", "description": "Updated"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "updated-skill"

    def test_skill_delete(self, client):
        skill_id = self._create_skill(client, "skill-to-delete")
        resp = client.delete(f"/api/skills/{skill_id}")
        assert resp.status_code == 204

    def test_skill_get_nonexistent_returns_404(self, client):
        resp = client.get("/api/skills/nonexistent-id-99999")
        assert resp.status_code == 404

    def test_skill_update_nonexistent_returns_404(self, client):
        resp = client.put("/api/skills/nonexistent-id-99999", json={"name": "nope"})
        assert resp.status_code == 404

    def test_skill_delete_nonexistent_returns_404(self, client):
        resp = client.delete("/api/skills/nonexistent-id-99999")
        assert resp.status_code == 404

    def test_skill_create_empty_body_returns_422(self, client):
        resp = client.post("/api/skills", json={})
        assert resp.status_code == 422


class TestPromptCRUD:

    def _create_prompt(self, client, name="test-prompt", category="general"):
        payload = {"name": name, "category": category, "content": "You are a helpful assistant."}
        resp = client.post("/api/prompts", json=payload)
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_prompt_create(self, client):
        payload = {"name": "test-prompt", "category": "general", "content": "You are a helpful assistant."}
        resp = client.post("/api/prompts", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["name"] == "test-prompt"

    def test_prompt_update(self, client):
        prompt_id = self._create_prompt(client, "prompt-to-update")
        resp = client.put(f"/api/prompts/{prompt_id}", json={"name": "updated-prompt", "content": "Updated content"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "updated-prompt"
        assert data["content"] == "Updated content"

    def test_prompt_delete(self, client):
        prompt_id = self._create_prompt(client, "prompt-to-delete")
        resp = client.delete(f"/api/prompts/{prompt_id}")
        assert resp.status_code == 204

    def test_prompt_get_nonexistent_returns_404(self, client):
        resp = client.put("/api/prompts/nonexistent-id-99999", json={"name": "nope"})
        assert resp.status_code == 404

    def test_prompt_delete_nonexistent_returns_404(self, client):
        resp = client.delete("/api/prompts/nonexistent-id-99999")
        assert resp.status_code == 404

    def test_prompt_create_empty_body_returns_422(self, client):
        resp = client.post("/api/prompts", json={})
        assert resp.status_code == 422


class TestSessionCRUD:

    USER_HEADERS = {"X-User-ID": "admin"}

    def _create_session(self, client, title="test-session"):
        resp = client.post("/api/sessions", json={"title": title}, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        return resp.json()["id"]

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
        session_id = self._create_session(client, "detail-session")
        resp = client.get(f"/api/sessions/{session_id}", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "detail-session"
        assert "runs" in data
        assert "memories" in data

    def test_session_rename(self, client):
        session_id = self._create_session(client, "rename-me")
        resp = client.put(f"/api/sessions/{session_id}", json={"title": "renamed-session"}, headers=self.USER_HEADERS)
        assert resp.status_code == 200
        assert resp.json()["title"] == "renamed-session"

    def test_session_delete(self, client):
        session_id = self._create_session(client, "delete-me")
        resp = client.delete(f"/api/sessions/{session_id}", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

    def test_session_get_nonexistent_returns_404(self, client):
        resp = client.get("/api/sessions/nonexistent-id-99999", headers=self.USER_HEADERS)
        assert resp.status_code == 404

    def test_session_update_nonexistent_returns_404(self, client):
        resp = client.put("/api/sessions/nonexistent-id-99999", json={"title": "nope"}, headers=self.USER_HEADERS)
        assert resp.status_code == 404

    def test_session_delete_nonexistent_returns_404(self, client):
        resp = client.delete("/api/sessions/nonexistent-id-99999", headers=self.USER_HEADERS)
        assert resp.status_code == 404

    def test_session_rename_empty_body_returns_422(self, client):
        resp = client.put("/api/sessions/nonexistent-id", json={}, headers=self.USER_HEADERS)
        assert resp.status_code == 422


class TestKeyCRUD:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_key_create(self, client):
        payload = {
            "provider": "openai",
            "usage_type": "embedding",
            "label": "test-key",
            "api_key": "sk-test-key-value",
        }
        resp = client.post("/api/keys", json=payload, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["provider"] == "openai"

    def test_key_list(self, client):
        resp = client.get("/api/keys", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_key_create_empty_body_returns_422(self, client):
        resp = client.post("/api/keys", json={}, headers=self.USER_HEADERS)
        assert resp.status_code == 422


class TestWorkflowCRUD:

    def _create_workflow_team(self, client, suffix="wf"):
        resp = client.post("/api/teams", json={"name": f"wf-team-{suffix}"})
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_workflow_create(self, client):
        team_id = self._create_workflow_team(client, "create")
        payload = {
            "teamId": team_id,
            "name": "test-workflow",
            "maxRounds": 5,
            "nodes": [],
            "edges": [],
        }
        resp = client.post("/api/workflows", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "test-workflow"

    def test_workflow_list(self, client):
        team_id = self._create_workflow_team(client, "list")
        payload = {
            "teamId": team_id,
            "name": "list-wf",
            "maxRounds": 3,
            "nodes": [],
            "edges": [],
        }
        client.post("/api/workflows", json=payload)
        resp = client.get("/api/workflows")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_workflow_delete(self, client):
        team_id = self._create_workflow_team(client, "del")
        payload = {
            "teamId": team_id,
            "name": "del-wf",
            "maxRounds": 3,
            "nodes": [],
            "edges": [],
        }
        resp = client.post("/api/workflows", json=payload)
        wf_id = resp.json()["id"]
        resp = client.delete(f"/api/workflows/{wf_id}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"


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


class TestTeamRoutes:

    USER_HEADERS = {"X-User-ID": "admin"}

    def _create_team(self, client, name="routes-team"):
        resp = client.post("/api/teams", json={"name": name, "description": "routes test"})
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_create_team_with_agents(self, client):
        team_id = self._create_team(client, "team-with-agents")
        agent_payload = {"name": "team-agent", "role": "worker", "agent_config_id": None}
        resp = client.post(f"/api/teams/{team_id}/members", json=agent_payload, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        resp = client.get(f"/api/teams/{team_id}", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert "agents" in data

    def test_update_team_name(self, client):
        team_id = self._create_team(client, "update-name-team")
        resp = client.put(f"/api/teams/{team_id}", json={"name": "renamed-team"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "renamed-team"

    def test_get_team_agents_populated(self, client):
        team_id = self._create_team(client, "agents-populated")
        agent_payload = {"name": "pop-agent", "role": "worker", "agent_config_id": None}
        client.post(f"/api/teams/{team_id}/members", json=agent_payload, headers=self.USER_HEADERS)
        resp = client.get(f"/api/teams/{team_id}", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert "agents" in data
        if isinstance(data["agents"], list) and len(data["agents"]) > 0:
            assert any(a.get("name") == "pop-agent" for a in data["agents"])

    def test_start_team_run(self, client):
        import virtual_team.routers.runs as runs_router
        from unittest.mock import AsyncMock
        team_id = self._create_team(client, "team-run-test")
        mock_result = {"run_id": "team-run-id-1", "session_id": None, "status": "running"}
        with patch.object(runs_router.run_service, 'create_run', new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_result
            resp = client.post("/api/runs", json={"requirement": "team task", "teamId": team_id}, headers=self.USER_HEADERS)
            assert resp.status_code == 200
            data = resp.json()
            assert data["run_id"] == "team-run-id-1"
            assert data["status"] == "running"
            mock_create.assert_called_once()

    def test_list_team_runs(self, client):
        import virtual_team.routers.runs as runs_router
        from unittest.mock import AsyncMock
        with patch.object(runs_router.run_service, 'list_runs', new_callable=AsyncMock) as mock_list:
            mock_list.return_value = [
                {"id": "team-run-1", "requirement": "team task 1", "status": "converged", "session_id": None},
            ]
            resp = client.get("/api/runs")
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) >= 1


class TestRunRoutes:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_create_run_with_session_id(self, client):
        import virtual_team.routers.runs as runs_router
        from unittest.mock import AsyncMock
        sess = client.post("/api/sessions", json={"title": "run-session"}, headers=self.USER_HEADERS).json()
        mock_result = {"run_id": "test-run-456", "session_id": sess["id"], "status": "running"}
        with patch.object(runs_router.run_service, 'create_run', new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_result
            resp = client.post("/api/runs", json={"requirement": "run with session", "sessionId": sess["id"]}, headers=self.USER_HEADERS)
            assert resp.status_code == 200
            data = resp.json()
            assert data["run_id"] == "test-run-456"
            assert data["session_id"] == sess["id"]
            assert data["status"] == "running"

    def test_list_runs(self, client):
        import virtual_team.routers.runs as runs_router
        from unittest.mock import AsyncMock
        with patch.object(runs_router.run_service, 'list_runs', new_callable=AsyncMock) as mock_list:
            mock_list.return_value = [
                {"id": "list-run-1", "requirement": "test", "status": "converged", "session_id": None},
            ]
            resp = client.get("/api/runs")
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) == 1

    def test_get_run_detail(self, client):
        import virtual_team.routers.runs as runs_router
        from unittest.mock import AsyncMock
        mock_detail = {
            "id": "detail-run-1",
            "session_id": None,
            "requirement": "detail test",
            "pm_document": "",
            "code": "",
            "review": "",
            "approved": False,
            "status": "converged",
            "created_at": "2025-01-01T00:00:00",
            "updated_at": "2025-01-01T00:00:00",
            "messages": [],
        }
        with patch.object(runs_router.run_service, 'get_run', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_detail
            resp = client.get("/api/runs/detail-run-1")
            assert resp.status_code == 200
            data = resp.json()
            assert data["id"] == "detail-run-1"
            assert data["status"] == "converged"
            assert "messages" in data

    def test_get_run_messages(self, client):
        import virtual_team.routers.runs as runs_router
        from unittest.mock import AsyncMock
        mock_detail = {
            "id": "msg-run-1",
            "session_id": None,
            "requirement": "messages test",
            "pm_document": "",
            "code": "",
            "review": "",
            "approved": False,
            "status": "converged",
            "created_at": "2025-01-01T00:00:00",
            "updated_at": "2025-01-01T00:00:00",
            "messages": [
                {"id": "msg-1", "role": "user", "agent_name": "user", "content": "hello", "thinking": None, "round_number": 1, "created_at": "2025-01-01T00:00:00"},
            ],
        }
        with patch.object(runs_router.run_service, 'get_run', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_detail
            resp = client.get("/api/runs/msg-run-1")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["messages"]) == 1
            assert data["messages"][0]["content"] == "hello"
            assert data["messages"][0]["role"] == "user"


class TestDebugEndpoints:

    def test_debug_health(self, client):
        resp = client.get("/api/debug/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "events_stored" in data


class TestPromptVersions:

    USER_HEADERS = {"X-User-ID": "admin"}

    def _create_prompt(self, client, name="vp-prompt"):
        payload = {"name": name, "category": "general", "content": "You are helpful."}
        resp = client.post("/api/prompts", json=payload)
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_create_and_get_prompt(self, client):
        prompt_id = self._create_prompt(client, "versioned-prompt")
        assert prompt_id is not None
        resp = client.get("/api/prompts")
        ids = [p["id"] for p in resp.json()]
        assert prompt_id in ids

    def test_create_version(self, client):
        prompt_id = self._create_prompt(client, "prompt-for-version")
        version_payload = {
            "resource_type": "prompt",
            "resource_id": prompt_id,
            "snapshot": {"name": "v1", "content": "Initial content"},
        }
        resp = client.post("/api/versions", json=version_payload, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        version_data = resp.json()
        assert version_data is not None

    def test_list_versions(self, client):
        prompt_id = self._create_prompt(client, "prompt-for-list-versions")

        for i in range(2):
            client.post("/api/versions", json={
                "resource_type": "prompt",
                "resource_id": prompt_id,
                "snapshot": {"name": f"v{i}", "content": f"content {i}"},
            }, headers=self.USER_HEADERS)

        resp = client.get(f"/api/versions/prompt/{prompt_id}")
        assert resp.status_code == 200
        versions = resp.json()
        assert isinstance(versions, list)

    def test_list_versions_unknown_resource(self, client):
        resp = client.get("/api/versions/prompt/nonexistent-id")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestWorkflows:

    def _create_team(self, client, suffix="ext"):
        resp = client.post("/api/teams", json={"name": f"ext-team-{suffix}", "description": "ext test"})
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_create_workflow_with_nodes_edges(self, client):
        team_id = self._create_team(client, "node-edge-create")

        payload = {
            "teamId": team_id,
            "name": "detailed-wf",
            "maxRounds": 5,
            "nodes": [
                {"id": "n1", "agentConfigId": "ag1", "roleIdentifier": "writer", "strategy": "generator", "order": 0},
                {"id": "n2", "agentConfigId": "ag2", "roleIdentifier": "reviewer", "strategy": "reviewer", "order": 1},
            ],
            "edges": [
                {"fromNodeId": "writer", "toNodeId": "reviewer", "conditionKey": "approved", "isDefault": False},
                {"fromNodeId": "reviewer", "toNodeId": "END", "isDefault": True},
            ],
        }
        resp = client.post("/api/workflows", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "detailed-wf"
        assert len(data["nodes"]) == 2
        assert len(data["edges"]) == 2

    def test_get_workflow_by_team(self, client):
        team_id = self._create_team(client, "get-by-team")
        payload = {"teamId": team_id, "name": "team-wf", "maxRounds": 3, "nodes": [], "edges": []}
        client.post("/api/workflows", json=payload)

        resp = client.get(f"/api/workflows/teams/{team_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "team-wf"

    def test_get_workflow_by_missing_team_returns_404(self, client):
        resp = client.get("/api/workflows/teams/nonexistent-team-id")
        assert resp.status_code == 404

    def test_workflow_delete_not_found(self, client):
        resp = client.delete("/api/workflows/nonexistent-wf-id")
        assert resp.status_code == 404


class TestRunCRUD:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_create_run_with_session_and_agent(self, client):
        import virtual_team.routers.runs as runs_router
        sess = client.post("/api/sessions", json={"title": "run-session"}, headers=self.USER_HEADERS).json()
        mock_result = {"run_id": "crud-run-1", "session_id": sess["id"], "status": "running"}
        with patch.object(runs_router.run_service, 'create_run', new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_result
            resp = client.post("/api/runs", json={
                "requirement": "test requirement", "sessionId": sess["id"], "agentId": "ag-1",
            }, headers=self.USER_HEADERS)
            assert resp.status_code == 200
            data = resp.json()
            assert data["run_id"] == "crud-run-1"
            assert data["session_id"] == sess["id"]

    def test_list_runs_returns_list(self, client):
        import virtual_team.routers.runs as runs_router
        with patch.object(runs_router.run_service, 'list_runs', new_callable=AsyncMock) as mock_list:
            mock_list.return_value = [
                {"id": "r1", "requirement": "req1", "status": "converged", "session_id": None},
            ]
            resp = client.get("/api/runs")
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) == 1

    def test_get_run_detail(self, client):
        import virtual_team.routers.runs as runs_router
        mock_detail = {
            "id": "detail-1", "session_id": None, "requirement": "detail",
            "pm_document": "", "code": "", "review": "", "approved": False,
            "status": "converged", "created_at": "2025-01-01T00:00:00",
            "updated_at": "2025-01-01T00:00:00", "messages": [],
        }
        with patch.object(runs_router.run_service, 'get_run', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_detail
            resp = client.get("/api/runs/detail-1")
            assert resp.status_code == 200
            data = resp.json()
            assert data["id"] == "detail-1"
            assert "messages" in data

    def test_get_run_messages(self, client):
        import virtual_team.routers.runs as runs_router
        mock_detail = {
            "id": "msg-run-1", "session_id": None, "requirement": "msg test",
            "pm_document": "", "code": "", "review": "", "approved": False,
            "status": "converged", "created_at": "2025-01-01T00:00:00",
            "updated_at": "2025-01-01T00:00:00",
            "messages": [
                {"id": "m1", "role": "user", "agent_name": "user", "content": "hello",
                 "thinking": None, "round_number": 1, "created_at": "2025-01-01T00:00:00"},
            ],
        }
        with patch.object(runs_router.run_service, 'get_run', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_detail
            resp = client.get("/api/runs/msg-run-1")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["messages"]) == 1
            assert data["messages"][0]["content"] == "hello"

    def test_run_complete_invalid_session(self, client):
        import virtual_team.routers.run_continue as rc_router
        with patch.object(rc_router.run_service, 'continue_run', new_callable=AsyncMock) as mock_cc:
            mock_cc.side_effect = ValueError("Session not found")
            resp = client.post("/api/runs/complete", json={
                "content": "continue", "session_id": "nonexistent-id",
            }, headers=self.USER_HEADERS)
            assert resp.status_code == 400


class TestSessionEdgeCases:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_list_sessions_returns_list(self, client):
        resp = client.get("/api/sessions", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_create_session_with_agent_id(self, client):
        agent_resp = client.post("/api/agents", json={
            "name": "session-agent", "role_identifier": "sess_role", "system_prompt": "test",
        }, headers=self.USER_HEADERS)
        assert agent_resp.status_code == 201
        agent_id = agent_resp.json()["id"]
        resp = client.post("/api/sessions", json={"title": "agent-session", "agent_id": agent_id}, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "agent-session"

    def test_get_session_memories_structure(self, client):
        sid = client.post("/api/sessions", json={"title": "mem-struct"}, headers=self.USER_HEADERS).json()["id"]
        resp = client.get(f"/api/sessions/{sid}/memories", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


class TestToolEdgeCases:

    def test_create_tool_minimal(self, client):
        resp = client.post("/api/tools", json={"name": "minimal-tool", "category": "api", "description": "minimal"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "minimal-tool"

    def test_create_tool_with_description(self, client):
        resp = client.post("/api/tools", json={
            "name": "desc-tool", "category": "data", "description": "a tool with description",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "desc-tool"

    def test_list_returns_created_tools(self, client):
        client.post("/api/tools", json={"name": "list-tool", "category": "api", "description": "listme"})
        resp = client.get("/api/tools")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        names = [t["name"] for t in data]
        assert "list-tool" in names


class TestPromptEdgeCases:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_create_prompt_with_category(self, client):
        resp = client.post("/api/prompts", json={
            "name": "cat-prompt", "category": "coding", "content": "Write code",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "cat-prompt"

    def test_list_prompts_returns_created(self, client):
        client.post("/api/prompts", json={"name": "list-prompt", "category": "general", "content": "hello"})
        resp = client.get("/api/prompts")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        names = [p["name"] for p in data]
        assert "list-prompt" in names

    def test_create_prompt_version(self, client):
        pid = client.post("/api/prompts", json={
            "name": "version-prompt", "category": "general", "content": "v0",
        }).json()["id"]
        resp = client.post("/api/versions", json={
            "resource_type": "prompt", "resource_id": pid,
            "snapshot": {"name": "v1", "content": "v1 content"},
        }, headers=self.USER_HEADERS)
        assert resp.status_code == 201

    def test_list_prompt_versions(self, client):
        pid = client.post("/api/prompts", json={
            "name": "list-ver-prompt", "category": "general", "content": "base",
        }).json()["id"]
        client.post("/api/versions", json={
            "resource_type": "prompt", "resource_id": pid,
            "snapshot": {"name": "v1", "content": "v1"},
        }, headers=self.USER_HEADERS)
        resp = client.get(f"/api/versions/prompt/{pid}")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


class TestKeyEdgeCases:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_create_key(self, client):
        resp = client.post("/api/keys", json={
            "provider": "custom", "usage_type": "embedding", "label": "test-key-edge",
            "api_key": "sk-test-key-val",
        }, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["provider"] == "custom"

    def test_update_key_label(self, client):
        created = client.post("/api/keys", json={
            "provider": "openai", "usage_type": "embedding", "label": "old-label",
            "api_key": "sk-old-key",
        }, headers=self.USER_HEADERS).json()
        resp = client.put(f"/api/keys/{created['id']}", json={"label": "new-label"}, headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["label"] == "new-label"

    def test_get_keys_has_masked_key(self, client):
        client.post("/api/keys", json={
            "provider": "anthropic", "usage_type": "embedding", "label": "masked-test",
            "api_key": "sk-anthropic-secret",
        }, headers=self.USER_HEADERS)
        resp = client.get("/api/keys", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        for k in data:
            assert "key_masked" in k
            assert k["key_masked"] != "sk-anthropic-secret"
            assert "..." in k["key_masked"]


class TestRunRoutesExtended:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_create_run_requirement_too_long(self, client):
        import virtual_team.routers.runs as runs_router
        with patch.object(runs_router, 'load_config') as mock_cfg:
            mock_cfg.return_value.max_requirement_length = 5
            resp = client.post("/api/runs", json={"requirement": "way too long requirement"}, headers=self.USER_HEADERS)
            assert resp.status_code == 400

    def test_create_run_empty_after_strip(self, client):
        resp = client.post("/api/runs", json={"requirement": "   "}, headers=self.USER_HEADERS)
        assert resp.status_code == 400

    def test_create_run_value_error(self, client):
        import virtual_team.routers.runs as runs_router
        with patch.object(runs_router.run_service, 'create_run', new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = ValueError("invalid session")
            resp = client.post("/api/runs", json={"requirement": "valid req"}, headers=self.USER_HEADERS)
            assert resp.status_code == 400

    def test_create_run_http_exception_re_raised(self, client):
        import virtual_team.routers.runs as runs_router
        from fastapi import HTTPException
        with patch.object(runs_router.run_service, 'create_run', new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = HTTPException(status_code=409, detail="conflict")
            resp = client.post("/api/runs", json={"requirement": "valid req"}, headers=self.USER_HEADERS)
            assert resp.status_code == 409

    def test_create_run_internal_error(self, client):
        import virtual_team.routers.runs as runs_router
        with patch.object(runs_router.run_service, 'create_run', new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = RuntimeError("unexpected")
            resp = client.post("/api/runs", json={"requirement": "valid req"}, headers=self.USER_HEADERS)
            assert resp.status_code == 500

    def test_get_run_not_found(self, client):
        import virtual_team.routers.runs as runs_router
        with patch.object(runs_router.run_service, 'get_run', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None
            resp = client.get("/api/runs/nonexistent-id")
            assert resp.status_code == 404

    def test_get_run_http_exception_re_raised(self, client):
        import virtual_team.routers.runs as runs_router
        from fastapi import HTTPException
        with patch.object(runs_router.run_service, 'get_run', new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = HTTPException(status_code=410, detail="gone")
            resp = client.get("/api/runs/some-id")
            assert resp.status_code == 410

    def test_get_run_internal_error(self, client):
        import virtual_team.routers.runs as runs_router
        with patch.object(runs_router.run_service, 'get_run', new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = RuntimeError("db error")
            resp = client.get("/api/runs/some-id")
            assert resp.status_code == 500

    def test_list_runs_internal_error(self, client):
        import virtual_team.routers.runs as runs_router
        with patch.object(runs_router.run_service, 'list_runs', new_callable=AsyncMock) as mock_list:
            mock_list.side_effect = RuntimeError("list failed")
            resp = client.get("/api/runs")
            assert resp.status_code == 500


class TestRunContinue:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_complete_run_success(self, client):
        import virtual_team.routers.run_continue as rc_router
        mock_result = {"run_id": "continue-run-1", "session_id": "sess-1", "status": "running"}
        with patch.object(rc_router.run_service, 'continue_run', new_callable=AsyncMock) as mock_cc:
            mock_cc.return_value = mock_result
            resp = client.post("/api/runs/complete", json={"content": "continue", "session_id": "sess-1"}, headers=self.USER_HEADERS)
            assert resp.status_code == 200
            data = resp.json()
            assert data["run_id"] == "continue-run-1"
            assert data["status"] == "running"

    def test_complete_run_value_error(self, client):
        import virtual_team.routers.run_continue as rc_router
        with patch.object(rc_router.run_service, 'continue_run', new_callable=AsyncMock) as mock_cc:
            mock_cc.side_effect = ValueError("Session not found")
            resp = client.post("/api/runs/complete", json={"content": "x", "session_id": "bad"}, headers=self.USER_HEADERS)
            assert resp.status_code == 400

    def test_complete_run_http_exception_re_raised(self, client):
        import virtual_team.routers.run_continue as rc_router
        from fastapi import HTTPException
        with patch.object(rc_router.run_service, 'continue_run', new_callable=AsyncMock) as mock_cc:
            mock_cc.side_effect = HTTPException(status_code=409, detail="conflict")
            resp = client.post("/api/runs/complete", json={"content": "x"}, headers=self.USER_HEADERS)
            assert resp.status_code == 409

    def test_complete_run_internal_error(self, client):
        import virtual_team.routers.run_continue as rc_router
        with patch.object(rc_router.run_service, 'continue_run', new_callable=AsyncMock) as mock_cc:
            mock_cc.side_effect = RuntimeError("crash")
            resp = client.post("/api/runs/complete", json={"content": "x"}, headers=self.USER_HEADERS)
            assert resp.status_code == 500


class TestSkillCreateAndVerify:

    def test_skill_create_and_list(self, client):
        payload = {"name": "verify-skill", "category": "general", "description": "Verify skill test"}
        resp = client.post("/api/skills", json=payload)
        assert resp.status_code == 201
        skill_id = resp.json()["id"]
        assert skill_id is not None

        resp = client.get("/api/skills")
        assert resp.status_code == 200
        ids = [s["id"] for s in resp.json()]
        assert skill_id in ids

    def test_skill_update_name(self, client):
        payload = {"name": "update-skill", "category": "general", "description": "Update test"}
        resp = client.post("/api/skills", json=payload)
        skill_id = resp.json()["id"]

        resp = client.put(f"/api/skills/{skill_id}", json={"name": "updated-skill-name"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "updated-skill-name"

    def test_skill_get_nonexistent(self, client):
        resp = client.get("/api/skills/nonexistent-id")
        assert resp.status_code == 404

    def test_skill_update_nonexistent(self, client):
        resp = client.put("/api/skills/nonexistent-id", json={"name": "nope"})
        assert resp.status_code == 404

    def test_skill_delete_nonexistent(self, client):
        resp = client.delete("/api/skills/nonexistent-id")
        assert resp.status_code == 404


class TestSkillErrorHandling:

    def test_list_skills_exception(self, client):
        import virtual_team.routers.skills as skills_router
        with patch.object(skills_router, 'repo_get_skills_as_dicts', new_callable=AsyncMock) as mock_list:
            mock_list.side_effect = RuntimeError("list failed")
            resp = client.get("/api/skills")
            assert resp.status_code == 500

    def test_get_skill_exception(self, client):
        import virtual_team.routers.skills as skills_router
        with patch.object(skills_router, 'repo_get_skills', new_callable=AsyncMock) as mock_get_skills:
            mock_get_skills.side_effect = RuntimeError("get skills failed")
            resp = client.get("/api/skills/some-id")
            assert resp.status_code == 500

    def test_create_skill_exception(self, client):
        import virtual_team.routers.skills as skills_router
        with patch.object(skills_router, 'repo_create_skill', new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = RuntimeError("create failed")
            resp = client.post("/api/skills", json={"name": "fail", "category": "general", "description": "fail"})
            assert resp.status_code == 500

    def test_update_skill_exception(self, client):
        import virtual_team.routers.skills as skills_router
        payload = {"name": "update-exc", "category": "general", "description": "update exc"}
        resp = client.post("/api/skills", json=payload)
        skill_id = resp.json()["id"]
        with patch.object(skills_router, 'update_skill', new_callable=AsyncMock) as mock_update:
            mock_update.side_effect = RuntimeError("update failed")
            resp = client.put(f"/api/skills/{skill_id}", json={"name": "new-name"})
            assert resp.status_code == 500

    def test_delete_skill_exception(self, client):
        import virtual_team.routers.skills as skills_router
        payload = {"name": "delete-exc", "category": "general", "description": "delete exc"}
        resp = client.post("/api/skills", json=payload)
        skill_id = resp.json()["id"]
        with patch.object(skills_router, 'delete_skill', new_callable=AsyncMock) as mock_delete:
            mock_delete.side_effect = RuntimeError("delete failed")
            resp = client.delete(f"/api/skills/{skill_id}")
            assert resp.status_code == 500


class TestWorkflowRoutes:

    def _create_team(self, client, suffix="wfr"):
        resp = client.post("/api/teams", json={"name": f"wfr-team-{suffix}", "description": "wfr"})
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_create_workflow_with_nodes_edges(self, client):
        team_id = self._create_team(client, "nodes-edges")
        payload = {
            "teamId": team_id,
            "name": "wf-nodes-edges",
            "maxRounds": 5,
            "nodes": [
                {"agentConfigId": "ag1", "roleIdentifier": "writer", "strategy": "generator", "order": 0},
                {"agentConfigId": "ag2", "roleIdentifier": "reviewer", "strategy": "reviewer", "order": 1},
            ],
            "edges": [
                {"fromNodeId": "writer", "toNodeId": "reviewer"},
                {"fromNodeId": "reviewer", "toNodeId": "END"},
            ],
        }
        resp = client.post("/api/workflows", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "wf-nodes-edges"
        assert len(data["nodes"]) == 2
        assert len(data["edges"]) == 2

    def test_list_workflows(self, client):
        resp = client.get("/api/workflows")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_delete_workflow(self, client):
        team_id = self._create_team(client, "delete-wf")
        payload = {"teamId": team_id, "name": "delete-wf", "maxRounds": 3, "nodes": [], "edges": []}
        resp = client.post("/api/workflows", json=payload)
        wf_id = resp.json()["id"]
        resp = client.delete(f"/api/workflows/{wf_id}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

    def test_delete_workflow_not_found(self, client):
        resp = client.delete("/api/workflows/nonexistent")
        assert resp.status_code == 404
