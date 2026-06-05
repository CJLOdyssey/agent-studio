from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import desc, select

from virtual_team.database import (
    AgentConfigDB,
    ChatMessage,
    MemoryEntry,
    ProjectRun,
    SessionDB,
    get_session_factory,
)


async def create_session(title: str = "新对话") -> SessionDB:
    factory = get_session_factory()
    async with factory() as session:
        obj = SessionDB(
            id=str(uuid4()),
            title=title,
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

async def get_sessions(limit: int = 50) -> list[SessionDB]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(SessionDB).order_by(desc(SessionDB.updated_at)).limit(limit)
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

async def get_session_runs(session_id: str) -> list[ProjectRun]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(ProjectRun)
            .where(ProjectRun.session_id == session_id)
            .order_by(ProjectRun.created_at)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

async def get_runs_by_session_ids(session_ids: list[str]) -> dict[str, list[ProjectRun]]:
    """Batch-load runs for multiple session IDs, keyed by session_id."""
    if not session_ids:
        return {}
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(ProjectRun)
            .where(ProjectRun.session_id.in_(session_ids))
            .order_by(ProjectRun.created_at)
        )
        result = await session.execute(stmt)
        runs = list(result.scalars().all())
        grouped: dict[str, list[ProjectRun]] = {}
        for run in runs:
            grouped.setdefault(run.session_id or "", []).append(run)
        return grouped

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

async def create_run(requirement: str, session_id: str | None = None) -> str:
    run_id = str(uuid4())
    run = ProjectRun(
        id=run_id,
        session_id=session_id,
        requirement=requirement,
        status="pending",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    factory = get_session_factory()
    async with factory() as session:
        session.add(run)
        await session.commit()
        if session_id:
            sess = await session.get(SessionDB, session_id)
            if sess:
                sess.updated_at = datetime.now(UTC)
                await session.commit()
    return run_id

async def update_run_status(run_id: str, status: str):
    factory = get_session_factory()
    async with factory() as session:
        run = await session.get(ProjectRun, run_id)
        if run:
            run.status = status
            run.updated_at = datetime.now(UTC)
            await session.commit()

async def save_message(run_id: str, role: str, agent_name: str, content: str, round_number: int):
    msg = ChatMessage(
        id=str(uuid4()),
        run_id=run_id,
        role=role,
        agent_name=agent_name,
        content=content,
        round_number=round_number,
        created_at=datetime.now(UTC),
    )
    factory = get_session_factory()
    async with factory() as session:
        session.add(msg)
        await session.commit()

async def update_run_result(
    run_id: str,
    pm_document: str,
    code: str,
    review: str,
    approved: bool,
    status: str,
):
    factory = get_session_factory()
    async with factory() as session:
        run = await session.get(ProjectRun, run_id)
        if run:
            run.pm_document = pm_document
            run.code = code
            run.review = review
            run.approved = approved
            run.status = status
            run.updated_at = datetime.now(UTC)
            await session.commit()

async def get_run(run_id: str) -> ProjectRun | None:
    factory = get_session_factory()
    async with factory() as session:
        run = await session.get(ProjectRun, run_id)
        return run

async def get_runs(limit: int = 20) -> list[ProjectRun]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(ProjectRun).order_by(desc(ProjectRun.created_at)).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())

async def get_messages(run_id: str) -> list[ChatMessage]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.run_id == run_id)
            .order_by(ChatMessage.created_at)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

async def get_agent_configs() -> list[AgentConfigDB]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentConfigDB).order_by(AgentConfigDB.order, AgentConfigDB.created_at)
        result = await session.execute(stmt)
        return list(result.scalars().all())

async def get_active_agent_configs() -> list[AgentConfigDB]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(AgentConfigDB)
            .where(AgentConfigDB.is_active)
            .order_by(AgentConfigDB.order, AgentConfigDB.created_at)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

async def get_agent_config_by_role(role_identifier: str) -> AgentConfigDB | None:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentConfigDB).where(AgentConfigDB.role_identifier == role_identifier)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

async def get_agent_config(agent_id: str) -> AgentConfigDB | None:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentConfigDB).where(AgentConfigDB.id == agent_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

async def get_run_messages(run_id: str) -> list[ChatMessage]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.run_id == run_id)
            .order_by(ChatMessage.created_at)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def get_session_messages(session_id: str, exclude_run_id: str | None = None) -> list[ChatMessage]:
    """Get all chat messages across all runs in a session, ordered chronologically."""
    factory = get_session_factory()
    async with factory() as session:
        # Get all run IDs for this session
        runs_stmt = (
            select(ProjectRun.id)
            .where(ProjectRun.session_id == session_id)
        )
        if exclude_run_id:
            runs_stmt = runs_stmt.where(ProjectRun.id != exclude_run_id)
        runs_result = await session.execute(runs_stmt)
        run_ids = [r[0] for r in runs_result.all()]

        if not run_ids:
            return []

        # Get all messages for these runs
        msgs_stmt = (
            select(ChatMessage)
            .where(ChatMessage.run_id.in_(run_ids))
            .order_by(ChatMessage.created_at)
        )
        msgs_result = await session.execute(msgs_stmt)
        return list(msgs_result.scalars().all())
