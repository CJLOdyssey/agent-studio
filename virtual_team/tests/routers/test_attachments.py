"""Integration tests for FastAPI REST API routes using in-memory SQLite and TestClient."""
import io
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

class TestAttachmentRoutes:

    def test_upload_attachment(self, client):
        session_resp = client.post("/api/sessions", json={"title": "att-session"}, headers={"X-User-ID": "admin"})
        assert session_resp.status_code == 201
        session_id = session_resp.json()["id"]
        resp = client.post(
            "/api/attachments",
            files={"file": ("test.txt", io.BytesIO(b"hello world"), "text/plain")},
            data={"session_id": session_id},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["filename"] == "test.txt"
        assert data["session_id"] == session_id

    def test_upload_attachment_to_nonexistent_session(self, client):
        resp = client.post(
            "/api/attachments",
            files={"file": ("test.txt", io.BytesIO(b"data"), "text/plain")},
            data={"session_id": "nonexistent"},
        )
        assert resp.status_code == 404

    def test_upload_attachment_invalid_type(self, client):
        session_resp = client.post("/api/sessions", json={"title": "att-type"}, headers={"X-User-ID": "admin"})
        session_id = session_resp.json()["id"]
        resp = client.post(
            "/api/attachments",
            files={"file": ("test.exe", io.BytesIO(b"data"), "application/x-msdownload")},
            data={"session_id": session_id},
        )
        assert resp.status_code == 415

    def test_upload_attachment_too_large(self, client):
        session_resp = client.post("/api/sessions", json={"title": "att-large"}, headers={"X-User-ID": "admin"})
        session_id = session_resp.json()["id"]
        resp = client.post(
            "/api/attachments",
            files={"file": ("large.txt", io.BytesIO(b"x" * (10 * 1024 * 1024 + 1)), "text/plain")},
            data={"session_id": session_id},
        )
        assert resp.status_code == 413

    def test_list_attachments(self, client):
        session_resp = client.post("/api/sessions", json={"title": "att-list"}, headers={"X-User-ID": "admin"})
        session_id = session_resp.json()["id"]
        client.post(
            "/api/attachments",
            files={"file": ("list.txt", io.BytesIO(b"data"), "text/plain")},
            data={"session_id": session_id},
        )
        resp = client.get(f"/api/sessions/{session_id}/attachments")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1


