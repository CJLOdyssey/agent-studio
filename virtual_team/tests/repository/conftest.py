"""Repository test fixtures.

Provides an in-memory SQLite database for fast, isolated repository tests.
Monkey-patches ``virtual_team.database._async_session_factory`` so that
repository functions (which use ``get_session_factory()``) run against the
test database automatically.
"""

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    async_sessionmaker,
    create_async_engine,
)

from virtual_team.database import (
    AgentConfigDB,
    Base,
)
from virtual_team.database import (
    _async_session_factory as _real_factory,
)


def _set_factory(engine: AsyncEngine) -> None:
    """Replace the module-level session factory with a test one."""
    import virtual_team.database as db

    db._async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


def _restore_factory() -> None:
    """Restore the original session factory."""
    import virtual_team.database as db

    db._async_session_factory = _real_factory


@pytest.fixture(scope="session")
async def db_engine():
    """Create in-memory SQLite engine with all tables.

    This fixture is session-scoped: tables are created once and shared
    across all tests. Each test function receives the same engine; the
    repository functions internally manage their own sessions via
    ``get_session_factory()``, which we override to point at the test
    database.
    """
    engine = create_async_engine("sqlite+aiosqlite://", echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    _set_factory(engine)

    yield engine

    _restore_factory()
    await engine.dispose()


@pytest.fixture
async def sample_agent(db_engine):
    """Create and return a sample AgentConfigDB row for tests that need one."""
    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as session:
        agent = AgentConfigDB(
            id=str(uuid.uuid4()),
            name="Sample Agent",
            role_identifier=f"sample_{uuid.uuid4().hex[:8]}",
            system_prompt="You are a sample agent.",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        session.add(agent)
        await session.commit()
        await session.refresh(agent)
        return agent
