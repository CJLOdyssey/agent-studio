"""用户偏好持久化——基于 user_preferences 的键值存储。"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from core.infra.database import get_session_factory
from orm import UserPreferenceDB


async def get_all_preferences(user_id: str) -> dict[str, Any]:
    """以普通字典返回用户的所有偏好。"""
    factory = get_session_factory()
    async with factory() as session:
        rows = await session.execute(
            select(UserPreferenceDB).where(UserPreferenceDB.user_id == user_id)
        )
        return {r.key: r.value for r in rows.scalars().all()}


async def set_preference(user_id: str, key: str, value: Any) -> None:
    """插入或更新单条偏好（后写胜出，原子）。

    ``postgresql.insert().on_conflict_do_update()`` 在 SQLite（>=3.24）上也能
    编译为合法的 ``ON CONFLICT ... DO UPDATE``，在匹配生产 postgres 语义的
    同时保持 sqlite 单元测试套件通过。
    """
    factory = get_session_factory()
    async with factory() as session:
        stmt = pg_insert(UserPreferenceDB).values(user_id=user_id, key=key, value=value)
        stmt = stmt.on_conflict_do_update(
            index_elements=[UserPreferenceDB.user_id, UserPreferenceDB.key],
            set_={"value": stmt.excluded.value, "updated_at": datetime.now(UTC)},
        )
        await session.execute(stmt)
        await session.commit()
