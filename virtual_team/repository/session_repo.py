from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import desc, select

from virtual_team.database import SessionDB, get_session_factory


async def create_session(
    title: str = "新对话", user_id: str = "default", agent_id: str | None = None
) -> SessionDB:
    factory = get_session_factory()
    async with factory() as session:
        obj = SessionDB(
            id=str(uuid4()),
            title=title,
            user_id=user_id,
            agent_id=agent_id,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj


async def get_session(session_id: str) -> SessionDB | None:
    factory = get_session_factory()
    async with factory() as session:
        return await session.get(SessionDB, session_id)


async def get_sessions(
    limit: int = 50, user_id: str | None = None, agent_id: str | None = None
) -> list[SessionDB]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(SessionDB).order_by(desc(SessionDB.updated_at)).limit(limit)
        if agent_id:
            stmt = stmt.where(SessionDB.agent_id == agent_id)
        if user_id:
            stmt = stmt.where(SessionDB.user_id == user_id)
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def update_session_title(session_id: str, title: str) -> SessionDB | None:
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


async def delete_session(session_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(SessionDB, session_id)
        if not obj:
            return False
        await session.delete(obj)
        await session.commit()
        return True
