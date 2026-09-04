"""告警规则、告警事件、通知与通知订阅的 ORM 模型。

Schema 说明：
- 指标类型 / 严重级别 / 操作符 / 状态以普通 VARCHAR 存储，取值集合见注释。
  写入时由 Pydantic 层校验；使用原生 PG 枚举会把未来每次取值变更都耦合到一次
  迁移上，而监控功能迭代很快。
- ``notifications.user_id`` 无指向 ``users`` 的外键：在 ``legacy`` 认证模式
  （AUTH_MODE=legacy）下，认证身份是固定 ``"admin"`` ID，可能不存在于 ``users`` 表。
"""

from datetime import UTC, datetime

from db.base import Base
from sqlalchemy import Boolean, DateTime, Float, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column


class AlertRuleDB(Base):
    """在周期性 tick 上评估的可配置监控规则。"""

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
    """某告警规则的触发/已解决/已确认实例。"""

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
    """显示在顶栏铃铛中的应用内通知。"""

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
    """按用户的告警投递偏好：需要展示哪些严重级别。"""

    __tablename__ = "notification_subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(8), nullable=False, comment="P1|P2|P3")
    team_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
