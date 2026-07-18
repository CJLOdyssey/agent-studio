"""Integration tests for FastAPI REST API routes using in-memory SQLite and TestClient."""
import os
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


ndef _async_gen(*a,**kw):
    async def _inner():
        for i in range(3): yield i
    return _inner()

class TestRunContinue:

    USER_HEADERS = {"X-User-ID": "admin"}

    def test_complete_run_success(self, client):
        import virtual_team.routers.run_continue as rc_router
        mock_result = {"run_id": "continue-run-1", "session_id": "sess-1", "status": "running"}
        with patch.object(rc_router.run_service, 'continue_run', new_callable=AsyncMock) as mock_cc:
            mock_cc.return_value = mock_result
            resp = client.post("/api/runs/complete", json={"content": "continue", "session_id": "sess-1"}, headers=self.USER_HEADERS)
            assert resp.status_code == 200
            data = resp.json()
            assert data["run_id"] == "continue-run-1"
            assert data["status"] == "running"

    def test_complete_run_value_error(self, client):
        import virtual_team.routers.run_continue as rc_router
        with patch.object(rc_router.run_service, 'continue_run', new_callable=AsyncMock) as mock_cc:
            mock_cc.side_effect = ValueError("Session not found")
            resp = client.post("/api/runs/complete", json={"content": "x", "session_id": "bad"}, headers=self.USER_HEADERS)
            assert resp.status_code == 400

    def test_complete_run_http_exception_re_raised(self, client):
        from fastapi import HTTPException

        import virtual_team.routers.run_continue as rc_router
        with patch.object(rc_router.run_service, 'continue_run', new_callable=AsyncMock) as mock_cc:
            mock_cc.side_effect = HTTPException(status_code=409, detail="conflict")
            resp = client.post("/api/runs/complete", json={"content": "x"}, headers=self.USER_HEADERS)
            assert resp.status_code == 409

    def test_complete_run_internal_error(self, client):
        import virtual_team.routers.run_continue as rc_router
        with patch.object(rc_router.run_service, 'continue_run', new_callable=AsyncMock) as mock_cc:
            mock_cc.side_effect = RuntimeError("crash")
            resp = client.post("/api/runs/complete", json={"content": "x"}, headers=self.USER_HEADERS)
            assert resp.status_code == 500


