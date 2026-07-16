from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select

from virtual_team.database import MemoryEntry, get_session_factory


async def get_session_memories(session_id: str) -> list[MemoryEntry]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(MemoryEntry)
            .where(MemoryEntry.session_id == session_id)
            .order_by(MemoryEntry.created_at)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def create_memory_entry(
    session_id: str,
    run_id: str,
    agent_role: str,
    content_type: str,
    summary: str,
    details: str = "",
) -> MemoryEntry:
    factory = get_session_factory()
    async with factory() as session:
        obj = MemoryEntry(
            id=str(uuid4()),
            session_id=session_id,
            run_id=run_id,
            agent_role=agent_role,
            content_type=content_type,
            summary=summary,
            details=details,
            created_at=datetime.now(UTC),
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj


async def clear_session_memories(session_id: str):
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(MemoryEntry).where(MemoryEntry.session_id == session_id)
        result = await session.execute(stmt)
        for obj in result.scalars().all():
            await session.delete(obj)
        await session.commit()


async def delete_memory_entry(memory_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(MemoryEntry, memory_id)
        if not obj:
            return False
        await session.delete(obj)
        await session.commit()
        return True
