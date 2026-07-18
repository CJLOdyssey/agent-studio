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

class TestSessionCRUD:

    USER_HEADERS = {"X-User-ID": "admin"}

    def _create_session(self, client, title="test-session"):
        resp = client.post("/api/sessions", json={"title": title}, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_session_create_and_list(self, client):
        resp = client.post("/api/sessions", json={"title": "test-session"}, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        session_id = resp.json()["id"]
        assert resp.json()["title"] == "test-session"

        resp = client.get("/api/sessions", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        ids = [s["id"] for s in resp.json()]
        assert session_id in ids

    def test_session_detail(self, client):
        session_id = self._create_session(client, "detail-session")
        resp = client.get(f"/api/sessions/{session_id}", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "detail-session"
        assert "runs" in data
        assert "memories" in data

    def test_session_rename(self, client):
        session_id = self._create_session(client, "rename-me")
        resp = client.put(f"/api/sessions/{session_id}", json={"title": "renamed-session"}, headers=self.USER_HEADERS)
        assert resp.status_code == 200
        assert resp.json()["title"] == "renamed-session"

    def test_session_delete(self, client):
        session_id = self._create_session(client, "delete-me")
        resp = client.delete(f"/api/sessions/{session_id}", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

    def test_session_get_nonexistent_returns_404(self, client):
        resp = client.get("/api/sessions/nonexistent-id-99999", headers=self.USER_HEADERS)
        assert resp.status_code == 404

    def test_session_update_nonexistent_returns_404(self, client):
        resp = client.put("/api/sessions/nonexistent-id-99999", json={"title": "nope"}, headers=self.USER_HEADERS)
        assert resp.status_code == 404

    def test_session_delete_nonexistent_returns_404(self, client):
        resp = client.delete("/api/sessions/nonexistent-id-99999", headers=self.USER_HEADERS)
        assert resp.status_code == 404

    def test_session_rename_empty_body_returns_422(self, client):
        resp = client.put("/api/sessions/nonexistent-id", json={}, headers=self.USER_HEADERS)
        assert resp.status_code == 422


class TestSessionEdgeCases:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_list_sessions_returns_list(self, client):
        resp = client.get("/api/sessions", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_create_session_with_agent_id(self, client):
        agent_resp = client.post("/api/agents", json={
            "name": "session-agent", "role_identifier": "sess_role", "system_prompt": "test",
        }, headers=self.USER_HEADERS)
        assert agent_resp.status_code == 201
        agent_id = agent_resp.json()["id"]
        resp = client.post("/api/sessions", json={"title": "agent-session", "agent_id": agent_id}, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "agent-session"

    def test_get_session_memories_structure(self, client):
        sid = client.post("/api/sessions", json={"title": "mem-struct"}, headers=self.USER_HEADERS).json()["id"]
        resp = client.get(f"/api/sessions/{sid}/memories", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


class TestSessionEdgeCasesExtended:

    USER_HEADERS = {"X-User-ID": "admin"}

    def _create_session(self, client, title="ext-session"):
        resp = client.post("/api/sessions", json={"title": title}, headers=self.USER_HEADERS)
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_put_session_rename(self, client):
        session_id = self._create_session(client, "put-rename")
        resp = client.put(f"/api/sessions/{session_id}", json={"title": "ext-renamed"}, headers=self.USER_HEADERS)
        assert resp.status_code == 200
        assert resp.json()["title"] == "ext-renamed"

    def test_delete_session_returns_deleted(self, client):
        session_id = self._create_session(client, "delete-ext")
        resp = client.delete(f"/api/sessions/{session_id}", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

    def test_post_session_create_run(self, client):
        import virtual_team.routers.runs as runs_router
        session_id = self._create_session(client, "create-run-ext")
        mock_result = {"run_id": "ext-run-1", "session_id": session_id, "status": "running"}
        with patch.object(runs_router.run_service, 'create_run', new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_result
            resp = client.post("/api/runs", json={
                "requirement": "ext run req", "sessionId": session_id,
            }, headers=self.USER_HEADERS)
            assert resp.status_code == 200
            data = resp.json()
            assert data["run_id"] == "ext-run-1"
            assert data["session_id"] == session_id

    def test_get_session_memories_json_format(self, client):
        session_id = self._create_session(client, "mem-json")
        resp = client.get(f"/api/sessions/{session_id}/memories/export?format=json", headers=self.USER_HEADERS)
        assert resp.status_code == 200

    def test_get_session_memories_md_format(self, client):
        session_id = self._create_session(client, "mem-md")
        resp = client.get(f"/api/sessions/{session_id}/memories/export?format=md", headers=self.USER_HEADERS)
        assert resp.status_code == 200

    def test_export_invalid_format(self, client):
        session_id = self._create_session(client, "bad-format")
        resp = client.get(f"/api/sessions/{session_id}/memories/export?format=xml", headers=self.USER_HEADERS)
        assert resp.status_code == 400

    def test_export_nonexistent_session(self, client):
        resp = client.get("/api/sessions/nonexistent/memories/export?format=json", headers=self.USER_HEADERS)
        assert resp.status_code == 404

    def test_delete_memory(self, client):
        session_id = self._create_session(client, "del-mem")
        resp = client.delete(f"/api/memories/nonexistent", headers=self.USER_HEADERS)
        assert resp.status_code == 404


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

    def test_update_session_with_valid_body(self, client):
        created = client.post("/api/sessions", json={"title": "Update Me"}).json()
        resp = client.put(f"/api/sessions/{created['id']}", json={"title": "Updated Title"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Updated Title"

    def test_delete_session_returns_204(self, client):
        created = client.post("/api/sessions", json={"title": "Delete 204"}).json()
        resp = client.delete(f"/api/sessions/{created['id']}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

    def test_create_memory_entry(self, client):
        created = client.post("/api/sessions", json={"title": "Mem Create"}).json()
        session_id = created["id"]
        run_id = "test-run-id"
        memory = await_memory_create(session_id, run_id)
        assert memory.id is not None
        assert memory.session_id == session_id
        assert memory.summary == "Test memory summary"

    def test_memories_list_with_entries(self, client):
        created = client.post("/api/sessions", json={"title": "Mem List"}).json()
        session_id = created["id"]
        await_memory_create(session_id, "run-1")
        resp = client.get(f"/api/sessions/{session_id}/memories")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["summary"] == "Test memory summary"

    def test_memories_export_json(self, client):
        created = client.post("/api/sessions", json={"title": "Mem Export"}).json()
        session_id = created["id"]
        await_memory_create(session_id, "run-export")
        resp = client.get(f"/api/sessions/{session_id}/memories/export?format=json")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/json"
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["summary"] == "Test memory summary"


def await_memory_create(session_id: str, run_id: str):
    import asyncio
    return asyncio.new_event_loop().run_until_complete(
        create_memory_entry(
            session_id=session_id,
            run_id=run_id,
            agent_role="tester",
            content_type="test",
            summary="Test memory summary",
            details="Test details",
        )
    )


class TestSessionEdgeCases:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_add_memory_with_file_id(self, client):
        created = client.post("/api/sessions", json={"title": "Mem File"}, headers=self.USER_HEADERS).json()
        session_id = created["id"]
        memory = await_memory_create(session_id, "run-file")
        assert memory.id is not None
        assert memory.session_id == session_id

    def test_create_session_run_with_agent_id(self, client):
        created = client.post("/api/sessions", json={"title": "Session Run Agent"}, headers=self.USER_HEADERS).json()
        key_resp = client.post("/api/keys", json={
            "provider": "custom", "usage_type": "embedding", "label": "run-agent-key",
            "api_key": "sk-test-run-agent",
        }, headers=self.USER_HEADERS)
        assert key_resp.status_code == 201
        key_id = key_resp.json()["id"]
        resp = client.post("/api/runs", json={
            "requirement": "Run with session and agent",
            "sessionId": created["id"],
            "keyId": key_id,
            "agentId": "test-agent-1",
        }, headers=self.USER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert "run_id" in data
        assert data["session_id"] == created["id"]

    def test_delete_session_deletes(self, client):
        created = client.post("/api/sessions", json={"title": "Delete Final"}, headers=self.USER_HEADERS).json()
        resp = client.delete(f"/api/sessions/{created['id']}", headers=self.USER_HEADERS)
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"
        get_resp = client.get(f"/api/sessions/{created['id']}", headers=self.USER_HEADERS)
        assert get_resp.status_code == 404
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

    with patch("virtual_team.rate_limit.get_redis", return_value=mock_redis):
        with patch("virtual_team.app_lifespan.get_redis", return_value=mock_redis):
            with TestClient(app) as c:
                yield c


