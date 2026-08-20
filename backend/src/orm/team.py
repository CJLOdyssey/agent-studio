"""CommandLogDB, AuditLogDB, AttachmentDB ORM models."""


from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from core.base import Base


class CommandLogDB(Base):
    __tablename__ = "command_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    command_id: Mapped[str] = mapped_column(String(64), nullable=False)
    command_name: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[str] = mapped_column(Text, default="")
    result: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )

class AuditLogDB(Base):
    """Admin audit log — records management CRUD operations (no session FK).

    ``before_snapshot``/``after_snapshot`` hold JSON payloads (stringified) of
    the pre/post state so the audit view can show exactly what changed.
    ``hash``/``prev_hash`` form a tamper-evident chain: each entry's hash is
    derived from the previous hash plus its own content, so altering any row
    breaks the chain and is detectable by a verification scan.
    """

    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_name: Mapped[str] = mapped_column(String(255), default="")
    detail: Mapped[str] = mapped_column(Text, default="")
    level: Mapped[str] = mapped_column(String(8), nullable=False, default="info", comment="info|warn|error")
    before_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True, comment="pre-state JSON (stringified)")
    after_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True, comment="post-state JSON (stringified)")
    user_name: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    client_ip: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    user_agent: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    request_id: Mapped[str] = mapped_column(String(36), default="", nullable=False)
    prev_hash: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    hash: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        index=True,
    )

class AttachmentDB(Base):
    __tablename__ = "attachments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="Null until bound to a run's session (pre-upload before first message)",
    )
    user_id: Mapped[str | None] = mapped_column(
        String(128), nullable=True, index=True,
        comment="Uploader; ownership check for pre-session attachments",
    )
    run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    filename: Mapped[str] = mapped_column(String(256), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), default="application/octet-stream")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
