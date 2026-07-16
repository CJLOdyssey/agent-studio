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

from virtual_team.base import Base
from virtual_team.logging_config import get_logger

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
    def _before_execute(conn, cursor, statement, parameters, context, executemany):  # noqa: PLR0913
        conn.info.setdefault("_query_start", []).append(time.time())

    @event.listens_for(engine.sync_engine, "after_cursor_execute")
    def _after_execute(conn, cursor, statement, parameters, context, executemany):  # noqa: PLR0913
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
    global _async_engine
    if _async_engine is None:
        _async_engine = create_async_engine(
            DATABASE_URL,
            echo=False,
            poolclass=NullPool,
        )
        _attach_slow_query_listeners(_async_engine)
    return _async_engine

def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _async_session_factory
    if _async_session_factory is None:
        _async_session_factory = async_sessionmaker(get_async_engine(), expire_on_commit=False)
    return _async_session_factory

async def init_db():
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

    await seed_default_roles_and_admin()

async def seed_default_roles_and_admin():
    """Create default roles (admin, member) and an admin user if they don't exist."""
    import bcrypt
    from sqlalchemy import select

    factory = get_session_factory()
    async with factory() as session:
        admin_role = await session.execute(select(RoleDB).where(RoleDB.name == "admin"))
        if not admin_role.scalar_one_or_none():
            session.add(RoleDB(name="admin", permissions={"all": True}))
        member_role = await session.execute(select(RoleDB).where(RoleDB.name == "member"))
        if not member_role.scalar_one_or_none():
            session.add(RoleDB(name="member", permissions={"read": True}))
        await session.commit()

        admin_user = await session.execute(select(UserDB).where(UserDB.username == "admin"))
        if not admin_user.scalar_one_or_none():
            admin_role_db = (
                await session.execute(select(RoleDB).where(RoleDB.name == "admin"))
            ).scalar_one_or_none()
            user = UserDB(
                username="admin",
                email="admin@legacy.local",
                password_hash=bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode(),
                is_active=True,
                is_verified=True,
            )
            session.add(user)
            await session.flush()
            if admin_role_db:
                session.add(UserRoleDB(user_id=user.id, role_id=admin_role_db.id))
            await session.commit()

async def log_audit(
    action: str,
    entity_type: str,
    entity_name: str = "",
    detail: str = "",
) -> None:
    """Write an audit log entry for a management CRUD operation."""
    from virtual_team.database import get_session_factory
    entry = AuditLogDB(  # noqa: F811 — module-level re-export exists
        action=action,
        entity_type=entity_type,
        entity_name=entity_name,
        detail=detail,
    )
    factory = get_session_factory()
    async with factory() as session:
        session.add(entry)
        await session.commit()

async def get_session():
    """Async generator yielding a database session (FastAPI Depends)."""
    factory = get_session_factory()
    async with factory() as session:
        yield session

# ── Backward-compatible re-exports ─────────────────────────────────────
# All ORM models moved to virtual_team.db_models package.
# These imports keep `from virtual_team.database import XxxDB` working.
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
