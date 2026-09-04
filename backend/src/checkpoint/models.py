"""检查点数据模型 —— ORM 实体与内存数据类。"""

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

from db.base import Base
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column


class CheckpointDB(Base):
    """用于持久化 agent 检查点状态的 ORM 模型。"""

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
    agent_state: Mapped[str] = mapped_column(Text, nullable=False)  # JSON 序列化后的状态
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )


@dataclass
class AgentCheckpoint:
    """已保存 agent 状态的内存表示。"""

    session_id: str
    run_id: str | None
    step_index: int
    system_prompt: str = ""
    user_input: str = ""
    messages: list[dict[str, object]] = field(default_factory=list)
    react_steps: list[dict[str, object]] = field(default_factory=list)

    def to_json(self) -> str:
        """将检查点序列化为 JSON 字符串。"""
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
        """将 JSON 字符串反序列化回 AgentCheckpoint。"""
        obj = json.loads(data)
        return cls(**obj)
