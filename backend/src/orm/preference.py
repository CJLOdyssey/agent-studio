"""UserPreferenceDB ORM model — cross-device user preferences (K-V)."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from core.base import Base


class UserPreferenceDB(Base):
    """Generic key-value user preference (selected_model, future: theme...).

    Keys are app-defined constants; values are JSON. PK(user_id, key) keeps
    one row per preference per user; upsert on write.
    """

    __tablename__ = "user_preferences"
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), primary_key=True)
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[Any] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )
