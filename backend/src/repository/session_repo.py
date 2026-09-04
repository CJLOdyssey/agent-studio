"""会话仓库——会话的 CRUD。"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import desc, select, update

from core.infra.database import get_session_factory
from orm import SessionDB


async def create_session(
    title: str = "新对话", user_id: str = "default", agent_id: str | None = None,
    kind: str = "normal", team_id: str | None = None,
) -> SessionDB:
    """创建新的会话并返回持久化的行。

    Args:
        title: 会话的展示标题。
        user_id: 属主用户 ID。
        agent_id: 可选的绑定 agent 配置 ID。
        kind: 会话类型——normal、agent 或 team。
        team_id: 可选的绑定团队 ID（kind='team' 的会话）。

    Returns:
        新创建的 SessionDB 实例。

    """
    factory = get_session_factory()
    async with factory() as session:
        obj = SessionDB(
            id=str(uuid4()),
            title=title,
            user_id=user_id,
            kind=kind,
            agent_id=agent_id,
            team_id=team_id,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj


async def get_session(session_id: str) -> SessionDB | None:
    """按主键 ID 获取单个会话。"""
    factory = get_session_factory()
    async with factory() as session:
        return await session.get(SessionDB, session_id)


async def get_sessions(
    limit: int = 50, user_id: str | None = None, agent_id: str | None = None
) -> list[SessionDB]:
    """返回最近的会话，可选按用户或 agent 过滤。

    Args:
        limit: 返回会话的最大数量。
        user_id: 若设置，仅返回该用户拥有的会话。
        agent_id: 若设置，仅返回绑定到该 agent 配置的会话。

    Returns:
        按最后更新降序排序的 SessionDB 行列表。

    """
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(SessionDB).order_by(
            desc(SessionDB.is_pinned),
            desc(SessionDB.updated_at),
        ).limit(limit)
        if agent_id:
            stmt = stmt.where(SessionDB.agent_id == agent_id)
        if user_id:
            stmt = stmt.where(SessionDB.user_id == user_id)
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def update_session_title(session_id: str, title: str) -> SessionDB | None:
    """更新会话标题并返回刷新后的行。"""
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(SessionDB, session_id)
        if not obj:
            return None
        obj.title = title
        obj.updated_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(obj)
        return obj


async def update_session_pin(session_id: str, is_pinned: bool) -> SessionDB | None:
    """置顶/取消置顶会话。返回刷新后的行，未找到返回 None。"""
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(SessionDB, session_id)
        if not obj:
            return None
        obj.is_pinned = is_pinned
        obj.updated_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(obj)
        return obj


async def delete_session(session_id: str) -> bool:
    """按 ID 删除会话。未找到返回 False。"""
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(SessionDB, session_id)
        if not obj:
            return False
        await session.delete(obj)
        await session.commit()
        return True


async def update_session_team(session_id: str, team_id: str) -> None:
    """幂等补写：为会话绑定 team_id（URL 身份直开首次续聊时落库）。

    仅当会话当前 team_id 为空时写入——已有值不覆盖（尊重首次来源）。
    """
    factory = get_session_factory()
    async with factory() as session:
        await session.execute(
            update(SessionDB)
            .where(SessionDB.id == session_id, SessionDB.team_id.is_(None))
            .values(team_id=team_id)
        )
        await session.commit()
