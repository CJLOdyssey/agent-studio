"""Comprehensive unit tests for the MCPS router module.

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

if db_mod._async_engine is None:
    _sqlite_engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    db_mod._async_engine = _sqlite_engine
if db_mod._async_session_factory is None:
    db_mod._async_session_factory = async_sessionmaker(
        db_mod._async_engine if db_mod._async_engine is not None else create_async_engine("sqlite+aiosqlite:///:memory:"),
        expire_on_commit=False,
    )
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


class TestMCPS:

    def test_list_mcps(self, client):
        resp = client.get("/api/mcps")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_mcp(self, client):
        resp = client.post("/api/mcps", json={"name": "test-mcp", "type": "stdio", "endpoint": "/bin/echo"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "test-mcp"

    def test_update_mcp(self, client):
        resp = client.post("/api/mcps", json={"name": "upd-mcp"})
        mcp_id = resp.json()["id"]
        resp = client.put(f"/api/mcps/{mcp_id}", json={"name": "updated-mcp"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "updated-mcp"

    def test_update_mcp_not_found(self, client):
        resp = client.put("/api/mcps/nonexistent", json={"name": "x"})
        assert resp.status_code == 404

    def test_delete_mcp(self, client):
        resp = client.post("/api/mcps", json={"name": "del-mcp"})
        mcp_id = resp.json()["id"]
        resp = client.delete(f"/api/mcps/{mcp_id}")
        assert resp.status_code == 204

    def test_delete_mcp_not_found(self, client):
        resp = client.delete("/api/mcps/nonexistent")
        assert resp.status_code == 404

    def test_test_mcp_not_found(self, client):
        resp = client.post("/api/mcps/nonexistent/test")
        assert resp.status_code == 404

    def test_test_mcp_no_endpoint(self, client):
        resp = client.post("/api/mcps", json={"name": "noep-mcp", "type": "stdio", "endpoint": ""})
        mcp_id = resp.json()["id"]
        resp = client.post(f"/api/mcps/{mcp_id}/test")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "No endpoint" in data["message"]

    def test_test_mcp_stdio_command(self, client):
        resp = client.post("/api/mcps", json={"name": "cmd-mcp", "type": "stdio", "endpoint": "echo ok"})
        mcp_id = resp.json()["id"]
        resp = client.post(f"/api/mcps/{mcp_id}/test")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True

    def test_test_mcp_sse_no_endpoint(self, client):
        resp = client.post("/api/mcps", json={"name": "sse-mcp", "type": "sse", "endpoint": ""})
        mcp_id = resp.json()["id"]
        resp = client.post(f"/api/mcps/{mcp_id}/test")
        assert resp.status_code == 200
        assert resp.json()["success"] is False

    # ── Exception handler paths ──

    def test_list_mcps_exception(self, client):
        with patch("backend.routers.mcps.get_mcps_as_dicts", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.get("/api/mcps")
            assert resp.status_code == 500

    def test_create_mcp_exception(self, client):
        with patch("backend.routers.mcps.create_mcp", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/mcps", json={"name": "x"})
            assert resp.status_code == 500

    def test_update_mcp_exception(self, client):
        with patch("backend.routers.mcps.update_mcp", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.put("/api/mcps/t", json={"name": "x"})
            assert resp.status_code == 500

    def test_delete_mcp_exception(self, client):
        with patch("backend.routers.mcps.get_mcps", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.delete("/api/mcps/t")
            assert resp.status_code == 500

    # ── Remaining coverage gaps ──

    def test_update_mcp_triggers_snapshot(self, client):
        resp = client.post("/api/mcps", json={
            "name": "snap-mcp", "type": "stdio", "endpoint": "/bin/echo",
            "config": '{"description": "test", "version": "1.0"}'
        })
        mcp_id = resp.json()["id"]
        resp = client.put(f"/api/mcps/{mcp_id}", json={"name": "snap-mcp-updated"})
        assert resp.status_code == 200

    def test_test_mcp_sse_with_endpoint(self, client):
        resp = client.post("/api/mcps", json={
            "name": "sse-test-mcp", "type": "sse", "endpoint": "http://example.com/health"
        })
        mcp_id = resp.json()["id"]

        mock_response = MagicMock()
        mock_response.status_code = 200
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_response)
            mock_http.__aenter__ = AsyncMock(return_value=mock_http)
            mock_http.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_http
            resp = client.post(f"/api/mcps/{mcp_id}/test")
            assert resp.status_code == 200
            assert resp.json()["success"] is True

    def test_test_mcp_sse_with_endpoint_http_error(self, client):
        resp = client.post("/api/mcps", json={
            "name": "sse-err-mcp", "type": "sse", "endpoint": "http://example.com/fail"
        })
        mcp_id = resp.json()["id"]

        mock_response = MagicMock()
        mock_response.status_code = 500
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_response)
            mock_http.__aenter__ = AsyncMock(return_value=mock_http)
            mock_http.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_http
            resp = client.post(f"/api/mcps/{mcp_id}/test")
            assert resp.status_code == 200
            assert resp.json()["success"] is False

    def test_test_mcp_stdio_timeout(self, client):
        resp = client.post("/api/mcps", json={
            "name": "timeout-mcp", "type": "stdio", "endpoint": "sleep 60"
        })
        mcp_id = resp.json()["id"]
        resp = client.post(f"/api/mcps/{mcp_id}/test")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "process running" in data["message"]

    def test_test_mcp_exception_in_try_block(self, client):
        resp = client.post("/api/mcps", json={
            "name": "exc-mcp", "type": "sse", "endpoint": "http://example.com"
        })
        mcp_id = resp.json()["id"]
        with patch("httpx.AsyncClient", side_effect=Exception("httpx init error")):
            resp = client.post(f"/api/mcps/{mcp_id}/test")
            assert resp.status_code == 200
            assert resp.json()["success"] is False

    def test_create_mcp_with_config(self, client):
        resp = client.post("/api/mcps", json={
            "name": "cfg-mcp", "type": "stdio", "endpoint": "echo",
            "config": '{"description": "test config"}'
        })
        assert resp.status_code == 201
        assert resp.json()["config"] == '{"description": "test config"}'
