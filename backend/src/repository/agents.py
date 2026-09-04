"""Agent 配置仓库——针对 AgentConfigDB 的 CRUD。"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select

from core.infra.cache import get_cache
from core.infra.database import get_session_factory
from orm import AgentConfigDB


async def get_agent_configs() -> list[AgentConfigDB]:
    """按展示顺序与创建时间返回所有 agent 配置。"""
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentConfigDB).order_by(AgentConfigDB.order, AgentConfigDB.created_at)
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def get_active_agent_configs() -> list[AgentConfigDB]:
    """仅返回激活的 agent 配置，按展示顺序与创建时间排序。"""
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
    """按唯一角色标识查找 agent 配置。

    Args:
        role_identifier: 角色标识字符串（如 "pm"、"frontend"）。

    Returns:
        匹配的 AgentConfigDB，未找到返回 None。

    """
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentConfigDB).where(AgentConfigDB.role_identifier == role_identifier)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


async def get_agent_config(agent_id: str) -> AgentConfigDB | None:
    """按主键 ID 获取单个 agent 配置。

    Args:
        agent_id: agent 配置的 UUID。

    Returns:
        匹配的 AgentConfigDB，未找到返回 None。

    """
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentConfigDB).where(AgentConfigDB.id == agent_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


async def get_agent_config_count() -> int:
    """返回数据库中 agent 配置的总数。"""
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
    """创建新的 agent 配置记录。

    Args:
        name: agent 的展示名称。
        role_identifier: 唯一角色键（如 "pm"、"frontend-engineer"）。
        system_prompt: 系统级提示词文本。
        output_constraints: 可选的 agent 输出格式约束。
        tools: 可选的 JSON 序列化工具配置。
        mcp: 可选的 JSON 序列化 MCP 服务配置。
        skills: 可选的 JSON 序列化技能配置。
        order: 展示排序。
        is_active: agent 当前是否激活。
        is_approver: 该 agent 是否具有审批权限。
        icon: emoji 或图标标识。
        model: 该 agent 的模型覆盖。
        temperature: 采样温度覆盖。
        owner_id: RBAC 属主 UUID。

    Returns:
        新创建的 AgentConfigDB 实例。

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
    """部分更新 agent 配置。仅应用非 None 字段。

    Args:
        id: 要更新的 agent 配置 UUID。
        name: 新展示名称。
        system_prompt: 新系统提示词。
        output_constraints: 新输出约束。
        tools: 新工具配置。
        mcp: 新 MCP 配置。
        skills: 新技能配置。
        order: 新展示排序。
        is_active: 新激活状态。
        is_approver: 新审批状态。
        icon: 新图标。
        model: 新模型覆盖。
        temperature: 新温度覆盖。

    Returns:
        更新后的 AgentConfigDB，ID 未找到返回 None。

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
    """按 ID 删除 agent 配置。未找到返回 False。"""
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
    """变更后使 agent 配置缓存失效。"""
    cache = get_cache()
    await cache.delete("agents:all")


async def get_cached_agent_configs() -> list[AgentConfigDB]:
    """返回所有 agent 配置，使用带 5 分钟 TTL 的 Redis 缓存。

    缓存未命中时回落到 DB；变更会使缓存失效。
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
