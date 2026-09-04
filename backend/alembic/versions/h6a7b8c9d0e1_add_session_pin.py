"""Add is_pinned to sessions for sidebar pin-to-top.

Revision ID: h6a7b8c9d0e1
Revises: g4e5f6a7b8c9
Create Date: 2026-08-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'h6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'g4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("is_pinned", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("sessions", "is_pinned")