"""add key_id to token_usage

The token_usage table is created for fresh databases via ORM create_all()
(idempotent). This migration only adds the key_id column for databases that
already have the table built from the legacy migration chain, so cost records
can later be filtered by the API key (user_api_keys.id) that served the call.

Revision ID: x9y8z7a6b5c4
Revises: q3r4s5t6u7v8
Create Date: 2026-09-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'x9y8z7a6b5c4'
down_revision: Union[str, None] = 'q3r4s5t6u7v8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if insp.has_table('token_usage'):
        cols = {c['name'] for c in insp.get_columns('token_usage')}
        if 'key_id' not in cols:
            op.add_column('token_usage', sa.Column('key_id', sa.String(36), nullable=True))
            op.create_index('ix_token_usage_key_id', 'token_usage', ['key_id'])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if insp.has_table('token_usage'):
        cols = {c['name'] for c in insp.get_columns('token_usage')}
        if 'key_id' in cols:
            op.drop_index('ix_token_usage_key_id', table_name='token_usage')
            op.drop_column('token_usage', 'key_id')
