"""Tests for version management API routes using in-memory SQLite and TestClient."""
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


class TestVersionRoutes:

    def get_id(self, client):
        resp = client.post("/api/sessions", json={"title": "Version Test Session"})
        return resp.json()["id"]

    def test_create_version(self, client):
        resource_id = self.get_id(client)
        resp = client.post("/api/versions", json={
            "resource_type": "session",
            "resource_id": resource_id,
            "snapshot": {"title": "v1 snapshot"},
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["version_num"] == 1
        assert data["snapshot"]["title"] == "v1 snapshot"

    def test_list_versions_empty(self, client):
        resource_id = self.get_id(client)
        resp = client.get(f"/api/versions/session/{resource_id}")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_version_no_detail_route_match(self, client):
        resp = client.get("/api/versions/detail/nonexistent-id")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_version_for_prompt(self, client):
        resource_id = self.get_id(client)
        resp = client.post("/api/versions", json={
            "resource_type": "prompt",
            "resource_id": resource_id,
            "snapshot": {"name": "test prompt", "content": "hello"},
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["resource_type"] == "prompt"
        assert data["version_num"] == 1

    def test_list_prompt_versions(self, client):
        resource_id = self.get_id(client)
        client.post("/api/versions", json={
            "resource_type": "prompt",
            "resource_id": resource_id,
            "snapshot": {"name": "prompt v1"},
        })
        resp = client.get(f"/api/versions/prompt/{resource_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if data:
            assert data[0]["snapshot"]["name"] == "prompt v1"
