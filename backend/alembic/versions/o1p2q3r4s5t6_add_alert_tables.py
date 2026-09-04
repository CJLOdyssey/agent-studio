"""add alert rules, alert events, notifications, subscriptions

Revision ID: o1p2q3r4s5t6
Revises: n1o2p3q4r5s6
Create Date: 2026-08-19 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'o1p2q3r4s5t6'
down_revision: Union[str, None] = 'n1o2p3q4r5s6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'alert_rules',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(128), nullable=False),
        sa.Column('metric_type', sa.String(32), nullable=False),
        sa.Column('operator', sa.String(4), nullable=False),
        sa.Column('threshold', sa.Float(), nullable=False),
        sa.Column('window_seconds', sa.Integer(), nullable=False),
        sa.Column('severity', sa.String(8), nullable=False),
        sa.Column('runbook_url', sa.String(512), nullable=True),
        sa.Column('cooldown_seconds', sa.Integer(), nullable=False),
        sa.Column('silence_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('team_id', sa.String(36), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.String(128), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_alert_rules_team_id', 'alert_rules', ['team_id'])

    op.create_table(
        'alert_events',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('rule_id', sa.String(36), nullable=False),
        sa.Column('metric_value', sa.Float(), nullable=False),
        sa.Column('threshold', sa.Float(), nullable=False),
        sa.Column('severity', sa.String(8), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('message', sa.String(512), nullable=False),
        sa.Column('triggered_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('acked_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_alert_events_rule_id', 'alert_events', ['rule_id'])
    op.create_index('idx_alert_events_rule_status', 'alert_events', ['rule_id', 'status'])
    op.create_index('idx_alert_events_triggered', 'alert_events', ['triggered_at'])

    op.create_table(
        'notifications',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(128), nullable=False),
        sa.Column('title', sa.String(256), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('type', sa.String(16), nullable=False),
        sa.Column('link', sa.String(512), nullable=True),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])
    op.create_index('idx_notifications_user_unread', 'notifications', ['user_id', 'read_at', 'created_at'])

    op.create_table(
        'notification_subscriptions',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(128), nullable=False),
        sa.Column('severity', sa.String(8), nullable=False),
        sa.Column('team_id', sa.String(36), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_notification_subscriptions_user_id', 'notification_subscriptions', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_notification_subscriptions_user_id', table_name='notification_subscriptions')
    op.drop_table('notification_subscriptions')
    op.drop_index('idx_notifications_user_unread', table_name='notifications')
    op.drop_index('ix_notifications_created_at', table_name='notifications')
    op.drop_index('ix_notifications_user_id', table_name='notifications')
    op.drop_table('notifications')
    op.drop_index('idx_alert_events_triggered', table_name='alert_events')
    op.drop_index('idx_alert_events_rule_status', table_name='alert_events')
    op.drop_index('ix_alert_events_rule_id', table_name='alert_events')
    op.drop_table('alert_events')
    op.drop_index('ix_alert_rules_team_id', table_name='alert_rules')
    op.drop_table('alert_rules')
