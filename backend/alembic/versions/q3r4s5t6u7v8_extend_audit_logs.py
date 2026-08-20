"""Extend audit_logs with tamper-evident + enrichment columns.

Adds level, before/after snapshots (diff), user_agent, request_id, and the
hash chain columns (prev_hash/hash) so the audit trail can show exactly what
changed, correlate to a request, and be verified against retroactive edits.
All new columns are nullable or defaulted so existing rows migrate cleanly.
"""

from alembic import op
import sqlalchemy as sa

revision = "q3r4s5t6u7v8"
down_revision = "p2q3r4s5t6u7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("audit_logs")}

    if "level" not in existing:
        op.add_column(
            "audit_logs",
            sa.Column(
                "level", sa.String(8), nullable=False, server_default="info"
            ),
        )
    if "before_snapshot" not in existing:
        op.add_column(
            "audit_logs", sa.Column("before_snapshot", sa.Text, nullable=True)
        )
    if "after_snapshot" not in existing:
        op.add_column(
            "audit_logs", sa.Column("after_snapshot", sa.Text, nullable=True)
        )
    if "user_agent" not in existing:
        op.add_column(
            "audit_logs",
            sa.Column("user_agent", sa.String(255), nullable=False, server_default=""),
        )
    if "request_id" not in existing:
        op.add_column(
            "audit_logs",
            sa.Column("request_id", sa.String(36), nullable=False, server_default=""),
        )
    if "prev_hash" not in existing:
        op.add_column(
            "audit_logs",
            sa.Column("prev_hash", sa.String(64), nullable=False, server_default=""),
        )
    if "hash" not in existing:
        op.add_column(
            "audit_logs",
            sa.Column("hash", sa.String(64), nullable=False, server_default=""),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("audit_logs")}
    for col in ("hash", "prev_hash", "request_id", "user_agent",
                "after_snapshot", "before_snapshot", "level"):
        if col in existing:
            op.drop_column("audit_logs", col)
