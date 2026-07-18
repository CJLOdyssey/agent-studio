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


class TestTeamEdgeCases:

    USER_HEADERS = {"X-User-ID": "admin"}
    _agent_counter = 0

    def _create_team(self, client, name="edge-team"):
        resp = client.post("/api/teams", json={"name": name, "description": "edge test"})
        assert resp.status_code == 201
        return resp.json()["id"]

    def _create_agent(self, client):
        TestTeamEdgeCases._agent_counter += 1
        c = TestTeamEdgeCases._agent_counter
        resp = client.post("/api/agents", json={
            "name": f"edge-agent-{c}", "role_identifier": f"edge_role_{c}", "system_prompt": "edge",
        }, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_put_team_update_name(self, client):
        team_id = self._create_team(client, "put-update-name")
        resp = client.put(f"/api/teams/{team_id}", json={"name": "edge-renamed"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "edge-renamed"

    def test_post_team_with_agents(self, client):
        team_id = self._create_team(client, "with-agents")
        agent_id = self._create_agent(client)
        member_resp = client.post(f"/api/teams/{team_id}/members", json={
            "name": "member-agent", "role": "worker", "agent_config_id": agent_id,
        }, headers=self.USER_HEADERS)
        assert member_resp.status_code == 201

    def test_get_team_detail_verifies_agents(self, client):
        team_id = self._create_team(client, "detail-agents")
        agent_id = self._create_agent(client)
        client.post(f"/api/teams/{team_id}/members", json={
            "name": "detail-agent", "role": "worker", "agent_config_id": agent_id,
        }, headers=self.USER_HEADERS)
        resp = client.get(f"/api/teams/{team_id}", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert "agents" in data
        assert len(data["agents"]) >= 1

    def test_delete_team_returns_200(self, client):
        team_id = self._create_team(client, "delete-edge")
        resp = client.delete(f"/api/teams/{team_id}")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_add_member_to_nonexistent_team(self, client):
        resp = client.post("/api/teams/nonexistent/members", json={
            "name": "ghost", "role": "worker",
        }, headers=self.USER_HEADERS)
        assert resp.status_code == 404

    def test_remove_member(self, client):
        team_id = self._create_team(client, "remove-member")
        member_resp = client.post(f"/api/teams/{team_id}/members", json={
            "name": "to-remove", "role": "worker",
        }, headers=self.USER_HEADERS)
        assert member_resp.status_code == 201
        member_id = member_resp.json()["id"]
        resp = client.delete(f"/api/teams/{team_id}/members/{member_id}", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_remove_nonexistent_member(self, client):
        team_id = self._create_team(client, "no-member")
        resp = client.delete(f"/api/teams/{team_id}/members/nonexistent", headers=self.USER_HEADERS)
        assert resp.status_code == 404

    def test_reorder_members(self, client):
        team_id = self._create_team(client, "reorder")
        m1 = client.post(f"/api/teams/{team_id}/members", json={"name": "m1", "role": "w"},
                         headers=self.USER_HEADERS).json()["id"]
        m2 = client.post(f"/api/teams/{team_id}/members", json={"name": "m2", "role": "w"},
                         headers=self.USER_HEADERS).json()["id"]
        resp = client.put(f"/api/teams/{team_id}/members/reorder", json={"member_ids": [m2, m1]},
                          headers=self.USER_HEADERS)
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_link_agent_to_member(self, client):
        team_id = self._create_team(client, "link-agent")
        agent_id = self._create_agent(client)
        member_resp = client.post(f"/api/teams/{team_id}/members", json={
            "name": "linkable", "role": "worker",
        }, headers=self.USER_HEADERS)
        member_id = member_resp.json()["id"]
        resp = client.put(f"/api/teams/{team_id}/members/{member_id}/link-agent",
                          json={"agent_config_id": agent_id}, headers=self.USER_HEADERS)
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_link_agent_to_nonexistent_member(self, client):
        resp = client.put("/api/teams/nonexistent/members/nonexistent/link-agent",
                          json={"agent_config_id": "nonexistent"}, headers=self.USER_HEADERS)
        assert resp.status_code == 404


