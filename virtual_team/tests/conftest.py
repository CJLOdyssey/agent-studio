"""Shared fixtures and helpers for E2E tests."""

import contextlib
import string
import subprocess
import uuid

import httpx
import pytest
import redis as redis_module
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from virtual_team.database import Base

BASE = "http://localhost:8080"

# Test user credentials for rbac mode
TEST_EMAIL = "e2e@test.com"
TEST_PASSWORD = "Test@1234"

_REDIS_HOST = "localhost"
_REDIS_PORT = 6379
_REDIS_DB = 1  # matches REDIS_URL from .env / backend config


def _redis():
    return redis_module.Redis(host=_REDIS_HOST, port=_REDIS_PORT, db=_REDIS_DB, decode_responses=True)


def _rid(prefix: str = "test") -> str:
    suffix = uuid.uuid4().hex[:8]
    clean_suffix = "".join(c for c in suffix if c in string.ascii_lowercase)
    clean_prefix = "".join(c for c in prefix if c in string.ascii_lowercase + "_")
    result = f"{clean_prefix}_{clean_suffix}" if clean_suffix else f"{clean_prefix}_x"
    return result


def _clear_rate_limits():
    try:
        out = subprocess.run(
            ["docker", "exec", "virtual-team-redis", "redis-cli", "-n", "1", "KEYS", "ratelimit:*"],
            capture_output=True, text=True, timeout=5,
        )
        if out.stdout.strip():
            keys = out.stdout.strip().split("\n")
            subprocess.run(
                ["docker", "exec", "virtual-team-redis", "redis-cli", "-n", "1", "DEL"] + keys,
                capture_output=True, timeout=5,
            )
    except Exception:
        pass


_TOKEN_CACHE: str | None = None


def _obtain_token() -> str | None:
    """Obtain a Bearer token for rbac mode (tries login first, then register).

    Caches the token globally — called at most once per session.
    """
    global _TOKEN_CACHE
    if _TOKEN_CACHE is not None:
        return _TOKEN_CACHE

    c = httpx.Client(base_url=BASE, timeout=15)
    try:
        cfg = c.get("/api/auth/config").json()
        if cfg.get("mode") != "rbac":
            return None

        # Try login first (common case: user already exists)
        resp = c.post("/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        if resp.status_code == 200:
            _TOKEN_CACHE = resp.json()["access_token"]
            return _TOKEN_CACHE

        # Login failed → register new user
        _clear_rate_limits()
        _delete_redis("auth:verify:e2e@test.com")
        c.post("/api/auth/send-register-code", json={"email": TEST_EMAIL})
        codes = _read_redis("auth:verify:e2e@test.com")
        code = codes[0] if codes else None
        if code:
            resp = c.post(
                "/api/auth/register",
                json={"email": TEST_EMAIL, "code": code, "password": TEST_PASSWORD},
            )
            if resp.status_code == 201:
                _TOKEN_CACHE = resp.json()["access_token"]
                return _TOKEN_CACHE
            # User was created but register failed → try login again
            resp = c.post("/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
            if resp.status_code == 200:
                _TOKEN_CACHE = resp.json()["access_token"]
                return _TOKEN_CACHE
    except Exception:
        pass
    finally:
        c.close()
    return None


def _attach_auth(client: httpx.Client) -> None:
    token = _obtain_token()
    if token:
        client.headers.update({"Authorization": f"Bearer {token}"})


def _cleanup(*ids_and_endpoints: tuple[str, str]):
    c = httpx.Client(base_url=BASE, timeout=10)
    _attach_auth(c)
    for eid, ep in ids_and_endpoints:
        with contextlib.suppress(Exception):
            c.delete(f"{ep}/{eid}")
    c.close()


def _read_redis(pattern: str) -> list[str]:
    """Read values from Redis matching a key pattern (via docker exec)."""
    try:
        out = subprocess.run(
            ["docker", "exec", "virtual-team-redis", "redis-cli", "-n", "1", "KEYS", pattern],
            capture_output=True, text=True, timeout=5,
        )
        if not out.stdout.strip():
            return []
        keys = out.stdout.strip().split("\n")
        vals = subprocess.run(
            ["docker", "exec", "virtual-team-redis", "redis-cli", "-n", "1", "MGET"] + keys,
            capture_output=True, text=True, timeout=5,
        )
        return [v for v in vals.stdout.strip().split("\n") if v]
    except Exception:
        return []


def _delete_redis(pattern: str):
    """Delete Redis keys matching a pattern (via docker exec)."""
    try:
        out = subprocess.run(
            ["docker", "exec", "virtual-team-redis", "redis-cli", "-n", "1", "KEYS", pattern],
            capture_output=True, text=True, timeout=5,
        )
        if out.stdout.strip():
            subprocess.run(
                ["docker", "exec", "virtual-team-redis", "redis-cli", "-n", "1", "DEL"]
                + out.stdout.strip().split("\n"),
                capture_output=True, timeout=5,
            )
    except Exception:
        pass


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
    _attach_auth(a.client)
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
