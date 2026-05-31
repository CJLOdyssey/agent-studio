from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from virtual_team.agent_defaults import DEFAULT_AGENTS
from virtual_team.database import (
    AgentConfigDB, ChatMessage, MemoryEntry, ProjectRun, SessionDB, get_session_factory,
)


# ---- Session CRUD ----

async def create_session(title: str = "新对话") -> SessionDB:
    factory = get_session_factory()
    async with factory() as session:
        obj = SessionDB(
            id=str(uuid4()),
            title=title,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
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
        obj.updated_at = datetime.now(timezone.utc)
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


# ---- Memory CRUD ----

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
            created_at=datetime.now(timezone.utc),
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


# ---- Run CRUD ----

async def create_run(requirement: str, session_id: str | None = None) -> str:
    run_id = str(uuid4())
    run = ProjectRun(
        id=run_id,
        session_id=session_id,
        requirement=requirement,
        status="pending",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    factory = get_session_factory()
    async with factory() as session:
        session.add(run)
        await session.commit()
        if session_id:
            sess = await session.get(SessionDB, session_id)
            if sess:
                sess.updated_at = datetime.now(timezone.utc)
                await session.commit()
    return run_id


async def update_run_status(run_id: str, status: str):
    factory = get_session_factory()
    async with factory() as session:
        run = await session.get(ProjectRun, run_id)
        if run:
            run.status = status
            run.updated_at = datetime.now(timezone.utc)
            await session.commit()


async def save_message(run_id: str, role: str, agent_name: str, content: str, round_number: int):
    msg = ChatMessage(
        id=str(uuid4()),
        run_id=run_id,
        role=role,
        agent_name=agent_name,
        content=content,
        round_number=round_number,
        created_at=datetime.now(timezone.utc),
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
            run.updated_at = datetime.now(timezone.utc)
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


# ---- Agent Config CRUD ----

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
            .where(AgentConfigDB.is_active == True)
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


async def create_agent_config(
    name: str,
    role_identifier: str,
    system_prompt: str,
    order: int = 0,
    is_active: bool = True,
    is_approver: bool = False,
    icon: str = "🤖",
    model: str | None = None,
    temperature: float | None = None,
) -> AgentConfigDB:
    config = AgentConfigDB(
        id=str(uuid4()),
        name=name,
        role_identifier=role_identifier,
        system_prompt=system_prompt,
        model=model,
        temperature=temperature,
        order=order,
        is_active=is_active,
        is_approver=is_approver,
        icon=icon,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    factory = get_session_factory()
    async with factory() as session:
        session.add(config)
        await session.commit()
        await session.refresh(config)
    return config


async def update_agent_config(
    id: str,
    name: str | None = None,
    system_prompt: str | None = None,
    order: int | None = None,
    is_active: bool | None = None,
    is_approver: bool | None = None,
    icon: str | None = None,
    model: str | None = None,
    temperature: float | None = None,
) -> AgentConfigDB | None:
    factory = get_session_factory()
    async with factory() as session:
        config = await session.get(AgentConfigDB, id)
        if not config:
            return None
        if name is not None:
            config.name = name
        if system_prompt is not None:
            config.system_prompt = system_prompt
        if order is not None:
            config.order = order
        if is_active is not None:
            config.is_active = is_active
        if is_approver is not None:
            config.is_approver = is_approver
        if icon is not None:
            config.icon = icon
        if model is not None:
            config.model = model
        if temperature is not None:
            config.temperature = temperature
        config.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(config)
    return config


async def delete_agent_config(id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        config = await session.get(AgentConfigDB, id)
        if not config:
            return False
        await session.delete(config)
        await session.commit()
    return True


async def seed_default_agents():
    factory = get_session_factory()
    async with factory() as session:
        existing = await session.execute(select(AgentConfigDB).limit(1))
        if existing.scalar():
            return
        for agent in DEFAULT_AGENTS:
            db_agent = AgentConfigDB(
                id=str(uuid4()),
                name=agent.name,
                role_identifier=agent.role_identifier,
                system_prompt=agent.system_prompt,
                model=agent.model,
                temperature=agent.temperature,
                order=agent.order,
                is_active=agent.is_active,
                is_approver=agent.is_approver,
                icon=agent.icon,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            session.add(db_agent)
        await session.commit()
