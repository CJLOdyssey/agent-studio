"""add llm_spans table

Adds the per-LLM-invocation span table that powers the trace browser
(trace root = project_runs.id). Mirrors the columns in orm/llm_span.py.

Revision ID: a7b8c9d0e1f2
Revises: x9y8z7a6b5c4
Create Date: 2026-09-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'x9y8z7a6b5c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if not insp.has_table('llm_spans'):
        op.create_table(
            'llm_spans',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('run_id', sa.String(36), nullable=False),
            sa.Column('session_id', sa.String(36), nullable=True),
            sa.Column('parent_span_id', sa.String(36), nullable=True),
            sa.Column('team_id', sa.String(36), nullable=True),
            sa.Column('user_id', sa.String(128), nullable=True),
            sa.Column('key_id', sa.String(36), nullable=True),
            sa.Column('span_type', sa.String(16), nullable=False),
            sa.Column('node_id', sa.String(255), nullable=False),
            sa.Column('model', sa.String(128), nullable=False),
            sa.Column('prompt_tokens', sa.Integer(), nullable=False),
            sa.Column('completion_tokens', sa.Integer(), nullable=False),
            sa.Column('total_tokens', sa.Integer(), nullable=False),
            sa.Column('cost_usd', sa.Float(), nullable=False),
            sa.Column('duration_ms', sa.Integer(), nullable=False),
            sa.Column('status', sa.String(16), nullable=False),
            sa.Column('error', sa.Text(), nullable=True),
            sa.Column('input_snapshot', sa.Text(), nullable=True),
            sa.Column('output_snapshot', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index('ix_llm_spans_run_id', 'llm_spans', ['run_id'])
        op.create_index('ix_llm_spans_parent_span_id', 'llm_spans', ['parent_span_id'])
        op.create_index('ix_llm_spans_session_id', 'llm_spans', ['session_id'])
        op.create_index('ix_llm_spans_model', 'llm_spans', ['model'])
        op.create_index('ix_llm_spans_team_id', 'llm_spans', ['team_id'])
        op.create_index('ix_llm_spans_user_id', 'llm_spans', ['user_id'])
        op.create_index('ix_llm_spans_key_id', 'llm_spans', ['key_id'])
        op.create_index('ix_llm_spans_node_id', 'llm_spans', ['node_id'])
        op.create_index('ix_llm_spans_created_at', 'llm_spans', ['created_at'])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if insp.has_table('llm_spans'):
        op.drop_table('llm_spans')
