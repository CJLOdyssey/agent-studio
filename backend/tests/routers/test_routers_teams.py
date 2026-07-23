"""Comprehensive unit tests for the Teams router module.

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


class TestTeams:

    def test_list_teams(self, client):
        resp = client.get("/api/teams", headers={"X-User-ID": "admin"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_team(self, client):
        resp = client.post("/api/teams", json={"name": "my-team", "description": "test"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "my-team"
        assert data["agents"] == []

    def test_create_team_conflict(self, client):
        client.post("/api/teams", json={"name": "dup-team"})
        resp = client.post("/api/teams", json={"name": "dup-team"})
        assert resp.status_code == 409

    def test_get_team_detail(self, client):
        resp = client.post("/api/teams", json={"name": "detail-team"})
        team_id = resp.json()["id"]
        resp = client.get(f"/api/teams/{team_id}")
        assert resp.status_code == 200

    def test_get_team_not_found(self, client):
        resp = client.get("/api/teams/nonexistent")
        assert resp.status_code == 404

    def test_update_team(self, client):
        resp = client.post("/api/teams", json={"name": "upd-team"})
        team_id = resp.json()["id"]
        resp = client.put(f"/api/teams/{team_id}", json={"name": "updated-team", "description": "new"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "updated-team"

    def test_update_team_not_found(self, client):
        resp = client.put("/api/teams/nonexistent", json={"name": "x"})
        assert resp.status_code == 404

    def test_delete_team(self, client):
        resp = client.post("/api/teams", json={"name": "del-team"})
        team_id = resp.json()["id"]
        resp = client.delete(f"/api/teams/{team_id}")
        assert resp.status_code == 200

    def test_delete_team_not_found(self, client):
        resp = client.delete("/api/teams/nonexistent")
        assert resp.status_code == 404

    def test_add_member(self, client):
        resp = client.post("/api/teams", json={"name": "mem-team"})
        team_id = resp.json()["id"]
        resp = client.post(f"/api/teams/{team_id}/members", json={"name": "member-1"})
        assert resp.status_code == 201

    def test_add_member_team_not_found(self, client):
        resp = client.post("/api/teams/nonexistent/members", json={"name": "m"})
        assert resp.status_code == 404

    def test_remove_member(self, client):
        resp = client.post("/api/teams", json={"name": "rm-team"})
        team_id = resp.json()["id"]
        resp = client.post(f"/api/teams/{team_id}/members", json={"name": "to-remove"})
        member_id = resp.json()["id"]
        resp = client.delete(f"/api/teams/{team_id}/members/{member_id}")
        assert resp.status_code == 200

    def test_remove_member_not_found(self, client):
        resp = client.post("/api/teams", json={"name": "rm2-team"})
        team_id = resp.json()["id"]
        resp = client.delete(f"/api/teams/{team_id}/members/nonexistent")
        assert resp.status_code == 404

    def test_reorder_members(self, client):
        resp = client.post("/api/teams", json={"name": "reorder-team"})
        team_id = resp.json()["id"]
        resp = client.put(f"/api/teams/{team_id}/members/reorder", json={"member_ids": []})
        assert resp.status_code == 200

    def test_link_agent(self, client):
        resp = client.post("/api/teams", json={"name": "link-team"})
        team_id = resp.json()["id"]
        resp = client.post(f"/api/teams/{team_id}/members", json={"name": "linkable"})
        member_id = resp.json()["id"]
        resp = client.put(f"/api/teams/{team_id}/members/{member_id}/link-agent",
                          json={"agent_config_id": "agent-1"})
        assert resp.status_code == 200

    def test_link_agent_member_not_found(self, client):
        resp = client.put("/api/teams/t/members/nonexistent/link-agent",
                          json={"agent_config_id": "agent-1"})
        assert resp.status_code == 404

    def test_team_create_request_model(self):
        from backend.routers.teams import TeamCreateRequest
        req = TeamCreateRequest(name="test")
        assert req.name == "test"

    def test_team_update_request_model(self):
        from backend.routers.teams import TeamUpdateRequest
        req = TeamUpdateRequest(name="updated")
        assert req.name == "updated"

    # ── Exception handler paths ──

    def test_list_teams_exception(self, client):
        with patch("backend.routers.teams.get_teams", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.get("/api/teams", headers={"X-User-ID": "admin"})
            assert resp.status_code == 500

    def test_create_team_exception(self, client):
        with patch("backend.routers.teams.create_team", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/teams", json={"name": "err-team"})
            assert resp.status_code == 500

    def test_delete_team_not_found_return(self, client):
        resp = client.post("/api/teams", json={"name": "dnf-team"})
        team_id = resp.json()["id"]
        with patch("backend.routers.teams.delete_team", new_callable=AsyncMock, return_value=False):
            resp = client.delete(f"/api/teams/{team_id}")
            assert resp.status_code == 404

    def test_remove_member_exception(self, client):
        with patch("backend.routers.teams.remove_team_member", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.delete("/api/teams/t/members/m")
            assert resp.status_code == 500

    def test_reorder_exception(self, client):
        with patch("backend.routers.teams.reorder_team_members", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.put("/api/teams/t/members/reorder", json={"member_ids": []})
            assert resp.status_code == 500

    def test_link_agent_exception(self, client):
        with patch("backend.routers.teams.link_agent_config", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.put("/api/teams/t/members/m/link-agent", json={"agent_config_id": "a"})
            assert resp.status_code == 500

    def test_update_team_exception(self, client):
        with patch("backend.routers.teams.update_team", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.put("/api/teams/t", json={"name": "x"})
            assert resp.status_code == 500

    def test_delete_team_exception(self, client):
        with patch("backend.routers.teams.delete_team", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.delete("/api/teams/t")
            assert resp.status_code == 500

    def test_add_member_exception(self, client):
        with patch("backend.routers.teams.add_team_member", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/teams/t/members", json={"name": "m"})
            assert resp.status_code == 500

    # ── Remaining coverage gaps ──

    def test_update_team_with_all_fields(self, client):
        resp = client.post("/api/teams", json={"name": "full-update-team"})
        team_id = resp.json()["id"]
        resp = client.put(f"/api/teams/{team_id}", json={
            "name": "fully-updated",
            "description": "new desc",
            "status": "active",
            "order": 5,
            "is_expanded": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "fully-updated"
        assert data["description"] == "new desc"
        assert data["order"] == 5
        assert data["is_expanded"] is True

    def test_update_team_http_exception_reraise(self, client):
        with patch("backend.routers.teams.update_team", new_callable=AsyncMock,
                    side_effect=Exception("some error")):
            resp = client.put("/api/teams/nonexistent", json={"name": "x"})
            assert resp.status_code in (404, 500)
