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

class TestCommandsRoutes:

    def test_list_commands(self, client):
        resp = client.get("/api/commands")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        ids = [c["id"] for c in data]
        assert "clear" in ids
        assert "export" in ids
        assert "rename" in ids
        assert "help" in ids

    def test_list_commands_structure(self, client):
        resp = client.get("/api/commands")
        assert resp.status_code == 200
        for cmd in resp.json():
            assert "id" in cmd
            assert "name" in cmd
            assert "description" in cmd
            assert "category" in cmd
            assert "enabled" in cmd

    def test_get_command_by_id(self, client):
        resp = client.get("/api/commands/clear")
        assert resp.status_code == 200
        assert resp.json()["id"] == "clear"

    def test_get_command_not_found(self, client):
        resp = client.get("/api/commands/nonexistent")
        assert resp.status_code == 404

    def test_execute_command_clear(self, client):
        resp = client.post(
            "/api/commands/execute",
            json={"session_id": "nonexistent", "command_id": "clear", "payload": {}},
        )
        assert resp.status_code == 404

    def test_execute_command_not_found(self, client):
        resp = client.post(
            "/api/commands/execute",
            json={"session_id": "test-session", "command_id": "unknown", "payload": {}},
        )
        assert resp.status_code == 404

    def test_execute_command_rename(self, client):
        resp = client.post(
            "/api/commands/execute",
            json={
                "session_id": "nonexistent",
                "command_id": "rename",
                "payload": {"title": "New Title"},
            },
        )
        assert resp.status_code == 404


