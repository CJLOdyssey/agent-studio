"""Team run approval router tests — HITL human verdict endpoint."""

import json
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

pytestmark = pytest.mark.unit

import core.infra.database as db_mod
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from starlette.testclient import TestClient

os.environ["AUTH_MODE"] = "legacy"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["KEY_VAULT_SECRET"] = "0123456789abcdef0123456789abcdef"
os.environ["AUTH_ENABLED"] = "0"
os.environ["RATE_LIMIT"] = "9999"
os.environ["CHECKPOINTER_BACKEND"] = "memory"

if db_mod._async_engine is None:
    db_mod._async_engine = create_async_engine("sqlite+aiosqlite:///:memory:")
if db_mod._async_session_factory is None:
    db_mod._async_session_factory = async_sessionmaker(
        db_mod._async_engine if db_mod._async_engine is not None else create_async_engine("sqlite+aiosqlite:///:memory:"),
        expire_on_commit=False,
    )
db_mod.DATABASE_URL = "sqlite+aiosqlite:///:memory:"

from core.app import app
from core.base import Base


@pytest.fixture
def client():
    import core.app_lifespan as lifespan_mod

    async def _safe_init_db():
        engine = db_mod.get_async_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    lifespan_mod.init_db = _safe_init_db

    store: dict[str, str] = {}

    async def _redis_get(key: str) -> str | None:
        return store.get(key)

    async def _redis_set(key: str, value: str, *args: object, **kwargs: object) -> bool:
        store[key] = value
        return True

    mock_redis = AsyncMock()
    mock_redis.incr.return_value = 1
    mock_redis.expire.return_value = True
    mock_redis.ping.return_value = True
    mock_redis.publish.return_value = 1
    mock_redis.get.side_effect = _redis_get
    mock_redis.set.side_effect = _redis_set

    with (
        patch("broker.get_redis", return_value=mock_redis),
        patch("core.app_lifespan.get_redis", return_value=mock_redis),
        patch("routers.team_runs.get_redis", return_value=mock_redis),
    ):
        with TestClient(app) as c:
            yield c, store


class TestTeamRunApprove:
    def test_approve_writes_human_verdict(self, client):
        c, store = client
        fake_run = MagicMock(id="r-1")
        with patch("routers.team_runs.get_run", new_callable=AsyncMock, return_value=fake_run):
            resp = c.post("/api/team-runs/r-1/approve", json={"approved": True, "note": "looks good"})

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["approved"] is True

        raw = store.get("team:r-1:human_verdict")
        assert raw is not None
        verdict = json.loads(raw)
        assert verdict["approved"] is True
        assert verdict["note"] == "looks good"
        assert verdict["user_id"] == "admin"
        assert "ts" in verdict

    def test_approve_reject_defaults_note(self, client):
        c, store = client
        fake_run = MagicMock(id="r-2")
        with patch("routers.team_runs.get_run", new_callable=AsyncMock, return_value=fake_run):
            resp = c.post("/api/team-runs/r-2/approve", json={"approved": False})

        assert resp.status_code == 200
        verdict = json.loads(store["team:r-2:human_verdict"])
        assert verdict["approved"] is False
        assert verdict["note"] == ""

    def test_approve_run_not_found(self, client):
        c, _ = client
        with patch("routers.team_runs.get_run", new_callable=AsyncMock, return_value=None):
            resp = c.post("/api/team-runs/missing/approve", json={"approved": True})

        assert resp.status_code == 404
