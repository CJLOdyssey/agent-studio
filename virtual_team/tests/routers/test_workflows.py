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
os.environ['UPLOAD_DIR'] = '/tmp/test_uploads'

import virtual_team.database as db_mod
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

_sqlite_engine = create_async_engine('sqlite+aiosqlite:///:memory:')
db_mod._async_engine = _sqlite_engine
db_mod._async_session_factory = async_sessionmaker(_sqlite_engine, expire_on_commit=False)
db_mod.DATABASE_URL = 'sqlite+aiosqlite:///:memory:'

from virtual_team.core.app import app
from virtual_team.core.base import Base


@pytest.fixture
def client():
    from virtual_team import app_lifespan as lifespan_mod

    async def _safe_init_db():
        engine = db_mod.get_async_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        from virtual_team.core.seed import seed_default_roles_and_admin
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

    def test_workflow_create(self, client):
        team_id = self._create_team(client, "quick-create")
        payload = {"teamId": team_id, "name": "quick-wf", "maxRounds": 3, "nodes": [], "edges": []}
        resp = client.post("/api/workflows", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "quick-wf"
        assert "id" in data


