"""Attachments decoupled from sessions: user_id column, session_id nullable.

Pre-session uploads (first message carries files before any session exists)
are owned by the uploader; session_id is bound later by run creation.

Revision ID: j1a2b3c4d5e6
Revises: i8b9c0d1e2f3
Create Date: 2026-08-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'j1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'i8b9c0d1e2f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "attachments",
        sa.Column("user_id", sa.String(length=128), nullable=True),
    )
    op.alter_column(
        "attachments",
        "session_id",
        existing_type=sa.String(length=36),
        nullable=True,
    )
    op.create_index("ix_attachments_user_id", "attachments", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_attachments_user_id", table_name="attachments")
    op.alter_column(
        "attachments",
        "session_id",
        existing_type=sa.String(length=36),
        nullable=False,
    )
    op.drop_column("attachments", "user_id")
