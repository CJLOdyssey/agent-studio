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

class TestSkillCRUD:

    def _create_skill(self, client, name="test-skill", category="general"):
        payload = {"name": name, "category": category, "description": "A test skill"}
        resp = client.post("/api/skills", json=payload)
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_skill_create(self, client):
        payload = {"name": "test-skill", "category": "general", "description": "A test skill"}
        resp = client.post("/api/skills", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["name"] == "test-skill"

    def test_skill_update(self, client):
        skill_id = self._create_skill(client, "skill-to-update")
        resp = client.put(f"/api/skills/{skill_id}", json={"name": "updated-skill", "description": "Updated"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "updated-skill"

    def test_skill_delete(self, client):
        skill_id = self._create_skill(client, "skill-to-delete")
        resp = client.delete(f"/api/skills/{skill_id}")
        assert resp.status_code == 204

    def test_skill_get_nonexistent_returns_404(self, client):
        resp = client.get("/api/skills/nonexistent-id-99999")
        assert resp.status_code == 404

    def test_skill_update_nonexistent_returns_404(self, client):
        resp = client.put("/api/skills/nonexistent-id-99999", json={"name": "nope"})
        assert resp.status_code == 404

    def test_skill_delete_nonexistent_returns_404(self, client):
        resp = client.delete("/api/skills/nonexistent-id-99999")
        assert resp.status_code == 404

    def test_skill_create_empty_body_returns_422(self, client):
        resp = client.post("/api/skills", json={})
        assert resp.status_code == 422


class TestSkillCreateAndVerify:

    def test_skill_create_and_list(self, client):
        payload = {"name": "verify-skill", "category": "general", "description": "Verify skill test"}
        resp = client.post("/api/skills", json=payload)
        assert resp.status_code == 201
        skill_id = resp.json()["id"]
        assert skill_id is not None

        resp = client.get("/api/skills")
        assert resp.status_code == 200
        ids = [s["id"] for s in resp.json()]
        assert skill_id in ids

    def test_skill_update_name(self, client):
        payload = {"name": "update-skill", "category": "general", "description": "Update test"}
        resp = client.post("/api/skills", json=payload)
        skill_id = resp.json()["id"]

        resp = client.put(f"/api/skills/{skill_id}", json={"name": "updated-skill-name"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "updated-skill-name"

    def test_skill_get_nonexistent(self, client):
        resp = client.get("/api/skills/nonexistent-id")
        assert resp.status_code == 404

    def test_skill_update_nonexistent(self, client):
        resp = client.put("/api/skills/nonexistent-id", json={"name": "nope"})
        assert resp.status_code == 404

    def test_skill_delete_nonexistent(self, client):
        resp = client.delete("/api/skills/nonexistent-id")
        assert resp.status_code == 404


class TestSkillErrorHandling:

    def test_list_skills_exception(self, client):
        import virtual_team.routers.skills as skills_router
        with patch.object(skills_router, 'repo_get_skills_as_dicts', new_callable=AsyncMock) as mock_list:
            mock_list.side_effect = RuntimeError("list failed")
            resp = client.get("/api/skills")
            assert resp.status_code == 500

    def test_get_skill_exception(self, client):
        import virtual_team.routers.skills as skills_router
        with patch.object(skills_router, 'repo_get_skills', new_callable=AsyncMock) as mock_get_skills:
            mock_get_skills.side_effect = RuntimeError("get skills failed")
            resp = client.get("/api/skills/some-id")
            assert resp.status_code == 500

    def test_create_skill_exception(self, client):
        import virtual_team.routers.skills as skills_router
        with patch.object(skills_router, 'repo_create_skill', new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = RuntimeError("create failed")
            resp = client.post("/api/skills", json={"name": "fail", "category": "general", "description": "fail"})
            assert resp.status_code == 500

    def test_update_skill_exception(self, client):
        import virtual_team.routers.skills as skills_router
        payload = {"name": "update-exc", "category": "general", "description": "update exc"}
        resp = client.post("/api/skills", json=payload)
        skill_id = resp.json()["id"]
        with patch.object(skills_router, 'update_skill', new_callable=AsyncMock) as mock_update:
            mock_update.side_effect = RuntimeError("update failed")
            resp = client.put(f"/api/skills/{skill_id}", json={"name": "new-name"})
            assert resp.status_code == 500

    def test_delete_skill_exception(self, client):
        import virtual_team.routers.skills as skills_router
        payload = {"name": "delete-exc", "category": "general", "description": "delete exc"}
        resp = client.post("/api/skills", json=payload)
        skill_id = resp.json()["id"]
        with patch.object(skills_router, 'delete_skill', new_callable=AsyncMock) as mock_delete:
            mock_delete.side_effect = RuntimeError("delete failed")
            resp = client.delete(f"/api/skills/{skill_id}")
            assert resp.status_code == 500


async def _async_gen(items):
    for item in items:
        yield item


