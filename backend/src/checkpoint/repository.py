"""检查点仓库 —— agent 检查点的 CRUD 操作。

与工厂层分离，便于独立演进。
"""

from uuid import uuid4

from checkpoint.models import AgentCheckpoint, CheckpointDB
from core.infra.database import get_session_factory
from core.infra.logging_config import get_logger

logger = get_logger(__name__)


async def save_checkpoint(checkpoint: AgentCheckpoint) -> str:
    """将 agent 检查点持久化到数据库。返回检查点 ID。"""
    factory = get_session_factory()
    async with factory() as session:
        obj = CheckpointDB(
            id=str(uuid4()),
            session_id=checkpoint.session_id,
            run_id=checkpoint.run_id,
            step_index=checkpoint.step_index,
            agent_state=checkpoint.to_json(),
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj.id


async def load_latest_checkpoint(session_id: str) -> AgentCheckpoint | None:
    """加载某会话最近的检查点。"""
    factory = get_session_factory()
    async with factory() as session:
        from sqlalchemy import desc, select

        stmt = (
            select(CheckpointDB)
            .where(CheckpointDB.session_id == session_id)
            .order_by(desc(CheckpointDB.created_at))
            .limit(1)
        )
        result = await session.execute(stmt)
        row = result.scalar_one_or_none()
        if row is None:
            return None
        return AgentCheckpoint.from_json(row.agent_state)


async def list_checkpoints(session_id: str) -> list[AgentCheckpoint]:
    """列出某会话的全部检查点，最旧优先。"""
    factory = get_session_factory()
    async with factory() as session:
        from sqlalchemy import select

        stmt = (
            select(CheckpointDB)
            .where(CheckpointDB.session_id == session_id)
            .order_by(CheckpointDB.created_at)
        )
        result = await session.execute(stmt)
        return [AgentCheckpoint.from_json(row.agent_state) for row in result.scalars()]
