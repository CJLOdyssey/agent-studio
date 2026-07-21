"""Agent configuration repository — CRUD for AgentConfigDB."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select

from backend.core.infra.cache import get_cache
from backend.core.infra.database import (
    AgentConfigDB,
    get_session_factory,
)


async def get_agent_configs() -> list[AgentConfigDB]:
    """Return all agent configs ordered by display order and creation time."""
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentConfigDB).order_by(AgentConfigDB.order, AgentConfigDB.created_at)
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def get_active_agent_configs() -> list[AgentConfigDB]:
    """Return only active agent configs, sorted by display order and creation time."""
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
    """Look up an agent config by its unique role identifier.

    Args:
        role_identifier: The role identifier string (e.g., "pm", "frontend").

    Returns:
        The matching AgentConfigDB or None if not found.

    """
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentConfigDB).where(AgentConfigDB.role_identifier == role_identifier)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


async def get_agent_config(agent_id: str) -> AgentConfigDB | None:
    """Fetch a single agent config by its primary key ID.

    Args:
        agent_id: The UUID of the agent config.

    Returns:
        The matching AgentConfigDB or None if not found.

    """
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentConfigDB).where(AgentConfigDB.id == agent_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


async def get_agent_config_count() -> int:
    """Return the total number of agent configs in the database."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(AgentConfigDB))
        return len(result.scalars().all())


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
    owner_id: str | None = None,
) -> AgentConfigDB:
    """Create a new agent configuration record.

    Args:
        name: Display name for the agent.
        role_identifier: Unique role key (e.g., "pm", "frontend-engineer").
        system_prompt: System-level prompt text.
        output_constraints: Optional constraints on agent output format.
        tools: Optional JSON-serialized tool configuration.
        mcp: Optional JSON-serialized MCP server configuration.
        skills: Optional JSON-serialized skill configuration.
        order: Display sort order.
        is_active: Whether the agent is currently active.
        is_approver: Whether this agent has approval authority.
        icon: Emoji or icon identifier.
        model: Override model name for this agent.
        temperature: Override sampling temperature.
        owner_id: RBAC owner UUID.

    Returns:
        The newly created AgentConfigDB instance.

    """
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
        owner_id=owner_id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    factory = get_session_factory()
    async with factory() as session:
        session.add(config)
        await session.commit()
        await _invalidate_agent_cache()
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
    """Partial-update an agent config. Only non-None fields are applied.

    Args:
        id: The UUID of the agent config to update.
        name: New display name.
        system_prompt: New system prompt.
        output_constraints: New output constraints.
        tools: New tool configuration.
        mcp: New MCP configuration.
        skills: New skill configuration.
        order: New display sort order.
        is_active: New active state.
        is_approver: New approver state.
        icon: New icon.
        model: New model override.
        temperature: New temperature override.

    Returns:
        The updated AgentConfigDB or None if the ID was not found.

    """
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
        await _invalidate_agent_cache()
    return config


async def delete_agent_config(id: str) -> bool:
    """Delete an agent config by ID. Returns False if not found."""
    factory = get_session_factory()
    async with factory() as session:
        config = await session.get(AgentConfigDB, id)
        if not config:
            return False
        await session.delete(config)
        await session.commit()
        await _invalidate_agent_cache()
        return True


async def _invalidate_agent_cache() -> None:
    """Invalidate the agent config cache after mutations."""
    cache = get_cache()
    await cache.delete("agents:all")


async def get_cached_agent_configs() -> list[AgentConfigDB]:
    """Return all agent configs, using Redis cache with 5-min TTL.

    Falls through to DB on cache miss; mutations invalidate the cache.
    """
    cache = get_cache()
    cached = await cache.get("agents:all")
    if cached is not None:
        return [_agent_from_dict(d) for d in cached]

    result = await get_agent_configs()
    serialized = [_agent_to_dict(a) for a in result]
    await cache.set("agents:all", serialized)
    return result


def _agent_to_dict(a: AgentConfigDB) -> dict[str, object]:
    return {
        "id": a.id,
        "name": a.name,
        "role_identifier": a.role_identifier,
        "system_prompt": a.system_prompt,
        "output_constraints": a.output_constraints,
        "tools": a.tools,
        "mcp": a.mcp,
        "skills": a.skills,
        "model": a.model,
        "temperature": a.temperature,
        "order": a.order,
        "is_active": a.is_active,
        "is_approver": a.is_approver,
        "icon": a.icon,
        "owner_id": a.owner_id,
    }


def _agent_from_dict(d: dict[str, object]) -> AgentConfigDB:
    return AgentConfigDB(
        id=str(d["id"]),
        name=str(d["name"]),
        role_identifier=str(d["role_identifier"]),
        system_prompt=str(d["system_prompt"]),
        output_constraints=str(d.get("output_constraints") or ""),
        tools=str(d.get("tools") or ""),
        mcp=str(d.get("mcp") or ""),
        skills=str(d.get("skills") or ""),
        model=str(d.get("model") or ""),
        temperature=float(str(d.get("temperature") or 0.0)),
        order=int(str(d.get("order") or 0)),
        is_active=bool(d.get("is_active")),
        is_approver=bool(d.get("is_approver", False)),
        icon=str(d.get("icon") or "🤖"),
        owner_id=str(d["owner_id"]) if d.get("owner_id") else None,
    )
