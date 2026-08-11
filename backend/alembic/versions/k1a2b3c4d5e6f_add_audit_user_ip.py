"""Add audit_logs.user_name + client_ip for detailed audit trail.

Captured from the request context (JWT user + client address) at write
time; empty for guest/unauthenticated management operations.
"""

from alembic import op
import sqlalchemy as sa

revision = "k1a2b3c4d5e6f"
down_revision = "j2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("audit_logs", sa.Column("user_name", sa.String(64), nullable=False, server_default=""))
    op.add_column("audit_logs", sa.Column("client_ip", sa.String(64), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("audit_logs", "client_ip")
    op.drop_column("audit_logs", "user_name")
