"""命令日志仓库——插入执行审计记录。"""

from uuid import uuid4

from core.infra.database import get_session_factory
from orm import CommandLogDB


async def log_command(
    session_id: str,
    command_id: str,
    command_name: str,
    payload: str,
    result: str,
) -> None:
    """插入一条命令执行日志条目。"""
    factory = get_session_factory()
    async with factory() as db:
        log = CommandLogDB(
            id=str(uuid4()),
            session_id=session_id,
            command_id=command_id,
            command_name=command_name,
            payload=payload,
            result=result,
        )
        db.add(log)
        await db.commit()