class TestRunWebSocket:

    def test_websocket_connect_and_disconnect(self, client):
        import virtual_team.routers.runs as runs_router
        mock_messages = []
        async def _subscribe(*args, **kwargs):
            for m in mock_messages:
                yield m

        with (
            patch.object(runs_router, 'get_run', new_callable=AsyncMock, return_value=None),
            patch.object(runs_router, 'drain_buffer', return_value=[]),
            patch.object(runs_router, 'subscribe_run', side_effect=_subscribe),
            patch.object(runs_router, 'stop_buffer', new_callable=AsyncMock),
        ):
            with client.websocket_connect("/ws/runs/test-run-id") as ws:
                data = ws.receive_json()
                assert data["type"] == "status"
                assert data["status"] == "connected"
                ws.close()

    def test_websocket_pre_check_error(self, client):
        import virtual_team.routers.runs as runs_router
        with (
            patch.object(runs_router, 'get_run', new_callable=AsyncMock, side_effect=RuntimeError("db fail")),
            patch.object(runs_router, 'drain_buffer', return_value=[]),
            patch.object(runs_router, 'subscribe_run', return_value=_async_gen([])),
            patch.object(runs_router, 'stop_buffer', new_callable=AsyncMock),
        ):
            with client.websocket_connect("/ws/runs/err-run") as ws:
                data = ws.receive_json()
                assert data["type"] == "status"
                ws.close()

    def test_websocket_subscribe_streams_messages(self, client):
        import virtual_team.routers.runs as runs_router
        msgs = [
            {"type": "message", "content": "first"},
            {"type": "message", "content": "second"},
        ]
        with (
            patch.object(runs_router, 'get_run', new_callable=AsyncMock, return_value=None),
            patch.object(runs_router, 'drain_buffer', return_value=[]),
            patch.object(runs_router, 'subscribe_run', return_value=_async_gen(msgs)),
            patch.object(runs_router, 'stop_buffer', new_callable=AsyncMock),
        ):
            with client.websocket_connect("/ws/runs/stream-run") as ws:
                data = ws.receive_json()
                assert data["type"] == "status"
                data = ws.receive_json()
                assert data["content"] == "first"
                data = ws.receive_json()
                assert data["content"] == "second"
                ws.close()

    def test_websocket_disconnect_during_drain(self, client):
        import virtual_team.routers.runs as runs_router
        with (
            patch.object(runs_router, 'get_run', new_callable=AsyncMock, return_value=None),
            patch.object(runs_router, 'drain_buffer', return_value=[{"type": "message"}]),
            patch.object(runs_router, 'subscribe_run', return_value=_async_gen([])),
            patch.object(runs_router, 'stop_buffer', new_callable=AsyncMock),
        ):
            with client.websocket_connect("/ws/runs/drain-id") as ws:
                ws.close()

    def test_websocket_disconnect_during_subscribe(self, client):
        import virtual_team.routers.runs as runs_router
        msgs = [{"type": "message", "content": "test"}]
        with (
            patch.object(runs_router, 'get_run', new_callable=AsyncMock, return_value=None),
            patch.object(runs_router, 'drain_buffer', return_value=[]),
            patch.object(runs_router, 'subscribe_run', return_value=_async_gen(msgs)),
            patch.object(runs_router, 'stop_buffer', new_callable=AsyncMock),
        ):
            with client.websocket_connect("/ws/runs/sub-id") as ws:
                ws.close()
        import virtual_team.routers.runs as runs_router
        msgs = [{"type": "message", "content": "test"}]
        with (
            patch.object(runs_router, 'get_run', new_callable=AsyncMock, return_value=None),
            patch.object(runs_router, 'drain_buffer', return_value=[]),
            patch.object(runs_router, 'subscribe_run', return_value=_async_gen(msgs)),
            patch.object(runs_router, 'stop_buffer', new_callable=AsyncMock),
        ):
            with client.websocket_connect("/ws/runs/sub-id") as ws:
                ws.close()

    def test_websocket_subscribe_error(self, client):
        import virtual_team.routers.runs as runs_router
        async def _error_gen():
            raise RuntimeError("subscribe failed")
            yield

        with (
            patch.object(runs_router, 'get_run', new_callable=AsyncMock, return_value=None),
            patch.object(runs_router, 'drain_buffer', return_value=[]),
            patch.object(runs_router, 'subscribe_run', return_value=_error_gen()),
            patch.object(runs_router, 'stop_buffer', new_callable=AsyncMock),
        ):
            with client.websocket_connect("/ws/runs/error-run") as ws:
                data = ws.receive_json()
                assert data["type"] == "status"

    def test_websocket_send_error(self, client):
        import virtual_team.routers.runs as runs_router
        async def _gen():
            yield {"type": "message"}

        with (
            patch.object(runs_router, 'get_run', new_callable=AsyncMock, return_value=None),
            patch.object(runs_router, 'drain_buffer', return_value=[]),
            patch.object(runs_router, 'subscribe_run', return_value=_gen()),
            patch.object(runs_router, 'stop_buffer', new_callable=AsyncMock),
            patch.object(runs_router, 'logger', MagicMock()),
        ):
            with client.websocket_connect("/ws/runs/send-err") as ws:
                data = ws.receive_json()
                assert data["type"] == "status"

    def test_websocket_run_already_converged(self, client):
        from unittest.mock import MagicMock

        import virtual_team.routers.runs as runs_router

        mock_run = MagicMock()
        mock_run.status = "converged"
        mock_run.approved = True
        mock_run.pm_document = "doc"
        mock_run.code = "code"
        mock_run.review = "review"

        mock_msg = MagicMock()
        mock_msg.role = "assistant"
        mock_msg.agent_name = "agent"
        mock_msg.content = "hello"
        mock_msg.round_number = 1

        with (
            patch.object(runs_router, 'get_run', new_callable=AsyncMock, return_value=mock_run),
            patch.object(runs_router, 'get_messages', new_callable=AsyncMock, return_value=[mock_msg]),
            patch.object(runs_router, 'stop_buffer', new_callable=AsyncMock),
            patch.object(runs_router, 'drain_buffer', return_value=[]),
        ):
            with client.websocket_connect("/ws/runs/converged-run") as ws:
                data = ws.receive_json()
                assert data["type"] == "status"
                data = ws.receive_json()
                assert data["type"] == "message"
                assert data["content"] == "hello"
                data = ws.receive_json()
                assert data["type"] == "result"
                assert data["status"] == "converged"

    def test_websocket_stop_buffer_error(self, client):
        import virtual_team.routers.runs as runs_router
        with (
            patch.object(runs_router, 'get_run', new_callable=AsyncMock, return_value=None),
            patch.object(runs_router, 'drain_buffer', return_value=[]),
            patch.object(runs_router, 'subscribe_run', return_value=_async_gen([])),
            patch.object(runs_router, 'stop_buffer', new_callable=AsyncMock, side_effect=RuntimeError("stop failed")),
        ):
            with client.websocket_connect("/ws/runs/stop-err") as ws:
                data = ws.receive_json()
                assert data["type"] == "status"
                ws.close()


