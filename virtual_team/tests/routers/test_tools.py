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


class TestToolFullCRUD:

    def _create_tool(self, client, name="fullcrud-tool", category="api"):
        resp = client.post("/api/tools", json={"name": name, "category": category, "description": "fullcrud"})
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_put_tool_valid_payload(self, client):
        tool_id = self._create_tool(client, "put-valid-tool")
        resp = client.put(f"/api/tools/{tool_id}", json={
            "name": "updated-put", "category": "data", "description": "updated desc",
            "status": "inactive", "version": "v2.0.0",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "updated-put"

    def test_put_tool_name_and_description(self, client):
        tool_id = self._create_tool(client, "put-nd-tool")
        resp = client.put(f"/api/tools/{tool_id}", json={
            "name": "nd-updated", "description": "just name and desc",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "nd-updated"

    def test_put_tool_not_found(self, client):
        resp = client.put("/api/tools/99999", json={"name": "ghost"})
        assert resp.status_code == 404

    def test_post_tool_execute_endpoint(self, client):
        resp = client.post("/api/tools/execute?code=print('hi')&language=python")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True

    def test_post_tool_execute_with_syntax_error(self, client):
        resp = client.post("/api/tools/execute", params={"code": "def broken(", "language": "python"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False

    def test_post_tool_validate_invalid_code(self, client):
        resp = client.post("/api/tools/validate", json={
            "code": "this is not python code @@@", "language": "python",
        })
        assert resp.status_code == 200
        assert "is_valid" in resp.json()

    def test_post_tool_test_endpoint_no_endpoint(self, client):
        tool_id = self._create_tool(client, "test-no-endpoint")
        resp = client.post(f"/api/tools/{tool_id}/test")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "No endpoint configured" in data["message"]

    def test_post_tool_test_with_endpoint(self, client):
        import virtual_team.routers.tools as tools_router
        tool_id = self._create_tool(client, "test-with-endpoint")
        client.put(f"/api/tools/{tool_id}", json={"endpoint": "http://localhost:19999/test", "method": "GET"})
        with patch.object(tools_router.httpx, 'AsyncClient') as mock_ac:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.text = "ok"
            mock_ac.return_value.__aenter__.return_value.request = AsyncMock(return_value=mock_resp)
            resp = client.post(f"/api/tools/{tool_id}/test")
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True

    def test_delete_tool_twice_returns_404(self, client):
        tool_id = self._create_tool(client, "delete-twice")
        resp = client.delete(f"/api/tools/{tool_id}")
        assert resp.status_code == 204
        resp = client.delete(f"/api/tools/{tool_id}")
        assert resp.status_code == 404


