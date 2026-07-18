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

class TestKeyCRUD:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_key_create(self, client):
        payload = {
            "provider": "openai",
            "usage_type": "embedding",
            "label": "test-key",
            "api_key": "sk-test-key-value",
        }
        resp = client.post("/api/keys", json=payload, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["provider"] == "openai"

    def test_key_list(self, client):
        resp = client.get("/api/keys", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_key_create_empty_body_returns_422(self, client):
        resp = client.post("/api/keys", json={}, headers=self.USER_HEADERS)
        assert resp.status_code == 422


class TestKeyEdgeCases:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_create_key(self, client):
        resp = client.post("/api/keys", json={
            "provider": "custom", "usage_type": "embedding", "label": "test-key-edge",
            "api_key": "sk-test-key-val",
        }, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["provider"] == "custom"

    def test_update_key_label(self, client):
        created = client.post("/api/keys", json={
            "provider": "openai", "usage_type": "embedding", "label": "old-label",
            "api_key": "sk-old-key",
        }, headers=self.USER_HEADERS).json()
        resp = client.put(f"/api/keys/{created['id']}", json={"label": "new-label"}, headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["label"] == "new-label"

    def test_get_keys_has_masked_key(self, client):
        client.post("/api/keys", json={
            "provider": "anthropic", "usage_type": "embedding", "label": "masked-test",
            "api_key": "sk-anthropic-secret",
        }, headers=self.USER_HEADERS)
        resp = client.get("/api/keys", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        for k in data:
            assert "key_masked" in k
            assert k["key_masked"] != "sk-anthropic-secret"
            assert "..." in k["key_masked"]


class TestKeyRoutes:

    def test_create_key(self, client):
        resp = client.post("/api/keys", json={
            "provider": "custom",
            "usage_type": "embedding",
            "label": "my-key",
            "api_key": "sk-test123",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["provider"] == "custom"
        assert data["label"] == "my-key"
        assert "key_masked" in data

    def test_create_key_validation(self, client):
        resp = client.post("/api/keys", json={
            "provider": "",
            "usage_type": "llm",
            "label": "bad-key",
            "api_key": "sk-test123",
        })
        assert resp.status_code == 422

    def test_list_keys(self, client):
        client.post("/api/keys", json={
            "provider": "custom",
            "usage_type": "embedding",
            "label": "key-1",
            "api_key": "sk-one",
        })
        client.post("/api/keys", json={
            "provider": "openai",
            "usage_type": "embedding",
            "label": "key-2",
            "api_key": "sk-two",
        })
        resp = client.get("/api/keys")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 2

    def test_update_key(self, client):
        created = client.post("/api/keys", json={
            "provider": "custom",
            "usage_type": "embedding",
            "label": "old-label",
            "api_key": "sk-update",
        }).json()
        resp = client.put(f"/api/keys/{created['id']}", json={
            "label": "new-label",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["label"] == "new-label"

    def test_update_key_not_found(self, client):
        resp = client.put("/api/keys/nonexistent", json={"label": "new"})
        assert resp.status_code == 404

    def test_key_fetch_models(self, client):
        resp = client.post("/api/keys/fetch-models", json={
            "api_key": "sk-test123",
            "base_url": "https://api.example.com",
            "provider": "custom",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "success" in data

    def test_key_usage_stats(self, client):
        resp = client.get("/api/keys/usage")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)

    def test_delete_key(self, client):
        created = client.post("/api/keys", json={
            "provider": "custom",
            "usage_type": "embedding",
            "label": "delete-me",
            "api_key": "sk-delete",
        }).json()
        resp = client.delete(f"/api/keys/{created['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "deleted"

    def test_delete_key_not_found(self, client):
        resp = client.delete("/api/keys/nonexistent-id")
        assert resp.status_code == 404

    def test_key_connectivity_test(self, client):
        created = client.post("/api/keys", json={
            "provider": "custom",
            "usage_type": "embedding",
            "label": "conn-key",
            "api_key": "sk-conn",
        }).json()
        resp = client.post(f"/api/keys/{created['id']}/test")
        assert resp.status_code == 200
        data = resp.json()
        assert "success" in data

    def test_check_connectivity_via_fetch_models(self, client):
        with patch("virtual_team.repository.keys._test_connection_sync") as mock_test:
            mock_test.return_value = {"success": True, "models": ["gpt-4"], "message": "OK"}
            resp = client.post("/api/keys/fetch-models", json={
                "api_key": "sk-test",
                "provider": "custom",
                "base_url": "https://api.example.com",
            })
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert "models" in data

    def test_update_key_label_only(self, client):
        created = client.post("/api/keys", json={
            "provider": "custom",
            "usage_type": "embedding",
            "label": "original-label",
            "api_key": "sk-label-update",
        }).json()
        resp = client.put(f"/api/keys/{created['id']}", json={"label": "updated-label"})
        assert resp.status_code == 200
        assert resp.json()["label"] == "updated-label"

    def test_get_key_usage_stats_returns_dict(self, client):
        resp = client.get("/api/keys/usage")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)
        assert "today_tokens" in data
import os

os.environ["AUTH_MODE"] = "legacy"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["KEY_VAULT_SECRET"] = "0123456789abcdef0123456789abcdef"
os.environ["AUTH_ENABLED"] = "0"
os.environ["RATE_LIMIT"] = "9999"
os.environ["CHECKPOINTER_BACKEND"] = "memory"
os.environ["DATABASE_POOL_SIZE"] = "0"

from unittest.mock import AsyncMock, patch

import pytest
from starlette.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import virtual_team.database as db_mod

_sqlite_engine = create_async_engine("sqlite+aiosqlite:///:memory:")
db_mod._async_engine = _sqlite_engine
db_mod._async_session_factory = async_sessionmaker(_sqlite_engine, expire_on_commit=False)
db_mod.DATABASE_URL = "sqlite+aiosqlite:///:memory:"

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

    with patch("virtual_team.rate_limit.get_redis", return_value=mock_redis):
        with patch("virtual_team.app_lifespan.get_redis", return_value=mock_redis):
            with TestClient(app) as c:
                yield c


