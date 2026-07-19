"""Comprehensive unit tests for the Tools router module.

Uses FastAPI TestClient with in-memory SQLite and mocked dependencies.
"""
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.testclient import TestClient

os.environ["AUTH_MODE"] = "legacy"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["KEY_VAULT_SECRET"] = "0123456789abcdef0123456789abcdef"
os.environ["AUTH_ENABLED"] = "0"
os.environ["RATE_LIMIT"] = "9999"
os.environ["CHECKPOINTER_BACKEND"] = "memory"

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import backend.core.infra.database as db_mod

_sqlite_engine = create_async_engine("sqlite+aiosqlite:///:memory:")
db_mod._async_engine = _sqlite_engine
db_mod._async_session_factory = async_sessionmaker(_sqlite_engine, expire_on_commit=False)
db_mod.DATABASE_URL = "sqlite+aiosqlite:///:memory:"

from backend.core.app import app
from backend.core.base import Base


@pytest.fixture
def client():
    import backend.core.app_lifespan as lifespan_mod

    async def _safe_init_db():
        engine = db_mod.get_async_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        from backend.core.seed import seed_default_roles_and_admin
        await seed_default_roles_and_admin()
        import bcrypt
        from sqlalchemy import select
        from backend.core.infra.database import UserDB, get_session_factory
        factory = get_session_factory()
        async with factory() as session:
            existing = await session.execute(
                select(UserDB).where(UserDB.email == "admin@test.com")
            )
            if not existing.scalar_one_or_none():
                user = UserDB(
                    id="admin-login",
                    username="admin-login",
                    email="admin@test.com",
                    password_hash=bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode(),
                    is_active=True,
                    is_verified=True,
                )
                session.add(user)
                await session.commit()

    lifespan_mod.init_db = _safe_init_db

    store: dict[str, str] = {}

    async def _redis_get(key: str) -> str | None:
        return store.get(key)

    async def _redis_set(key: str, value: str, *args: object, **kwargs: object) -> bool:
        store[key] = value
        return True

    async def _redis_delete(key: str) -> bool:
        store.pop(key, None)
        return True

    mock_redis = AsyncMock()
    mock_redis.incr.return_value = 1
    mock_redis.expire.return_value = True
    mock_redis.ping.return_value = True
    mock_redis.publish.return_value = 1
    mock_redis.get.side_effect = _redis_get
    mock_redis.set.side_effect = _redis_set
    mock_redis.delete.side_effect = _redis_delete

    with patch("backend.broker.get_redis", return_value=mock_redis), \
         patch("backend.core.app_lifespan.get_redis", return_value=mock_redis), \
         patch("backend.routers.auth.login.get_redis", return_value=mock_redis), \
         patch("backend.routers.auth.register.get_redis", return_value=mock_redis), \
         patch("backend.routers.auth.password.get_redis", return_value=mock_redis):
        with TestClient(app) as c:
            yield c


