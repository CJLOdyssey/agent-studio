"""记忆条目仓库——针对会话作用域 agent 记忆条目的 CRUD。"""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import select

from core.infra.database import get_session_factory
from orm import MemoryEntry


async def get_session_memories(session_id: str) -> list[MemoryEntry]:
    """返回会话的所有记忆条目，按创建时间排序。"""
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
    """持久化一条新的 agent 记忆条目。

    Args:
        session_id: 父会话 UUID。
        run_id: 父 run UUID。
        agent_role: 产生该记忆的 agent 角色。
        content_type: 类别标签（如 "decision"、"context"）。
        summary: 记忆的简短摘要。
        details: 可选的详细内容。

    Returns:
        新创建的 MemoryEntry 实例。

    """
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


async def clear_session_memories(session_id: str) -> Any:
    """删除某会话的所有记忆条目。"""
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(MemoryEntry).where(MemoryEntry.session_id == session_id)
        result = await session.execute(stmt)
        for obj in result.scalars().all():
            await session.delete(obj)
        await session.commit()


async def get_memory_entry(memory_id: str) -> MemoryEntry | None:
    """按 ID 获取单条记忆条目（仅列访问，会话已关闭）。"""
    factory = get_session_factory()
    async with factory() as session:
        return await session.get(MemoryEntry, memory_id)


async def delete_memory_entry(memory_id: str) -> bool:
    """按 ID 删除单条记忆条目。未找到返回 False。"""
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(MemoryEntry, memory_id)
        if not obj:
            return False
        await session.delete(obj)
        await session.commit()
        return True
