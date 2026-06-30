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

from virtual_team.database import Base, get_session_factory
from virtual_team.logging_config import get_logger

logger = get_logger(__name__)


def create_checkpointer(
    backend: str | None = None,
    dsn: str | None = None,
) -> "BaseCheckpointSaver":  # noqa: F821 — lazy import avoids circular dep
    """Create a checkpointer based on environment configuration.

    When called without arguments, reads ``CHECKPOINTER_BACKEND`` and
    ``CHECKPOINTER_DSN`` from environment. Defaults to SQLite with an
    in-process database file.

    Supported backends:
        sqlite (default) — ``SqliteSaver`` backed by a local file.
        memory — ``MemorySaver`` (no persistence across restarts).
        postgres — ``PostgresSaver`` (requires ``CHECKPOINTER_DSN``).

    Returns a ``BaseCheckpointSaver``-compatible instance for use with
    ``workflow.compile(checkpointer=...)``.
    """
    import os

    if backend is None:
        backend = os.environ.get("CHECKPOINTER_BACKEND", "sqlite")
    if dsn is None:
        dsn = os.environ.get("CHECKPOINTER_DSN")

    logger.info("Creating checkpointer for backend=%s", backend)

    if backend == "postgres":
        if not dsn:
            raise ValueError("CHECKPOINTER_DSN is required for postgres backend")
        logger.info("Creating AsyncPostgresSaver checkpointer")
        try:
            import asyncio

            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver  # type: ignore[import-untyped]
        except ImportError as exc:
            raise ImportError(
                "Postgres checkpointer requires `langgraph-checkpoint-postgres` extra"
            ) from exc

        async def _init_pg() -> AsyncPostgresSaver:
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

        return asyncio.run(_init_pg())

    if backend == "sqlite":
        if not dsn:
            dsn = "checkpoints.db"
        logger.info("Creating AsyncSqliteSaver checkpointer (dsn=%s)", dsn)
        try:
            import asyncio

            import aiosqlite

            from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver  # type: ignore[import-untyped]

            async def _init_sqlite() -> AsyncSqliteSaver:
                conn = await aiosqlite.connect(dsn)
                return AsyncSqliteSaver(conn)

            return asyncio.run(_init_sqlite())
        except ImportError as exc:
            raise ImportError(
                "SQLite checkpointer requires `langgraph-checkpoint-sqlite` extra "
                "and `aiosqlite` package"
            ) from exc

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