class TestTools:

    def test_list_tools(self, client):
        resp = client.get("/api/tools")
        assert resp.status_code == 200

    def test_list_tool_plugins(self, client):
        resp = client.get("/api/tools/plugins")
        assert resp.status_code == 200

    def test_validate_tool(self, client):
        resp = client.post("/api/tools/validate", json={
            "code": "def hello(): return 'world'", "language": "python"
        })
        assert resp.status_code == 200

    def test_validate_tool_exception(self, client):
        with patch("backend.routers.tools._validate_tool_code", side_effect=Exception("syntax error")):
            resp = client.post("/api/tools/validate", json={
                "code": "bad code", "language": "python"
            })
            assert resp.status_code == 500

    def test_execute_tool(self, client):
        resp = client.post("/api/tools/execute?code=print(1)&language=python")
        assert resp.status_code == 200

    def test_execute_tool_error(self, client):
        with patch("backend.routers.tools._execute_tool_sandbox", side_effect=Exception("runtime error")):
            resp = client.post("/api/tools/execute?code=bad&language=python")
            assert resp.status_code == 200
            assert resp.json()["success"] is False

    def test_create_tool(self, client):
        resp = client.post("/api/tools", json={
            "name": "test-tool", "category": "api", "description": "A tool"
        })
        assert resp.status_code == 201

    def test_update_tool(self, client):
        resp = client.post("/api/tools", json={
            "name": "upd-tool", "category": "api"
        })
        tool_id = resp.json()["id"]
        resp = client.put(f"/api/tools/{tool_id}", json={"name": "updated-tool"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "updated-tool"

    def test_update_tool_not_found(self, client):
        resp = client.put("/api/tools/nonexistent", json={"name": "x"})
        assert resp.status_code == 404

    def test_delete_tool(self, client):
        resp = client.post("/api/tools", json={
            "name": "del-tool", "category": "api"
        })
        tool_id = resp.json()["id"]
        resp = client.delete(f"/api/tools/{tool_id}")
        assert resp.status_code == 204

    def test_delete_tool_not_found(self, client):
        resp = client.delete("/api/tools/nonexistent")
        assert resp.status_code == 404

    def test_test_tool_not_found(self, client):
        resp = client.post("/api/tools/nonexistent/test")
        assert resp.status_code == 404

    def test_test_tool_no_endpoint(self, client):
        resp = client.post("/api/tools", json={"name": "noep-tool", "category": "api", "endpoint": ""})
        tool_id = resp.json()["id"]
        resp = client.post(f"/api/tools/{tool_id}/test")
        assert resp.status_code == 200
        assert resp.json()["success"] is False
        assert "No endpoint" in resp.json()["message"]

    def test_test_tool_success(self, client):
        resp = client.post("/api/tools", json={
            "name": "http-tool", "category": "api",
            "endpoint": "https://httpbin.org/get", "method": "GET"
        })
        tool_id = resp.json()["id"]
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.text = "ok"
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client
            resp = client.post(f"/api/tools/{tool_id}/test")
            assert resp.status_code == 200
            assert resp.json()["success"] is True

    def test_test_tool_timeout(self, client):
        import httpx
        resp = client.post("/api/tools", json={
            "name": "timeout-tool", "category": "api",
            "endpoint": "https://httpbin.org/delay/100"
        })
        tool_id = resp.json()["id"]
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client
            resp = client.post(f"/api/tools/{tool_id}/test")
            assert resp.status_code == 200
            assert "timed out" in resp.json()["message"]

    def test_test_tool_connection_error(self, client):
        import httpx
        resp = client.post("/api/tools", json={
            "name": "conn-tool", "category": "api",
            "endpoint": "https://unreachable.test"
        })
        tool_id = resp.json()["id"]
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(side_effect=httpx.RequestError("conn failed"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client
            resp = client.post(f"/api/tools/{tool_id}/test")
            assert resp.status_code == 200
            assert "Connection failed" in resp.json()["message"]

    # ── Exception handler paths ──

    def test_list_tools_exception(self, client):
        with patch("backend.routers.tools.repo_get_tools_as_dicts", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.get("/api/tools")
            assert resp.status_code == 500

    def test_create_tool_exception(self, client):
        with patch("backend.routers.tools.repo_create_tool", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/tools", json={"name": "x", "category": "c"})
            assert resp.status_code == 500

    def test_delete_tool_exception(self, client):
        with patch("backend.routers.tools.get_tool", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.delete("/api/tools/t")
            assert resp.status_code == 500

    def test_test_tool_internal_exception(self, client):
        resp = client.post("/api/tools", json={
            "name": "int-tool", "category": "api", "endpoint": "http://test.com"
        })
        tool_id = resp.json()["id"]
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(side_effect=RuntimeError("internal"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client
            resp = client.post(f"/api/tools/{tool_id}/test")
            assert resp.status_code == 500

    # ── Remaining coverage gaps ──

    def test_edit_tool_not_found(self, client):
        with patch("backend.routers.tools.update_tool", new_callable=AsyncMock, return_value=None):
            resp = client.put("/api/tools/nonexistent", json={"name": "x"})
            assert resp.status_code == 404

    def test_edit_tool_generic_exception(self, client):
        resp = client.post("/api/tools", json={"name": "exc-tool", "category": "api"})
        tool_id = resp.json()["id"]
        with patch("backend.routers.tools.update_tool", new_callable=AsyncMock, side_effect=Exception("err")):
            resp = client.put(f"/api/tools/{tool_id}", json={"name": "x"})
            assert resp.status_code == 500
