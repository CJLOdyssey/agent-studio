"""Global memory ORM model."""

from typing import Any

from sqlalchemy import JSON, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from core.base import Base


class GlobalMemoryDB(Base):
    """ORM model for global memory entries."""

    __tablename__ = "global_memory"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    source_sessions: Mapped[list[Any]] = mapped_column(JSON, default=list)
    created_at: Mapped[float] = mapped_column(Float, nullable=False)
    last_accessed: Mapped[float] = mapped_column(Float, nullable=False)
    access_count: Mapped[int] = mapped_column(Integer, default=0)
    decay_rate: Mapped[float] = mapped_column(Float, default=0.01)
    metadata_json: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
