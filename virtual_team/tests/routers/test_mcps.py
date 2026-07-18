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


class TestMcpEdgeCases:

    def _create_mcp(self, client, name="mcp-edge"):
        resp = client.post("/api/mcps", json={"name": name, "type": "stdio", "endpoint": "/usr/bin/env"})
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_post_mcp_test_returns_200(self, client):
        mcp_id = self._create_mcp(client, "mcp-test-me")
        resp = client.post(f"/api/mcps/{mcp_id}/test")
        assert resp.status_code == 200
        data = resp.json()
        assert "success" in data

    def test_put_mcp_update(self, client):
        mcp_id = self._create_mcp(client, "mcp-put-update")
        resp = client.put(f"/api/mcps/{mcp_id}", json={"name": "mcp-edge-updated", "type": "sse"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "mcp-edge-updated"

    def test_get_mcp_detail(self, client):
        mcp_id = self._create_mcp(client, "mcp-get-detail")
        resp = client.get("/api/mcps")
        assert resp.status_code == 200
        data = resp.json()
        ids = [m["id"] for m in data]
        assert mcp_id in ids

    def test_test_mcp_not_found(self, client):
        resp = client.post("/api/mcps/nonexistent/test")
        assert resp.status_code == 404

    def test_delete_mcp_twice(self, client):
        mcp_id = self._create_mcp(client, "mcp-del-twice")
        resp = client.delete(f"/api/mcps/{mcp_id}")
        assert resp.status_code == 204
        resp = client.delete(f"/api/mcps/{mcp_id}")
        assert resp.status_code == 404


class TestMcpRoutes:

    def test_list_mcps_empty(self, client):
        resp = client.get("/api/mcps")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_mcp(self, client):
        resp = client.post(
            "/api/mcps",
            json={"name": "test-mcp", "type": "stdio", "endpoint": "/usr/bin/python"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "test-mcp"
        assert data["type"] == "stdio"
        assert data["endpoint"] == "/usr/bin/python"
        assert "id" in data
        assert "created_at" in data

    def test_create_and_list_mcps(self, client):
        created = client.post(
            "/api/mcps",
            json={"name": "list-mcp", "type": "sse", "endpoint": "http://localhost:9090"},
        ).json()
        resp = client.get("/api/mcps")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        ids = [m["id"] for m in data]
        assert created["id"] in ids

    def test_update_mcp_config(self, client):
        created = client.post(
            "/api/mcps",
            json={"name": "update-mcp", "type": "stdio", "endpoint": "/bin/echo"},
        ).json()
        resp = client.put(
            f"/api/mcps/{created['id']}",
            json={"name": "updated-mcp", "config": '{"key": "value"}'},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "updated-mcp"

    def test_update_mcp_not_found(self, client):
        resp = client.put(
            "/api/mcps/nonexistent",
            json={"name": "ghost"},
        )
        assert resp.status_code == 404

    def test_delete_mcp(self, client):
        created = client.post(
            "/api/mcps",
            json={"name": "delete-mcp", "type": "stdio", "endpoint": "/bin/ls"},
        ).json()
        resp = client.delete(f"/api/mcps/{created['id']}")
        assert resp.status_code == 204

    def test_delete_mcp_not_found(self, client):
        resp = client.delete("/api/mcps/nonexistent")
        assert resp.status_code == 404

    def test_test_mcp_connection(self, client):
        created = client.post(
            "/api/mcps",
            json={"name": "test-conn-mcp", "type": "stdio", "endpoint": "echo"},
        ).json()
        resp = client.post(f"/api/mcps/{created['id']}/test")
        assert resp.status_code == 200
        data = resp.json()
        assert "success" in data
        assert "message" in data

    def test_test_mcp_connection_verify_response(self, client):
        created = client.post(
            "/api/mcps",
            json={"name": "conn-verify", "type": "stdio", "endpoint": "echo"},
        ).json()
        resp = client.post(f"/api/mcps/{created['id']}/test")
        assert resp.status_code == 200
        data = resp.json()
        assert "success" in data
        assert "message" in data
        assert "duration_ms" in data

    def test_update_mcp_with_valid_body(self, client):
        created = client.post(
            "/api/mcps",
            json={"name": "valid-update", "type": "stdio", "endpoint": "/bin/ls"},
        ).json()
        resp = client.put(f"/api/mcps/{created['id']}", json={"name": "valid-updated", "endpoint": "/bin/pwd"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "valid-updated"
        assert data["endpoint"] == "/bin/pwd"

    def test_create_mcp_with_type_sse(self, client):
        resp = client.post(
            "/api/mcps",
            json={"name": "sse-server", "type": "sse", "endpoint": "http://localhost:9090"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["type"] == "sse"
        assert data["name"] == "sse-server"
"""Tests for version management API routes using in-memory SQLite and TestClient."""
import os

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


