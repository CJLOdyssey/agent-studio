"""Tests for session API routes using in-memory SQLite and TestClient."""
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


class TestSessionRoutes:

    def test_create_session(self, client):
        resp = client.post("/api/sessions", json={"title": "Test Session"})
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["title"] == "Test Session"

    def test_create_session_with_agent_id_500_on_missing(self, client):
        resp = client.post("/api/sessions", json={"title": "Test", "agent_id": "nonexistent"})
        assert resp.status_code == 500

    def test_list_sessions(self, client):
        client.post("/api/sessions", json={"title": "Session A"})
        resp = client.get("/api/sessions")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "id" in data[0]
        assert "title" in data[0]

    def test_get_session_detail(self, client):
        created = client.post("/api/sessions", json={"title": "Detail Session"}).json()
        resp = client.get(f"/api/sessions/{created['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == created["id"]
        assert data["title"] == "Detail Session"
        assert "runs" in data
        assert "memories" in data

    def test_get_session_404(self, client):
        resp = client.get("/api/sessions/99999")
        assert resp.status_code == 404

    def test_rename_session(self, client):
        created = client.post("/api/sessions", json={"title": "Old Title"}).json()
        resp = client.put(f"/api/sessions/{created['id']}", json={"title": "New Title"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "New Title"

    def test_delete_session(self, client):
        created = client.post("/api/sessions", json={"title": "Delete Me"}).json()
        resp = client.delete(f"/api/sessions/{created['id']}")
        assert resp.status_code == 200
        resp = client.get(f"/api/sessions/{created['id']}")
        assert resp.status_code == 404

    def test_session_memories_list(self, client):
        created = client.post("/api/sessions", json={"title": "Mem Session"}).json()
        resp = client.get(f"/api/sessions/{created['id']}/memories")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_session_memories_404(self, client):
        resp = client.get("/api/sessions/99999/memories")
        assert resp.status_code == 404

    def test_create_run_linked_to_session_fails_without_key(self, client):
        created = client.post("/api/sessions", json={"title": "Run Session"}).json()
        resp = client.post("/api/runs", json={
            "requirement": "Test run linked to session",
            "sessionId": created["id"],
        })
        assert resp.status_code == 400
        data = resp.json()
        assert "detail" in data

    def test_create_run_linked_to_session_success(self, client):
        created = client.post("/api/sessions", json={"title": "Run Session"}).json()
        key_resp = client.post("/api/keys", json={
            "provider": "custom",
            "usage_type": "embedding",
            "label": "test-key",
            "api_key": "sk-test123",
        })
        assert key_resp.status_code == 201
        key_id = key_resp.json()["id"]
        resp = client.post("/api/runs", json={
            "requirement": "Test run linked to session",
            "sessionId": created["id"],
            "keyId": key_id,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "run_id" in data
        assert data["session_id"] == created["id"]
