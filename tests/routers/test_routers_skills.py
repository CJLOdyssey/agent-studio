"""Comprehensive unit tests for the Skills router module.

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


class TestSkills:

    def test_list_skills(self, client):
        resp = client.get("/api/skills")
        assert resp.status_code == 200

    def test_get_skill(self, client):
        resp = client.post("/api/skills", json={
            "name": "get-skill", "category": "general", "description": "Get me"
        })
        skill_id = resp.json()["id"]
        resp = client.get(f"/api/skills/{skill_id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "get-skill"

    def test_get_skill_not_found(self, client):
        resp = client.get("/api/skills/nonexistent")
        assert resp.status_code == 404

    def test_create_skill(self, client):
        resp = client.post("/api/skills", json={
            "name": "new-skill", "category": "general", "description": "New skill"
        })
        assert resp.status_code == 201
        assert resp.json()["name"] == "new-skill"

    def test_update_skill(self, client):
        resp = client.post("/api/skills", json={
            "name": "upd-skill", "category": "general"
        })
        skill_id = resp.json()["id"]
        resp = client.put(f"/api/skills/{skill_id}", json={"name": "updated"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "updated"

    def test_update_skill_not_found(self, client):
        resp = client.put("/api/skills/nonexistent", json={"name": "x"})
        assert resp.status_code == 404

    def test_delete_skill(self, client):
        resp = client.post("/api/skills", json={
            "name": "del-skill", "category": "general"
        })
        skill_id = resp.json()["id"]
        resp = client.delete(f"/api/skills/{skill_id}")
        assert resp.status_code == 204

    def test_delete_skill_not_found(self, client):
        resp = client.delete("/api/skills/nonexistent")
        assert resp.status_code == 404

    # ── Exception handler paths ──

    def test_list_skills_exception(self, client):
        with patch("backend.routers.skills.repo_get_skills_as_dicts", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.get("/api/skills")
            assert resp.status_code == 500

    def test_create_skill_exception(self, client):
        with patch("backend.routers.skills.repo_create_skill", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/skills", json={"name": "x", "category": "c"})
            assert resp.status_code == 500

    def test_update_skill_exception(self, client):
        with patch("backend.routers.skills.update_skill", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.put("/api/skills/t", json={"name": "x"})
            assert resp.status_code == 500

    def test_delete_skill_exception(self, client):
        with patch("backend.repository.skills.get_skills", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.delete("/api/skills/t")
            assert resp.status_code == 500

    # ── Remaining coverage gaps ──

    def test_get_skill_exception(self, client):
        with patch("backend.routers.skills.repo_get_skills", new_callable=AsyncMock, side_effect=Exception("db error")):
            resp = client.get("/api/skills/some-id")
            assert resp.status_code == 500

    def test_edit_skill_description_to_content(self, client):
        resp = client.post("/api/skills", json={
            "name": "desc-skill", "category": "general"
        })
        skill_id = resp.json()["id"]
        resp = client.put(f"/api/skills/{skill_id}", json={"description": "Updated description"})
        assert resp.status_code == 200

    def test_edit_skill_generic_exception(self, client):
        resp = client.post("/api/skills", json={
            "name": "exc-skill", "category": "general"
        })
        skill_id = resp.json()["id"]
        with patch("backend.routers.skills.update_skill", new_callable=AsyncMock, side_effect=Exception("err")):
            resp = client.put(f"/api/skills/{skill_id}", json={"name": "x"})
            assert resp.status_code == 500

    def test_delete_skill_generic_exception(self, client):
        resp = client.post("/api/skills", json={
            "name": "del-exc-skill", "category": "general"
        })
        skill_id = resp.json()["id"]
        with patch("backend.repository.skills.get_skills", new_callable=AsyncMock, side_effect=Exception("err")):
            resp = client.delete(f"/api/skills/{skill_id}")
            assert resp.status_code == 500

    def test_remove_skill_not_found(self, client):
        resp = client.post("/api/skills", json={
            "name": "dnf-skill", "category": "general"
        })
        skill_id = resp.json()["id"]
        with patch("backend.routers.skills.delete_skill", new_callable=AsyncMock, return_value=False):
            resp = client.delete(f"/api/skills/{skill_id}")
            assert resp.status_code == 404
