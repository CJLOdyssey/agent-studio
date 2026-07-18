from collections.abc import AsyncIterator
from typing import Any

"""Database engine and session factory with slow-query detection."""

import os
import time

from sqlalchemy import (
    event,
    text,
)
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from virtual_team.core.base import Base
from virtual_team.core.infra.logging_config import get_logger

logger = get_logger(__name__)

# Queries exceeding this threshold (seconds) are logged as warnings
SLOW_QUERY_THRESHOLD = 0.5

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/virtual_team",
)

_async_engine: AsyncEngine | None = None
_async_session_factory: async_sessionmaker[AsyncSession] | None = None

def _attach_slow_query_listeners(engine: AsyncEngine) -> None:
    @event.listens_for(engine.sync_engine, "before_cursor_execute")
    def _before_execute(
        conn: Any, cursor: Any, statement: Any, parameters: Any, context: Any, executemany: Any
    ) -> None:  # noqa: PLR0913
        conn.info.setdefault("_query_start", []).append(time.time())

    @event.listens_for(engine.sync_engine, "after_cursor_execute")
    def _after_execute(conn: Any, cursor: Any, statement: Any, parameters: Any, context: Any, executemany: Any) -> None:  # noqa: PLR0913
        start = conn.info["_query_start"].pop()
        elapsed = time.time() - start
        if elapsed > SLOW_QUERY_THRESHOLD:
            # Truncate long statements to avoid log flooding
            stmt = statement[:300] if isinstance(statement, str) else str(statement)[:300]
            logger.warning(
                "Slow query (%.2fs): %s",
                elapsed, stmt,
            )

def get_async_engine() -> AsyncEngine:
    """Return or create the singleton async SQLAlchemy engine."""
    global _async_engine
    if _async_engine is None:
        pool_size = int(os.environ.get("DATABASE_POOL_SIZE", "20"))
        max_overflow = int(os.environ.get("DATABASE_POOL_OVERFLOW", "10"))
        _async_engine = create_async_engine(
            DATABASE_URL,
            echo=False,
            poolclass=NullPool if pool_size == 0 else None,
            pool_size=pool_size if pool_size > 0 else None,
            max_overflow=max_overflow if pool_size > 0 else None,
        )
        _attach_slow_query_listeners(_async_engine)
    return _async_engine

def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return or create the singleton async session factory."""
    global _async_session_factory
    if _async_session_factory is None:
        _async_session_factory = async_sessionmaker(get_async_engine(), expire_on_commit=False)
    return _async_session_factory

async def init_db() -> None:
    """Bootstrap database tables on first run.

    Uses create_all() which is idempotent — only creates tables that don't
    already exist. For production deployments with existing data, use Alembic
    migrations instead:

        alembic upgrade head

    See alembic/versions/ for migration history.
    """
    # Lazy-register checkpoint model to avoid circular import
    from virtual_team.checkpoint import CheckpointDB  # noqa: F401

    engine = get_async_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Enterprise: add FK + index for agent_id on existing sessions table
        await conn.execute(
            text(
                """
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'sessions_agent_id_fkey'
                ) THEN
                    UPDATE sessions SET agent_id = NULL
                    WHERE agent_id IS NOT NULL
                    AND agent_id NOT IN (
                        SELECT id FROM agent_configs
                    );
                    ALTER TABLE sessions
                    ADD CONSTRAINT sessions_agent_id_fkey
                    FOREIGN KEY (agent_id) REFERENCES agent_configs(id)
                    ON DELETE SET NULL;
                END IF;
            END $$;
        """
            )
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_sessions_agent_id ON sessions(agent_id);")
        )

    from virtual_team.core.seed import seed_default_roles_and_admin  # noqa: F401
    await seed_default_roles_and_admin()



async def get_session() -> AsyncIterator[AsyncSession]:
    """Async generator yielding a database session (FastAPI Depends)."""
    factory = get_session_factory()
    async with factory() as session:
        yield session

# ── Backward-compatible re-exports ─────────────────────────────────────
# All ORM models moved to virtual_team.db_models package.
# These imports keep `from virtual_team.core.infra.database import XxxDB` working.
from virtual_team.db_models import (  # noqa: E402, F401
    AgentConfigDB,
    AttachmentDB,
    AuditLogDB,
    ChatMessage,
    CommandLogDB,
    KeyUsageLog,
    MCPServerDB,
    MemoryEntry,
    ProjectRun,
    PromptDB,
    RefreshTokenDB,
    RegisteredSkillDB,
    RegisteredToolDB,
    RoleDB,
    SessionDB,
    TeamAgentDB,
    TeamDB,
    UserApiKey,
    UserDB,
    UserRoleDB,
    VersionDB,
    WorkflowConfigDB,
    WorkflowEdgeDB,
    WorkflowNodeDB,
)

__all__ = [
    "AgentConfigDB", "AttachmentDB", "AuditLogDB",
    "ChatMessage", "CommandLogDB", "KeyUsageLog",
    "MCPServerDB", "MemoryEntry", "ProjectRun",
    "PromptDB", "RefreshTokenDB", "RegisteredSkillDB",
    "RegisteredToolDB", "RoleDB", "SessionDB",
    "TeamAgentDB", "TeamDB", "UserApiKey",
    "UserDB", "UserRoleDB", "VersionDB",
    "WorkflowConfigDB", "WorkflowEdgeDB", "WorkflowNodeDB",
]
