"""SLO 定义 ORM 模型。

持久化可配置的 SLO 目标（名称、指标、目标百分比、窗口）。预算快照基于 runs
实时计算（见 ``monitoring/slo.py``）而非存储 —— 避免一个可能偏离事实来源的
冗余预聚合表。
"""

from datetime import UTC, datetime

from db.base import Base
from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column


class SLIDefinitionDB(Base):
    """在滚动窗口内评估的可配置 SLO 目标。"""

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
