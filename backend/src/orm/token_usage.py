"""用于成本跟踪的 token 用量 ORM 模型。"""

from datetime import UTC, datetime

from db.base import Base
from sqlalchemy import DateTime, Float, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column


class TokenUsageDB(Base):
    """跟踪 token 消耗与成本的 ORM 模型。"""

    __tablename__ = "token_usage"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    run_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    node_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    team_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    # 本次调用所用 API 密钥的稳定内部 ID（user_api_keys.id）；空 = 未走已登记密钥（如 env 兜底）
    key_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    __table_args__ = (
        Index("idx_token_usage_team_time", "team_id", "timestamp"),
        Index("idx_token_usage_user_time", "user_id", "timestamp"),
        Index("idx_token_usage_model", "model"),
    )
