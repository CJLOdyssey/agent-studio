"""Add team_id to sessions for cross-device team identity persistence.

The ORM (orm/session.py) already declares sessions.team_id; databases created
via create_all() have it. This migration only adds it for databases that
predate the column — guarded so pre-existing DBs are untouched (mirrors
l1a2b3c4d5e6_restore_skills_owner_id).
"""

from alembic import op
import sqlalchemy as sa

revision = "m1a2b3c4d5e6f"
down_revision = "l1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("sessions")}
    if "team_id" not in cols:
        op.add_column("sessions", sa.Column("team_id", sa.String(36), nullable=True))
        op.create_index("ix_sessions_team_id", "sessions", ["team_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("sessions")}
    if "team_id" in cols:
        op.drop_index("ix_sessions_team_id", table_name="sessions")
        op.drop_column("sessions", "team_id")
