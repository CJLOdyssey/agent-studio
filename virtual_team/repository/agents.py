from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select

from virtual_team.database import (
    AgentConfigDB,
    ChatMessage,
    get_session_factory,
)


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


async def get_agent_config_count() -> int:
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(AgentConfigDB))
        return len(result.scalars().all())


_DEFAULT_AGENTS = [
    {
        "name": "默认助手",
        "role_identifier": "default_assistant",
        "system_prompt": "你是一个智能助手，负责理解用户需求并给出最佳回答。",
        "order": 0,
        "is_active": True,
        "icon": "🤖",
    },
]


async def seed_default_agents():
    count = await get_agent_config_count()
    if count > 0:
        return
    for agent in _DEFAULT_AGENTS:
        await create_agent_config(**agent)


async def create_agent_config(
    name: str,
    role_identifier: str,
    system_prompt: str,
    output_constraints: str | None = None,
    tools: str | None = None,
    mcp: str | None = None,
    skills: str | None = None,
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
        output_constraints=output_constraints,
        tools=tools,
        mcp=mcp,
        skills=skills,
        model=model,
        temperature=temperature,
        order=order,
        is_active=is_active,
        is_approver=is_approver,
        icon=icon,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
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
    output_constraints: str | None = None,
    tools: str | None = None,
    mcp: str | None = None,
    skills: str | None = None,
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
        if output_constraints is not None:
            config.output_constraints = output_constraints
        if tools is not None:
            config.tools = tools
        if mcp is not None:
            config.mcp = mcp
        if skills is not None:
            config.skills = skills
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
        config.updated_at = datetime.now(UTC)
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
