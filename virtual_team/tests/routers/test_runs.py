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

class TestRunBasic:

    def test_create_run(self, client):
        import virtual_team.routers.runs as runs_router

        mock_result = {
            "run_id": "test-run-id-123",
            "session_id": "test-session-id-456",
            "status": "running",
        }
        with patch.object(runs_router.run_service, 'create_run', new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_result
            resp = client.post("/api/runs", json={"requirement": "test requirement"}, headers={"X-User-ID": "admin"})
            assert resp.status_code == 200
            data = resp.json()
            assert data["run_id"] == "test-run-id-123"
            assert data["status"] == "running"
            assert data["session_id"] == "test-session-id-456"

    def test_list_runs(self, client):
        import virtual_team.routers.runs as runs_router

        with patch.object(runs_router.run_service, 'list_runs', new_callable=AsyncMock) as mock_list:
            mock_list.return_value = [
                {"id": "run-1", "requirement": "test 1", "status": "converged"},
                {"id": "run-2", "requirement": "test 2", "status": "running"},
            ]
            resp = client.get("/api/runs")
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) == 2
            assert data[0]["id"] == "run-1"


class TestRunRoutes:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_create_run_with_session_id(self, client):
        import virtual_team.routers.runs as runs_router
        from unittest.mock import AsyncMock
        sess = client.post("/api/sessions", json={"title": "run-session"}, headers=self.USER_HEADERS).json()
        mock_result = {"run_id": "test-run-456", "session_id": sess["id"], "status": "running"}
        with patch.object(runs_router.run_service, 'create_run', new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_result
            resp = client.post("/api/runs", json={"requirement": "run with session", "sessionId": sess["id"]}, headers=self.USER_HEADERS)
            assert resp.status_code == 200
            data = resp.json()
            assert data["run_id"] == "test-run-456"
            assert data["session_id"] == sess["id"]
            assert data["status"] == "running"

    def test_list_runs(self, client):
        import virtual_team.routers.runs as runs_router
        from unittest.mock import AsyncMock
        with patch.object(runs_router.run_service, 'list_runs', new_callable=AsyncMock) as mock_list:
            mock_list.return_value = [
                {"id": "list-run-1", "requirement": "test", "status": "converged", "session_id": None},
            ]
            resp = client.get("/api/runs")
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) == 1

    def test_get_run_detail(self, client):
        import virtual_team.routers.runs as runs_router
        from unittest.mock import AsyncMock
        mock_detail = {
            "id": "detail-run-1",
            "session_id": None,
            "requirement": "detail test",
            "pm_document": "",
            "code": "",
            "review": "",
            "approved": False,
            "status": "converged",
            "created_at": "2025-01-01T00:00:00",
            "updated_at": "2025-01-01T00:00:00",
            "messages": [],
        }
        with patch.object(runs_router.run_service, 'get_run', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_detail
            resp = client.get("/api/runs/detail-run-1")
            assert resp.status_code == 200
            data = resp.json()
            assert data["id"] == "detail-run-1"
            assert data["status"] == "converged"
            assert "messages" in data

    def test_get_run_messages(self, client):
        import virtual_team.routers.runs as runs_router
        from unittest.mock import AsyncMock
        mock_detail = {
            "id": "msg-run-1",
            "session_id": None,
            "requirement": "messages test",
            "pm_document": "",
            "code": "",
            "review": "",
            "approved": False,
            "status": "converged",
            "created_at": "2025-01-01T00:00:00",
            "updated_at": "2025-01-01T00:00:00",
            "messages": [
                {"id": "msg-1", "role": "user", "agent_name": "user", "content": "hello", "thinking": None, "round_number": 1, "created_at": "2025-01-01T00:00:00"},
            ],
        }
        with patch.object(runs_router.run_service, 'get_run', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_detail
            resp = client.get("/api/runs/msg-run-1")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["messages"]) == 1
            assert data["messages"][0]["content"] == "hello"
            assert data["messages"][0]["role"] == "user"


class TestRunCRUD:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_create_run_with_session_and_agent(self, client):
        import virtual_team.routers.runs as runs_router
        sess = client.post("/api/sessions", json={"title": "run-session"}, headers=self.USER_HEADERS).json()
        mock_result = {"run_id": "crud-run-1", "session_id": sess["id"], "status": "running"}
        with patch.object(runs_router.run_service, 'create_run', new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_result
            resp = client.post("/api/runs", json={
                "requirement": "test requirement", "sessionId": sess["id"], "agentId": "ag-1",
            }, headers=self.USER_HEADERS)
            assert resp.status_code == 200
            data = resp.json()
            assert data["run_id"] == "crud-run-1"
            assert data["session_id"] == sess["id"]

    def test_list_runs_returns_list(self, client):
        import virtual_team.routers.runs as runs_router
        with patch.object(runs_router.run_service, 'list_runs', new_callable=AsyncMock) as mock_list:
            mock_list.return_value = [
                {"id": "r1", "requirement": "req1", "status": "converged", "session_id": None},
            ]
            resp = client.get("/api/runs")
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) == 1

    def test_get_run_detail(self, client):
        import virtual_team.routers.runs as runs_router
        mock_detail = {
            "id": "detail-1", "session_id": None, "requirement": "detail",
            "pm_document": "", "code": "", "review": "", "approved": False,
            "status": "converged", "created_at": "2025-01-01T00:00:00",
            "updated_at": "2025-01-01T00:00:00", "messages": [],
        }
        with patch.object(runs_router.run_service, 'get_run', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_detail
            resp = client.get("/api/runs/detail-1")
            assert resp.status_code == 200
            data = resp.json()
            assert data["id"] == "detail-1"
            assert "messages" in data

    def test_get_run_detail_not_found(self, client):
        import virtual_team.routers.runs as runs_router
        with patch.object(runs_router.run_service, 'get_run', new_callable=AsyncMock, return_value=None):
            resp = client.get("/api/runs/nonexistent-id")
            assert resp.status_code == 404
            data = resp.json()
            detail = data.get("detail", {})
            if isinstance(detail, dict):
                err = detail.get("error", {})
                assert "未找到" in err.get("message", "")
            else:
                assert "未找到" in str(detail)

    def test_get_run_messages(self, client):
        import virtual_team.routers.runs as runs_router
        mock_detail = {
            "id": "msg-run-1", "session_id": None, "requirement": "msg test",
            "pm_document": "", "code": "", "review": "", "approved": False,
            "status": "converged", "created_at": "2025-01-01T00:00:00",
            "updated_at": "2025-01-01T00:00:00",
            "messages": [
                {"id": "m1", "role": "user", "agent_name": "user", "content": "hello",
                 "thinking": None, "round_number": 1, "created_at": "2025-01-01T00:00:00"},
            ],
        }
        with patch.object(runs_router.run_service, 'get_run', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_detail
            resp = client.get("/api/runs/msg-run-1")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["messages"]) == 1
            assert data["messages"][0]["content"] == "hello"

    def test_run_complete_invalid_session(self, client):
        import virtual_team.routers.run_continue as rc_router
        with patch.object(rc_router.run_service, 'continue_run', new_callable=AsyncMock) as mock_cc:
            mock_cc.side_effect = ValueError("Session not found")
            resp = client.post("/api/runs/complete", json={
                "content": "continue", "session_id": "nonexistent-id",
            }, headers=self.USER_HEADERS)
            assert resp.status_code == 400


class TestRunRoutesExtended:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_create_run_requirement_too_long(self, client):
        import virtual_team.routers.runs as runs_router
        with patch.object(runs_router, 'load_config') as mock_cfg:
            mock_cfg.return_value.max_requirement_length = 5
            resp = client.post("/api/runs", json={"requirement": "way too long requirement"}, headers=self.USER_HEADERS)
            assert resp.status_code == 400

    def test_create_run_empty_after_strip(self, client):
        resp = client.post("/api/runs", json={"requirement": "   "}, headers=self.USER_HEADERS)
        assert resp.status_code == 400

    def test_create_run_value_error(self, client):
        import virtual_team.routers.runs as runs_router
        with patch.object(runs_router.run_service, 'create_run', new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = ValueError("invalid session")
            resp = client.post("/api/runs", json={"requirement": "valid req"}, headers=self.USER_HEADERS)
            assert resp.status_code == 400

    def test_create_run_http_exception_re_raised(self, client):
        import virtual_team.routers.runs as runs_router
        from fastapi import HTTPException
        with patch.object(runs_router.run_service, 'create_run', new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = HTTPException(status_code=409, detail="conflict")
            resp = client.post("/api/runs", json={"requirement": "valid req"}, headers=self.USER_HEADERS)
            assert resp.status_code == 409

    def test_create_run_internal_error(self, client):
        import virtual_team.routers.runs as runs_router
        with patch.object(runs_router.run_service, 'create_run', new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = RuntimeError("unexpected")
            resp = client.post("/api/runs", json={"requirement": "valid req"}, headers=self.USER_HEADERS)
            assert resp.status_code == 500

    def test_get_run_not_found(self, client):
        import virtual_team.routers.runs as runs_router
        with patch.object(runs_router.run_service, 'get_run', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None
            resp = client.get("/api/runs/nonexistent-id")
            assert resp.status_code == 404

    def test_get_run_http_exception_re_raised(self, client):
        import virtual_team.routers.runs as runs_router
        from fastapi import HTTPException
        with patch.object(runs_router.run_service, 'get_run', new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = HTTPException(status_code=410, detail="gone")
            resp = client.get("/api/runs/some-id")
            assert resp.status_code == 410

    def test_get_run_internal_error(self, client):
        import virtual_team.routers.runs as runs_router
        with patch.object(runs_router.run_service, 'get_run', new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = RuntimeError("db error")
            resp = client.get("/api/runs/some-id")
            assert resp.status_code == 500

    def test_list_runs_internal_error(self, client):
        import virtual_team.routers.runs as runs_router
        with patch.object(runs_router.run_service, 'list_runs', new_callable=AsyncMock) as mock_list:
            mock_list.side_effect = RuntimeError("list failed")
            resp = client.get("/api/runs")
            assert resp.status_code == 500


