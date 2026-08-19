"""SLO definition ORM model.

Persists configurable SLO targets (name, metric, target %, window). The
budget snapshot is computed live from runs (see ``monitoring/slo.py``) rather
than stored — avoiding a redundant pre-aggregation table that could drift from
the source of truth.
"""

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from core.base import Base


class SLIDefinitionDB(Base):
    """A configurable SLO target evaluated over a rolling window."""

    __tablename__ = "sli_definitions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    metric_type: Mapped[str] = mapped_column(
        String(32), nullable=False, comment="success_rate|p95_latency|avg_latency"
    )
    target_percent: Mapped[float] = mapped_column(Float, nullable=False, comment="SLO 目标，如 99.0")
    window_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    team_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False, default="system")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
