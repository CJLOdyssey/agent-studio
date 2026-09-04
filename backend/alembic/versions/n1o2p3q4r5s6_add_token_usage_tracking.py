"""add token usage tracking

Revision ID: n1o2p3q4r5s6
Revises: m3c4d5e6f7g8
Create Date: 2026-08-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'n1o2p3q4r5s6'
down_revision: Union[str, None] = 'm3c4d5e6f7g8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'token_usage',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('run_id', sa.String(36), nullable=False),
        sa.Column('node_id', sa.String(255), nullable=False),
        sa.Column('team_id', sa.String(36), nullable=True),
        sa.Column('model', sa.String(100), nullable=False),
        sa.Column('prompt_tokens', sa.Integer(), nullable=False),
        sa.Column('completion_tokens', sa.Integer(), nullable=False),
        sa.Column('total_tokens', sa.Integer(), nullable=False),
        sa.Column('cost_usd', sa.Float(), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_token_usage_run_id', 'token_usage', ['run_id'])
    op.create_index('idx_token_usage_team_id', 'token_usage', ['team_id'])
    op.create_index('idx_token_usage_timestamp', 'token_usage', ['timestamp'])


def downgrade() -> None:
    op.drop_index('idx_token_usage_timestamp', table_name='token_usage')
    op.drop_index('idx_token_usage_team_id', table_name='token_usage')
    op.drop_index('idx_token_usage_run_id', table_name='token_usage')
    op.drop_table('token_usage')
