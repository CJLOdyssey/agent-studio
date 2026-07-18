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


class TestAgentRoutes:

    def test_list_agents_empty(self, client):
        resp = client.get("/api/agents")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_and_list_agents(self, client):
        resp = client.post(
            "/api/agents",
            json={
                "name": "test-agent",
                "role_identifier": "role_a",
                "system_prompt": "You are a test agent",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["status"] == "created"
        agent_id = data["id"]

        resp = client.get("/api/agents")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        agent = next(a for a in data if a["id"] == agent_id)
        assert agent["name"] == "test-agent"
        assert agent["role_identifier"] == "role_a"

    def test_create_agent_duplicate_role(self, client):
        client.post(
            "/api/agents",
            json={
                "name": "dup-agent",
                "role_identifier": "dup_role",
                "system_prompt": "test",
            },
        )
        resp = client.post(
            "/api/agents",
            json={
                "name": "dup-agent-2",
                "role_identifier": "dup_role",
                "system_prompt": "test",
            },
        )
        assert resp.status_code == 409

    def test_update_agent_skills(self, client):
        resp = client.post(
            "/api/agents",
            json={
                "name": "update-agent",
                "role_identifier": "role_update",
                "system_prompt": "test",
            },
        )
        agent_id = resp.json()["id"]
        resp = client.put(
            f"/api/agents/{agent_id}",
            json={"skills": [{"name": "python", "version": "3.12"}]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "updated"

    def test_update_agent_not_found(self, client):
        resp = client.put(
            "/api/agents/nonexistent",
            json={"name": "ghost"},
        )
        assert resp.status_code == 404

    def test_get_agent_versions(self, client):
        resp = client.post(
            "/api/agents",
            json={
                "name": "version-agent",
                "role_identifier": "role_ver",
                "system_prompt": "test",
            },
        )
        agent_id = resp.json()["id"]
        resp = client.get(f"/api/versions/agent/{agent_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_get_agent_not_found(self, client):
        resp = client.get("/api/agents/nonexistent-id")
        assert resp.status_code == 404

    def test_delete_agent(self, client):
        resp = client.post(
            "/api/agents",
            json={
                "name": "delete-agent",
                "role_identifier": "role_del",
                "system_prompt": "test",
            },
        )
        agent_id = resp.json()["id"]
        resp = client.delete(f"/api/agents/{agent_id}")
        assert resp.status_code == 200
        resp = client.get(f"/api/agents/{agent_id}")
        assert resp.status_code == 404

    def test_toggle_agent(self, client):
        resp = client.post(
            "/api/agents",
            json={
                "name": "toggle-agent",
                "role_identifier": "role_toggle",
                "system_prompt": "test",
            },
        )
        agent_id = resp.json()["id"]
        resp = client.put(f"/api/agents/{agent_id}/toggle")
        assert resp.status_code == 200


class TestAgentListDetail:

    def test_list_agents_has_elements(self, client):
        client.post("/api/agents", json={
            "name": "list-test-agent", "role_identifier": "list_role", "system_prompt": "test",
        })
        resp = client.get("/api/agents")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        names = [a["name"] for a in data]
        assert "list-test-agent" in names

    def test_agent_validate(self, client):
        resp = client.post("/api/tools/validate", json={
            "code": "def hello():\n    return 'world'", "language": "python",
        })
        assert resp.status_code == 200
        assert "is_valid" in resp.json()
"""Tests for key management API routes using in-memory SQLite and TestClient."""
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


