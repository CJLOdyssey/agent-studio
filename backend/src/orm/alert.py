"""Alert rules, alert events, notifications, and notification subscriptions ORM models.

Schema notes:
- Metric type / severity / operator / status are stored as plain VARCHAR with
  documented value sets (see comments). The Pydantic layer validates values on
  write; using native PG enums would couple every future value change to a
  migration, which the monitoring feature iterates quickly.
- ``notifications.user_id`` has no FK to ``users``: in ``legacy`` auth mode
  (AUTH_MODE=legacy) the authenticated identity is the fixed ``"admin"`` id
  that may not exist in the ``users`` table.
"""

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from core.base import Base


class AlertRuleDB(Base):
    """A configurable monitoring rule evaluated on a periodic tick."""

    __tablename__ = "alert_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    metric_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        comment="success_rate|p95_latency|avg_latency|daily_cost|error_count",
    )
    operator: Mapped[str] = mapped_column(String(4), nullable=False, comment="gt|lt|gte|lte")
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    window_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=3600)
    severity: Mapped[str] = mapped_column(String(8), nullable=False, comment="P1|P2|P3")
    runbook_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    cooldown_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=300)
    silence_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    team_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False, default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )


class AlertEventDB(Base):
    """A firing/resolved/acknowledged instance of an alert rule."""

    __tablename__ = "alert_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    rule_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    metric_value: Mapped[float] = mapped_column(Float, nullable=False)
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(String(8), nullable=False, comment="P1|P2|P3")
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="firing",
        comment="firing|resolved|acked",
    )
    message: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        index=True,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_alert_events_rule_status", "rule_id", "status"),
        Index("idx_alert_events_triggered", "triggered_at"),
    )


class NotificationDB(Base):
    """In-app notification shown in the top-bar bell."""

    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    type: Mapped[str] = mapped_column(String(16), nullable=False, default="alert", comment="alert|system")
    link: Mapped[str | None] = mapped_column(String(512), nullable=True, comment="frontend route for drill-down")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        index=True,
    )

    __table_args__ = (Index("idx_notifications_user_unread", "user_id", "read_at", "created_at"),)


class NotificationSubscriptionDB(Base):
    """Per-user alert delivery preference: which severities to surface."""

    __tablename__ = "notification_subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(8), nullable=False, comment="P1|P2|P3")
    team_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
