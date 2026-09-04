"""Shared fixtures for monitoring module tests — isolated in-memory SQLite."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import core.infra.database as db_mod
from core.infra.database import Base


@pytest.fixture
async def db():
    """In-memory SQLite with all tables; swaps the global session factory."""
    engine = create_async_engine("sqlite+aiosqlite://", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    saved_factory = db_mod._async_session_factory
    db_mod._async_session_factory = factory
    try:
        yield factory
    finally:
        db_mod._async_session_factory = saved_factory
        await engine.dispose()


def make_run(
    *,
    status: str = "converged",
    created_at: datetime | None = None,
    duration_s: float = 1.0,
) -> dict:
    """Factory for a ProjectRun row dict (id/session_id optional for FK-free tests)."""
    now = created_at or datetime.now(UTC)
    return {
        "id": str(uuid.uuid4()),
        "session_id": None,
        "requirement": "test",
        "status": status,
        "created_at": now,
        "updated_at": now + timedelta(seconds=duration_s),
    }


def make_token_usage(*, cost_usd: float = 0.0, timestamp: datetime | None = None) -> dict:
    now = timestamp or datetime.now(UTC)
    return {
        "id": str(uuid.uuid4()),
        "run_id": str(uuid.uuid4()),
        "node_id": "node-a",
        "team_id": None,
        "model": "test-model",
        "prompt_tokens": 10,
        "completion_tokens": 5,
        "total_tokens": 15,
        "cost_usd": cost_usd,
        "timestamp": now,
    }


def make_rule(**overrides) -> dict:
    base = {
        "id": str(uuid.uuid4()),
        "name": "test rule",
        "metric_type": "error_count",
        "operator": "gt",
        "threshold": 0.0,
        "window_seconds": 3600,
        "severity": "P2",
        "cooldown_seconds": 300,
        "enabled": True,
        "created_by": "system",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    base.update(overrides)
    return base


@pytest.fixture
def run_factory():
    return make_run


@pytest.fixture
def rule_factory():
    return make_rule
