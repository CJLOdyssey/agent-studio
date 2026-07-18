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

class TestPromptCRUD:

    def _create_prompt(self, client, name="test-prompt", category="general"):
        payload = {"name": name, "category": category, "content": "You are a helpful assistant."}
        resp = client.post("/api/prompts", json=payload)
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_prompt_create(self, client):
        payload = {"name": "test-prompt", "category": "general", "content": "You are a helpful assistant."}
        resp = client.post("/api/prompts", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["name"] == "test-prompt"

    def test_prompt_update(self, client):
        prompt_id = self._create_prompt(client, "prompt-to-update")
        resp = client.put(f"/api/prompts/{prompt_id}", json={"name": "updated-prompt", "content": "Updated content"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "updated-prompt"
        assert data["content"] == "Updated content"

    def test_prompt_delete(self, client):
        prompt_id = self._create_prompt(client, "prompt-to-delete")
        resp = client.delete(f"/api/prompts/{prompt_id}")
        assert resp.status_code == 204

    def test_prompt_get_nonexistent_returns_404(self, client):
        resp = client.put("/api/prompts/nonexistent-id-99999", json={"name": "nope"})
        assert resp.status_code == 404

    def test_prompt_delete_nonexistent_returns_404(self, client):
        resp = client.delete("/api/prompts/nonexistent-id-99999")
        assert resp.status_code == 404

    def test_prompt_create_empty_body_returns_422(self, client):
        resp = client.post("/api/prompts", json={})
        assert resp.status_code == 422


class TestPromptVersions:

    USER_HEADERS = {"X-User-ID": "admin"}

    def _create_prompt(self, client, name="vp-prompt"):
        payload = {"name": name, "category": "general", "content": "You are helpful."}
        resp = client.post("/api/prompts", json=payload)
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_create_and_get_prompt(self, client):
        prompt_id = self._create_prompt(client, "versioned-prompt")
        assert prompt_id is not None
        resp = client.get("/api/prompts")
        ids = [p["id"] for p in resp.json()]
        assert prompt_id in ids

    def test_create_version(self, client):
        prompt_id = self._create_prompt(client, "prompt-for-version")
        version_payload = {
            "resource_type": "prompt",
            "resource_id": prompt_id,
            "snapshot": {"name": "v1", "content": "Initial content"},
        }
        resp = client.post("/api/versions", json=version_payload, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        version_data = resp.json()
        assert version_data is not None

    def test_list_versions(self, client):
        prompt_id = self._create_prompt(client, "prompt-for-list-versions")

        for i in range(2):
            client.post("/api/versions", json={
                "resource_type": "prompt",
                "resource_id": prompt_id,
                "snapshot": {"name": f"v{i}", "content": f"content {i}"},
            }, headers=self.USER_HEADERS)

        resp = client.get(f"/api/versions/prompt/{prompt_id}")
        assert resp.status_code == 200
        versions = resp.json()
        assert isinstance(versions, list)

    def test_list_versions_unknown_resource(self, client):
        resp = client.get("/api/versions/prompt/nonexistent-id")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestPromptEdgeCases:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_create_prompt_with_category(self, client):
        resp = client.post("/api/prompts", json={
            "name": "cat-prompt", "category": "coding", "content": "Write code",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "cat-prompt"

    def test_list_prompts_returns_created(self, client):
        client.post("/api/prompts", json={"name": "list-prompt", "category": "general", "content": "hello"})
        resp = client.get("/api/prompts")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        names = [p["name"] for p in data]
        assert "list-prompt" in names

    def test_create_prompt_version(self, client):
        pid = client.post("/api/prompts", json={
            "name": "version-prompt", "category": "general", "content": "v0",
        }).json()["id"]
        resp = client.post("/api/versions", json={
            "resource_type": "prompt", "resource_id": pid,
            "snapshot": {"name": "v1", "content": "v1 content"},
        }, headers=self.USER_HEADERS)
        assert resp.status_code == 201

    def test_list_prompt_versions(self, client):
        pid = client.post("/api/prompts", json={
            "name": "list-ver-prompt", "category": "general", "content": "base",
        }).json()["id"]
        client.post("/api/versions", json={
            "resource_type": "prompt", "resource_id": pid,
            "snapshot": {"name": "v1", "content": "v1"},
        }, headers=self.USER_HEADERS)
        resp = client.get(f"/api/versions/prompt/{pid}")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


