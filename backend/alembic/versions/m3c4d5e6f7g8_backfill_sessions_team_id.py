"""Backfill sessions.team_id from team_members via agent_config_id."""

import sqlalchemy as sa
from alembic import op

revision = "m3c4d5e6f7g8"
down_revision = "m2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    # 回填逻辑：session.agent_id → team_members.agent_config_id → team_members.team_id
    # 仅回填 team_id IS NULL 且 agent_id NOT NULL 的旧会话；多团队匹配取最早加入的。
    bind.execute(
        sa.text(
            """
            UPDATE sessions
            SET team_id = (
                SELECT ta.team_id
                FROM team_agents ta
                WHERE ta.agent_config_id = sessions.agent_id
                ORDER BY ta.id
                LIMIT 1
            )
            WHERE team_id IS NULL
              AND agent_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM team_agents ta
                  WHERE ta.agent_config_id = sessions.agent_id
              )
            """
        )
    )


def downgrade() -> None:
    # 回填是单向操作，不做反向清除（保留数据完整性）
    pass
