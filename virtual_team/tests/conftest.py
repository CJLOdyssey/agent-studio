"""Shared fixtures and helpers for E2E tests."""

import contextlib
import string
import uuid

import httpx
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from virtual_team.database import Base

BASE = "http://localhost:8080"


def _rid(prefix: str = "test") -> str:
    suffix = uuid.uuid4().hex[:8]
    clean_suffix = "".join(c for c in suffix if c in string.ascii_lowercase)
    clean_prefix = "".join(c for c in prefix if c in string.ascii_lowercase + "_")
    result = f"{clean_prefix}_{clean_suffix}" if clean_suffix else f"{clean_prefix}_x"
    return result


def _clear_rate_limits():
    try:
        import subprocess
        keys = subprocess.run(
            ["docker", "exec", "virtual-team-redis", "redis-cli", "KEYS", "ratelimit:*"],
            capture_output=True, text=True, timeout=5,
        )
        if keys.stdout.strip():
            key_list = keys.stdout.strip().split("\n")
            subprocess.run(
                ["docker", "exec", "virtual-team-redis", "redis-cli", "DEL"] + key_list,
                capture_output=True, timeout=5,
            )
    except Exception:
        pass


def _cleanup(*ids_and_endpoints: tuple[str, str]):
    c = httpx.Client(base_url=BASE, timeout=10)
    for eid, ep in ids_and_endpoints:
        with contextlib.suppress(Exception):
            c.delete(f"{ep}/{eid}")
    c.close()


class Api:
    def __init__(self, base: str = BASE):
        self.client = httpx.Client(base_url=base, timeout=30)

    def get(self, path: str, **kw):
        return self.client.get(path, **kw)

    def post(self, path: str, json=None, **kw):
        return self.client.post(path, json=json, **kw)

    def put(self, path: str, json=None, **kw):
        return self.client.put(path, json=json, **kw)

    def delete(self, path: str, **kw):
        return self.client.delete(path, **kw)

    def close(self):
        self.client.close()


@pytest.fixture
def api():
    a = Api()
    yield a
    a.close()


@pytest.fixture(autouse=True)
def _fresh_rate_limit():
    _clear_rate_limits()


@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped event loop for async fixtures."""
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_client():
    """FastAPI TestClient backed by in-memory SQLite.

    Patches the database session factory and Redis dependency so that
    the full FastAPI application runs without external infrastructure.
    Tables are created once per session.
    """
    # ── 1. Patch Redis-dependent rate limiter BEFORE app import ──────
    from unittest.mock import AsyncMock

    import virtual_team.rate_limit as rl_mod
    rl_mod.RateLimiter.is_allowed = AsyncMock(return_value=True)  # type: ignore[assignment]

    # ── 2. Set up in-memory SQLite database ─────────────────────────
    engine = create_async_engine("sqlite+aiosqlite://", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    import virtual_team.database as db_mod
    db_mod._async_session_factory = async_sessionmaker(engine, expire_on_commit=False)

    # ── 3. Import the app (deps already patched) ────────────────────
    from virtual_team.app import app

    app.router.lifespan_context = None  # type: ignore[assignment]

    # ── 4. Create ASGI client ───────────────────────────────────────
    from httpx import ASGITransport, AsyncClient

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture(scope="session")
async def db_engine(test_client):
    """Companion fixture for tests that also request ``db_engine``.

    The actual database is already set up by ``test_client``; this fixture
    exists only to satisfy test signatures that request both.
    """
    return None
