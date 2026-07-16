"""
Conversation checkpoint system.

Persists agent state after each ReAct step so conversations survive
restarts and can be resumed from where they left off.
"""

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from virtual_team.base import Base
from virtual_team.database import get_session_factory
from virtual_team.logging_config import get_logger

logger = get_logger(__name__)


def create_checkpointer(
    backend: str | None = None,
    dsn: str | None = None,
) -> BaseCheckpointSaver:
    """Create a checkpointer (sync wrapper — suitable for CLI / tests).

    When called without arguments, reads ``CHECKPOINTER_BACKEND`` and
    ``CHECKPOINTER_DSN`` from environment. Defaults to SQLite.

    For async contexts (Celery worker, FastAPI lifespan) call
    ``create_checkpointer_async`` instead.
    """
    import asyncio

    backend, dsn = _resolve_backend(backend, dsn)
    logger.info("Creating checkpointer for backend=%s", backend)

    if backend == "memory":
        return MemorySaver()

    # If no loop is running we can safely call asyncio.run().
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(_create_checkpointer_async(backend, dsn))

    # Already inside a running loop — run in a fresh loop on another thread.
    import concurrent.futures

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as _pool:
        return _pool.submit(asyncio.run, _create_checkpointer_async(backend, dsn)).result()


async def create_checkpointer_async(
    backend: str | None = None,
    dsn: str | None = None,
) -> BaseCheckpointSaver:
    """Async checkpointer factory — safe to await inside a running loop.

    Preferred over ``create_checkpointer`` in Celery tasks and other async
    contexts because it avoids the overhead and edge-cases of crossing thread
    boundaries.
    """
    backend, dsn = _resolve_backend(backend, dsn)
    return await _create_checkpointer_async(backend, dsn)


def _resolve_backend(backend: str | None, dsn: str | None) -> tuple[str, str | None]:
    import os

    if backend is None:
        backend = os.environ.get("CHECKPOINTER_BACKEND", "sqlite")
    if dsn is None:
        dsn = os.environ.get("CHECKPOINTER_DSN")
    return backend, dsn


async def _create_checkpointer_async(backend: str, dsn: str | None) -> BaseCheckpointSaver:
    """Internal — shared async logic for both entry-points."""
    if backend == "postgres":
        if not dsn:
            raise ValueError("CHECKPOINTER_DSN is required for postgres backend")
        logger.info("Creating AsyncPostgresSaver checkpointer")
        try:
            from langgraph.checkpoint.postgres.aio import (
                AsyncPostgresSaver,  # type: ignore[import-untyped]
            )
        except ImportError as exc:
            raise ImportError(
                "Postgres checkpointer requires `langgraph-checkpoint-postgres` extra"
            ) from exc

        from psycopg import AsyncConnection
        from psycopg.rows import dict_row

        conn = await AsyncConnection.connect(
            dsn,
            autocommit=True,
            prepare_threshold=0,
            row_factory=dict_row,  # type: ignore[arg-type]
        )
        saver = AsyncPostgresSaver(conn)  # type: ignore[arg-type]
        await saver.setup()
        return saver

    if backend == "sqlite":
        if not dsn:
            dsn = "checkpoints.db"
        logger.info("Creating AsyncSqliteSaver checkpointer (dsn=%s)", dsn)
        try:
            import aiosqlite
            from langgraph.checkpoint.sqlite.aio import (
                AsyncSqliteSaver,  # type: ignore[import-untyped]
            )
        except ImportError as exc:
            raise ImportError(
                "SQLite checkpointer requires `langgraph-checkpoint-sqlite` extra "
                "and `aiosqlite` package"
            ) from exc

        conn = await aiosqlite.connect(dsn)
        return AsyncSqliteSaver(conn)

    logger.info("Creating MemorySaver checkpointer (in-memory, no persistence)")
    return MemorySaver()


# ── Database model ───────────────────────────────────────────────────────────


class CheckpointDB(Base):
    __tablename__ = "agent_checkpoints"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    run_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("project_runs.id", ondelete="SET NULL"),
        nullable=True,
    )
    step_index: Mapped[int] = mapped_column(Integer, default=0)
    agent_state: Mapped[str] = mapped_column(Text, nullable=False)  # JSON-serialized state
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )


@dataclass
class AgentCheckpoint:
    """In-memory representation of a saved agent state."""

    session_id: str
    run_id: str | None
    step_index: int
    system_prompt: str = ""
    user_input: str = ""
    messages: list[dict] = field(default_factory=list)
    react_steps: list[dict] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(
            {
                "session_id": self.session_id,
                "run_id": self.run_id,
                "step_index": self.step_index,
                "system_prompt": self.system_prompt,
                "user_input": self.user_input,
                "messages": self.messages,
                "react_steps": self.react_steps,
            },
            ensure_ascii=False,
        )

    @classmethod
    def from_json(cls, data: str) -> "AgentCheckpoint":
        obj = json.loads(data)
        return cls(**obj)


# ── Repository functions ─────────────────────────────────────────────────────


async def save_checkpoint(checkpoint: AgentCheckpoint) -> str:
    """Persist an agent checkpoint to the database. Returns checkpoint ID."""
    factory = get_session_factory()
    async with factory() as session:
        obj = CheckpointDB(
            id=str(uuid4()),
            session_id=checkpoint.session_id,
            run_id=checkpoint.run_id,
            step_index=checkpoint.step_index,
            agent_state=checkpoint.to_json(),
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj.id


async def load_latest_checkpoint(session_id: str) -> AgentCheckpoint | None:
    """Load the most recent checkpoint for a session."""
    factory = get_session_factory()
    async with factory() as session:
        from sqlalchemy import desc, select

        stmt = (
            select(CheckpointDB)
            .where(CheckpointDB.session_id == session_id)
            .order_by(desc(CheckpointDB.created_at))
            .limit(1)
        )
        result = await session.execute(stmt)
        row = result.scalar_one_or_none()
        if row is None:
            return None
        return AgentCheckpoint.from_json(row.agent_state)


async def list_checkpoints(session_id: str) -> list[AgentCheckpoint]:
    """List all checkpoints for a session, oldest first."""
    factory = get_session_factory()
    async with factory() as session:
        from sqlalchemy import select

        stmt = (
            select(CheckpointDB)
            .where(CheckpointDB.session_id == session_id)
            .order_by(CheckpointDB.created_at)
        )
        result = await session.execute(stmt)
        return [AgentCheckpoint.from_json(row.agent_state) for row in result.scalars()]
