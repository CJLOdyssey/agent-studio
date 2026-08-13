"""Create audit_logs table + user_name/client_ip for detailed audit trail.

The audit_logs table was previously created only via ORM create_all
(orm/team.py AuditLogDB), never through alembic — so pure-alembic
environments (CI preflight) failed with "relation audit_logs does not
exist" when this migration added columns. Table creation is folded in
here (guarded for already-existing DBs) so the migration chain is
self-contained.
"""

from alembic import op
import sqlalchemy as sa

revision = "k1a2b3c4d5e6f"
down_revision = "j2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "audit_logs" not in inspector.get_table_names():
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("action", sa.String(64), nullable=False),
            sa.Column("entity_type", sa.String(32), nullable=False),
            sa.Column("entity_name", sa.String(255), nullable=False, server_default=""),
            sa.Column("detail", sa.Text, nullable=False, server_default=""),
            sa.Column("user_name", sa.String(64), nullable=False, server_default=""),
            sa.Column("client_ip", sa.String(64), nullable=False, server_default=""),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
        )
        op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
        op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])
    else:
        # Legacy DBs that already have the table via ORM create_all: ensure the
        # two columns added by the original version of this migration exist.
        cols = {c["name"] for c in inspector.get_columns("audit_logs")}
        if "user_name" not in cols:
            op.add_column(
                "audit_logs",
                sa.Column("user_name", sa.String(64), nullable=False, server_default=""),
            )
        if "client_ip" not in cols:
            op.add_column(
                "audit_logs",
                sa.Column("client_ip", sa.String(64), nullable=False, server_default=""),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "audit_logs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("audit_logs")}
    if "client_ip" in cols:
        op.drop_column("audit_logs", "client_ip")
    if "user_name" in cols:
        op.drop_column("audit_logs", "user_name")
    if "action" not in cols:  # table was created by this migration — drop it
        op.drop_table("audit_logs")
