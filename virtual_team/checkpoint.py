"""
Conversation checkpoint system.

Persists agent state after each ReAct step so conversations survive
restarts and can be resumed from where they left off.

LangGraph-level checkpointer uses MemorySaver (no async-compat issues).
App-level persistence is handled by save_checkpoint() / load_latest_checkpoint()
writing to the PostgreSQL ``checkpoints`` table.
"""

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, text as sa_text
from sqlalchemy.orm import Mapped, mapped_column

from virtual_team.database import Base, get_session_factory
from virtual_team.logging_config import get_logger

logger = get_logger(__name__)


def create_checkpointer() -> BaseCheckpointSaver:
    """Create a MemorySaver checkpointer (sync + async compatible).

    LangGraph-level checkpoint persistence is intentionally bypassed in
    favour of app-level ``save_checkpoint()`` / ``load_latest_checkpoint()``
    which persist to the PostgreSQL ``checkpoints`` table.
    """
    logger.info("Creating MemorySaver checkpointer")
    return MemorySaver()


# ── Database model ───────────────────────────────────────────────────────────


class CheckpointDB(Base):
    __tablename__ = "checkpoints"

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
        return obj.id


async def load_latest_checkpoint(session_id: str) -> AgentCheckpoint | None:
    """Load the most recent checkpoint for a session."""
    factory = get_session_factory()
    async with factory() as session:
        result = (
            await session.execute(
                sa_text(
                    "SELECT id, session_id, run_id, step_index, agent_state "
                    "FROM checkpoints WHERE session_id = :sid "
                    "ORDER BY created_at DESC LIMIT 1"
                ).bindparams(sid=session_id)
            )
        ).first()
        if result is None:
            return None
        return AgentCheckpoint(
            session_id=result.session_id,
            run_id=result.run_id,
            step_index=result.step_index,
            **json.loads(result.agent_state),
        )
