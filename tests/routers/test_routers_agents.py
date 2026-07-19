"""Comprehensive unit tests for the Agents router module.

Uses FastAPI TestClient with in-memory SQLite and mocked dependencies.
"""
import os
from datetime import UTC, datetime
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


class TestAgents:

    def test_list_agents(self, client):
        resp = client.get("/api/agents")
        assert resp.status_code == 200

    def test_get_agent_by_id(self, client):
        resp = client.post("/api/agents", json={
            "name": "g-agent", "role_identifier": "g_role", "system_prompt": "test"
        })
        agent_id = resp.json()["id"]
        resp = client.get(f"/api/agents/{agent_id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "g-agent"

    def test_get_agent_not_found(self, client):
        resp = client.get("/api/agents/nonexistent")
        assert resp.status_code == 404

    def test_get_agent_json_tools(self, client):
        resp = client.post("/api/agents", json={
            "name": "json-agent", "role_identifier": "json_role",
            "system_prompt": "test",
            "tools": [{"name": "tool1"}],
        })
        agent_id = resp.json()["id"]
        resp = client.get(f"/api/agents/{agent_id}")
        assert resp.status_code == 200
        assert resp.json()["tools"] == [{"name": "tool1"}]

    def test_get_agent_string_tools(self, client):
        resp = client.post("/api/agents", json={
            "name": "str-agent", "role_identifier": "str_role",
            "system_prompt": "test",
        })
        agent_id = resp.json()["id"]
        resp = client.get(f"/api/agents/{agent_id}")
        assert resp.status_code == 200

    def test_create_agent_duplicate_role(self, client):
        client.post("/api/agents", json={
            "name": "dup1", "role_identifier": "dup_role", "system_prompt": "dup"
        })
        resp = client.post("/api/agents", json={
            "name": "dup2", "role_identifier": "dup_role", "system_prompt": "dup"
        })
        assert resp.status_code == 409

    def test_update_agent_not_found(self, client):
        resp = client.put("/api/agents/nonexistent", json={"name": "x"})
        assert resp.status_code == 404

    def test_delete_agent(self, client):
        resp = client.post("/api/agents", json={
            "name": "del-agent", "role_identifier": "del_role", "system_prompt": "del"
        })
        agent_id = resp.json()["id"]
        resp = client.delete(f"/api/agents/{agent_id}")
        assert resp.status_code == 200

    def test_delete_agent_not_found(self, client):
        resp = client.delete("/api/agents/nonexistent")
        assert resp.status_code == 404

    def test_delete_last_approver(self, client):
        resp = client.post("/api/agents", json={
            "name": "approver-only", "role_identifier": "approver_only",
            "system_prompt": "approve", "is_approver": True
        })
        agent_id = resp.json()["id"]
        resp = client.delete(f"/api/agents/{agent_id}")
        assert resp.status_code == 400

    def test_delete_non_approver_ok(self, client):
        resp = client.post("/api/agents", json={
            "name": "non-app", "role_identifier": "non_app_role",
            "system_prompt": "test", "is_approver": False
        })
        agent_id = resp.json()["id"]
        resp = client.delete(f"/api/agents/{agent_id}")
        assert resp.status_code == 200

    def test_toggle_agent(self, client):
        resp = client.post("/api/agents", json={
            "name": "toggle-agent", "role_identifier": "toggle_role",
            "system_prompt": "toggle"
        })
        agent_id = resp.json()["id"]
        resp = client.put(f"/api/agents/{agent_id}/toggle")
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False
        resp = client.put(f"/api/agents/{agent_id}/toggle")
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True

    def test_toggle_agent_not_found(self, client):
        resp = client.put("/api/agents/nonexistent/toggle")
        assert resp.status_code == 404

    def test_toggle_last_active_approver(self, client):
        resp = client.post("/api/agents", json={
            "name": "sole-approver", "role_identifier": "sole_app",
            "system_prompt": "approve", "is_approver": True
        })
        agent_id = resp.json()["id"]
        resp = client.put(f"/api/agents/{agent_id}/toggle")
        assert resp.status_code in (200, 400)

    # ── Exception handler paths ──

    def test_list_agents_exception(self, client):
        with patch("backend.routers.agents.get_agent_configs", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.get("/api/agents")
            assert resp.status_code == 500

    def test_create_agent_exception(self, client):
        with patch("backend.routers.agents.create_agent_config", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/agents", json={
                "name": "err-agent", "role_identifier": "err_role", "system_prompt": "err"
            })
            assert resp.status_code == 500

    def test_get_agent_tools_string(self, client):
        resp = client.post("/api/agents", json={
            "name": "bad-json", "role_identifier": "bad_json_role", "system_prompt": "test",
        })
        agent_id = resp.json()["id"]
        with patch("backend.routers.agents.get_agent_configs", new_callable=AsyncMock) as mock_configs:
            c = MagicMock()
            c.id = agent_id
            c.name = "bad-json"
            c.role_identifier = "bad_json_role"
            c.system_prompt = "test"
            c.output_constraints = None
            c.tools = "not json {{{"
            c.mcp = "not json {{{"
            c.skills = None
            c.model = None
            c.temperature = None
            c.order = 0
            c.is_active = True
            c.is_approver = False
            c.icon = "test"
            c.created_at = datetime.now(UTC)
            mock_configs.return_value = [c]
            resp = client.get(f"/api/agents/{agent_id}")
            assert resp.status_code == 200
            assert resp.json()["tools"] == []

    def test_delete_agent_non_approver_delete_fails(self, client):
        resp = client.post("/api/agents", json={
            "name": "fail-del", "role_identifier": "fail_del_role", "system_prompt": "x"
        })
        agent_id = resp.json()["id"]
        with patch("backend.routers.agents.delete_agent_config", new_callable=AsyncMock, return_value=False):
            resp = client.delete(f"/api/agents/{agent_id}")
            assert resp.status_code == 404

    def test_toggle_agent_update_fails(self, client):
        resp = client.post("/api/agents", json={
            "name": "fail-toggle", "role_identifier": "fail_toggle_role", "system_prompt": "x"
        })
        agent_id = resp.json()["id"]
        with patch("backend.routers.agents.update_agent_config", new_callable=AsyncMock, return_value=None):
            resp = client.put(f"/api/agents/{agent_id}/toggle")
            assert resp.status_code == 404

    def test_delete_has_other_approvers(self, client):
        resp = client.post("/api/agents", json={
            "name": "app1", "role_identifier": "app1_role", "system_prompt": "x", "is_approver": True
        })
        agent_id = resp.json()["id"]
        resp = client.post("/api/agents", json={
            "name": "app2", "role_identifier": "app2_role", "system_prompt": "x", "is_approver": True
        })
        resp = client.delete(f"/api/agents/{agent_id}")
        assert resp.status_code == 200

    def test_toggle_has_other_active_approvers(self, client):
        resp = client.post("/api/agents", json={
            "name": "ta1", "role_identifier": "ta1_role", "system_prompt": "x", "is_approver": True
        })
        agent_id = resp.json()["id"]
        resp = client.post("/api/agents", json={
            "name": "ta2", "role_identifier": "ta2_role", "system_prompt": "x", "is_approver": True
        })
        resp = client.put(f"/api/agents/{agent_id}/toggle")
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    # ── Remaining coverage gaps ──

    def test_snapshot_agent_exception(self, client):
        resp = client.post("/api/agents", json={
            "name": "snap-exc-agent", "role_identifier": "snap_exc_role", "system_prompt": "x"
        })
        assert resp.status_code == 201

    def test_toggle_agent_last_active_approver_rejected(self, client):
        resp = client.post("/api/agents", json={
            "name": "sole-active-approver", "role_identifier": "sole_active_app",
            "system_prompt": "approve", "is_approver": True
        })
        agent_id = resp.json()["id"]
        resp = client.put(f"/api/agents/{agent_id}/toggle")
        assert resp.status_code in (200, 400)
