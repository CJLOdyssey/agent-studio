"""Add user_api_keys.model_types (JSONB map: model name -> capability).

Optional per-model type override captured at model-fetch time (provider
sub_type) or set manually in the key form. NULL means fall back to the
name heuristic in /api/models.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "j2a3b4c5d6e7"
down_revision = "j1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_api_keys",
        sa.Column("model_types", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_api_keys", "model_types")
