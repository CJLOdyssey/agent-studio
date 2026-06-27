"""
Test infrastructure: fixtures for database, HTTP client, and Celery.

Provides:
  db_engine    → module-scoped in-memory SQLite async engine
  async_session → function-scoped session (auto-rollback per test)
  test_client  → function-scoped httpx.AsyncClient against a fresh FastAPI app
  sample_agent → seeded AgentConfigDB row
  sample_user  → dict stub
  celery_eager → sets Celery to eager mode for testing

Usage:
  PYTHONPATH=. python3 -m pytest virtual_team/ -v --tb=short
"""

import asyncio
import sys
from pathlib import Path
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Ensure virtual_team is importable (robust regardless of PYTHONPATH)
_sys_insert = str(Path(__file__).resolve().parent.parent.parent)
if _sys_insert not in sys.path:
    sys.path.insert(0, _sys_insert)

import virtual_team.database as _db  # noqa: E402 (needs sys.path first)

# ──────────────────────────────────────────────────────────────────────────────
# Module-level event_loop override (required for module-scoped async fixtures)
# ──────────────────────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def event_loop():
    """Override default event_loop to module scope so db_engine lives per-module."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ──────────────────────────────────────────────────────────────────────────────
# Database fixtures
# ──────────────────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture(scope="module")
async def db_engine():
    """Create an in-memory SQLite async engine, initialize all tables.

    Monkey-patches database module globals so repository/route code uses
    this engine instead of the production PostgreSQL one.
    """
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        echo=False,
    )

    # Create all tables defined in Base.metadata
    async with engine.begin() as conn:
        await conn.run_sync(_db.Base.metadata.create_all)

    # Override module-level singletons
    _orig_engine = _db._async_engine
    _orig_factory = _db._async_session_factory
    _db._async_engine = engine
    _db._async_session_factory = async_sessionmaker(engine, expire_on_commit=False)

    yield engine

    # Restore originals and clean up
    _db._async_engine = _orig_engine
    _db._async_session_factory = _orig_factory
    await engine.dispose()


@pytest_asyncio.fixture
async def async_session(db_engine):
    """Provide a fresh session per test, auto-rolled back on teardown.

    Use this fixture to seed data directly. The underlying engine is shared
    (module-scoped), so data seeded here is visible to API routes which use
    get_session_factory() — both create independent sessions against the
    same SQLite in-memory database.
    """
    session = AsyncSession(bind=db_engine, expire_on_commit=False)
    yield session
    await session.rollback()
    await session.close()


# ──────────────────────────────────────────────────────────────────────────────
# Celery eager-mode fixture
# ──────────────────────────────────────────────────────────────────────────────


@pytest.fixture
def celery_eager():
    """Run Celery tasks synchronously (task_always_eager=True) during tests."""
    from virtual_team.broker import celery_app

    prev = celery_app.conf.task_always_eager
    celery_app.conf.task_always_eager = True
    yield
    celery_app.conf.task_always_eager = prev


# ──────────────────────────────────────────────────────────────────────────────
# Sample data fixtures
# ──────────────────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def sample_agent(db_engine, async_session):
    """Create a sample AgentConfigDB row and return it."""
    from datetime import UTC, datetime

    from virtual_team.database import AgentConfigDB

    agent = AgentConfigDB(
        id=str(uuid4()),
        name="Test Agent",
        role_identifier=f"test_agent_{uuid4().hex[:6]}",
        system_prompt="You are a helpful test agent.",
        output_constraints=None,
        tools=None,
        mcp=None,
        skills=None,
        model=None,
        temperature=None,
        order=0,
        is_active=True,
        is_approver=False,
        icon="🤖",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_session.add(agent)
    await async_session.commit()
    await async_session.refresh(agent)
    return agent


@pytest.fixture
def sample_user():
    """Return a test user dict stub (does not hit the DB)."""
    return {"username": "testuser", "id": 1}


# ──────────────────────────────────────────────────────────────────────────────
# HTTP test client fixture
# ──────────────────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def test_client():
    """Create an httpx.AsyncClient backed by a fresh FastAPI app.

    Builds a minimal FastAPI instance that includes only the routers we
    test — no RateLimitMiddleware, no AuthMiddleware, no CORS — so we
    avoid Redis / JWT dependencies.
    """
    import httpx
    from fastapi import FastAPI

    from virtual_team.routers.agents import router as agents_router
    from virtual_team.routers.prompts import router as prompts_router
    from virtual_team.routers.teams import router as teams_router

    # Fresh app with no lifespan / middleware
    app = FastAPI()
    app.include_router(agents_router)
    app.include_router(prompts_router)
    app.include_router(teams_router)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
