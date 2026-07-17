import os

os.environ["AUTH_MODE"] = "legacy"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["KEY_VAULT_SECRET"] = "0123456789abcdef0123456789abcdef"
os.environ["AUTH_ENABLED"] = "0"
os.environ["RATE_LIMIT"] = "9999"
os.environ["CHECKPOINTER_BACKEND"] = "memory"
os.environ["DATABASE_POOL_SIZE"] = "0"

from unittest.mock import AsyncMock, patch

import pytest
from starlette.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import virtual_team.database as db_mod

_sqlite_engine = create_async_engine("sqlite+aiosqlite:///:memory:")
db_mod._async_engine = _sqlite_engine
db_mod._async_session_factory = async_sessionmaker(_sqlite_engine, expire_on_commit=False)
db_mod.DATABASE_URL = "sqlite+aiosqlite:///:memory:"

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

    with patch("virtual_team.rate_limit.get_redis", return_value=mock_redis):
        with patch("virtual_team.app_lifespan.get_redis", return_value=mock_redis):
            with TestClient(app) as c:
                yield c


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
