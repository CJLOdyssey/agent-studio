"""Restore registered_skills.owner_id.

8347788032e5 dropped owner_id from registered_skills (legacy cleanup of a
column the ORM did not use at the time). RBAC ownership checks (auth/
ownership.py) later re-added the column to the ORM model (RegisteredSkillDB),
but no migration brought it back — fresh PostgreSQL databases fail every
skill insert with "column owner_id of relation registered_skills does not
exist". Guarded so pre-existing DBs that kept the column are untouched.
"""

from alembic import op
import sqlalchemy as sa

revision = "l1a2b3c4d5e6"
down_revision = "k1a2b3c4d5e6f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("registered_skills")}
    if "owner_id" not in cols:
        op.add_column(
            "registered_skills",
            sa.Column("owner_id", sa.String(36), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("registered_skills")}
    if "owner_id" in cols:
        op.drop_column("registered_skills", "owner_id")
