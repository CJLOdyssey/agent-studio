"""UserPreferenceDB ORM 模型 —— 跨设备用户偏好（K-V）。"""

from datetime import UTC, datetime
from typing import Any

from db.base import Base
from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column


class UserPreferenceDB(Base):
    """通用键值用户偏好（selected_model，未来：theme...）。

    键为应用定义的常量；值为 JSON。PK(user_id, key) 保证每用户每偏好一行；写入时 upsert。
    """

    __tablename__ = "user_preferences"
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), primary_key=True)
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[Any] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )
