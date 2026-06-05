"""Add teams and team_agents tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-03
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "teams",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_expanded", sa.Boolean, nullable=False, server_default="f"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "team_agents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("team_id", sa.String(36), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("agent_config_id", sa.String(36),
                  sa.ForeignKey("agent_configs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("role", sa.String(64), nullable=False, server_default="待配置角色"),
        sa.Column("order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("team_agents")
    op.drop_table("teams")
