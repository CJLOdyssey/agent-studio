"""团队仓库——团队及其成员 agent 的 CRUD。"""

from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy import update as sa_update
from sqlalchemy.orm import selectinload

from core.infra.cache import get_cache
from core.infra.database import get_session_factory
from orm import AgentConfigDB, TeamAgentDB, TeamDB


async def get_teams(user_id: str | None = None) -> list[dict[str, Any]]:
    """返回所有团队并预加载其成员 agent。

    Args:
        user_id: 用户 ID。仅返回该用户拥有的团队；匿名（None/"anonymous"）返回空列表。

    Returns:
        团队字典列表，每个含带配置详情的 "agents" 列表。

    """
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(TeamDB)
            .order_by(TeamDB.order)
            .options(
                selectinload(TeamDB.members).selectinload(TeamAgentDB.agent_config),
            )
        )
        if user_id and user_id != "anonymous":
            stmt = stmt.where(TeamDB.owner_id == user_id)
        else:
            # anonymous / 未登录：无自有团队，直接返回空列表
            return []
        result = await session.execute(stmt)
        teams = result.scalars().all()
        return [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "status": t.status,
                "category": t.category,
                "order": t.order,
                "is_expanded": t.is_expanded,
                "agents": [
                    {
                        "id": m.id,
                        "name": m.agent_config.name if m.agent_config else m.name,
                        "role": m.role,
                        "order": m.order,
                        "agent_config_id": m.agent_config_id,
                        "system_prompt": m.agent_config.system_prompt if m.agent_config else None,
                        "output_constraints": m.agent_config.output_constraints
                        if m.agent_config
                        else None,
                        "tools": m.agent_config.tools if m.agent_config else [],
                        "mcp": m.agent_config.mcp if m.agent_config else [],
                        "skills": m.agent_config.skills if m.agent_config else [],
                    }
                    for m in t.members
                ],
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in teams
        ]


async def get_team(team_id: str) -> dict[str, Any] | None:
    """按 ID 获取单个团队并预加载其成员 agent。

    Returns:
        带 "agents" 列表的团队字典，未找到返回 None。

    """
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(TeamDB)
            .where(TeamDB.id == team_id)
            .options(
                selectinload(TeamDB.members).selectinload(TeamAgentDB.agent_config),
            )
        )
        result = await session.execute(stmt)
        t = result.scalar_one_or_none()
        if not t:
            return None
        return {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "status": t.status,
            "category": t.category,
            "owner_id": t.owner_id,
            "order": t.order,
            "is_expanded": t.is_expanded,
            "agents": [
                {
                    "id": m.id,
                    "name": m.agent_config.name if m.agent_config else m.name,
                    "role": m.role,
                    "order": m.order,
                    "agent_config_id": m.agent_config_id,
                    "system_prompt": m.agent_config.system_prompt if m.agent_config else None,
                    "output_constraints": m.agent_config.output_constraints
                    if m.agent_config
                    else None,
                    "tools": m.agent_config.tools if m.agent_config else [],
                    "mcp": m.agent_config.mcp if m.agent_config else [],
                    "skills": m.agent_config.skills if m.agent_config else [],
                }
                for m in t.members
            ],
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }


async def create_team(
    name: str, description: str | None = None,
    status: str | None = None, category: str | None = None,
    owner_id: str | None = None,
) -> TeamDB | None:
    """若名称未被占用则创建新团队。

    Returns:
        新的 TeamDB 行，名称已存在则返回 None。

    """
    factory = get_session_factory()
    async with factory() as session:
        existing = await session.execute(select(TeamDB).where(TeamDB.name == name))
        if existing.scalar_one_or_none():
            return None
        count = await session.execute(select(TeamDB).order_by(TeamDB.order.desc()).limit(1))
        last = count.scalar_one_or_none()
        team = TeamDB(
            id=str(uuid4()),
            name=name,
            description=description,
            status=status or "active",
            category=category or "dev",
            owner_id=owner_id or "",
            order=(last.order + 1) if last else 0,
        )
        session.add(team)
        await session.commit()
        await session.refresh(team)
        return team


async def update_team(
    team_id: str,
    name: str | None = None,
    description: str | None = None,
    status: str | None = None,
    category: str | None = None,
    order: int | None = None,
    is_expanded: bool | None = None,
) -> TeamDB | None:
    """部分更新团队。仅应用非 None 字段。

    Returns:
        更新后的 TeamDB 行，ID 未找到返回 None。

    """
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(TeamDB).where(TeamDB.id == team_id))
        team = result.scalar_one_or_none()
        if not team:
            return None
        if name is not None:
            team.name = name
        if description is not None:
            team.description = description
        if status is not None:
            team.status = status
            is_active = status == "active"
            member_stmt = select(TeamAgentDB).where(
                TeamAgentDB.team_id == team_id,
                TeamAgentDB.agent_config_id.isnot(None),
            )
            members_result = await session.execute(member_stmt)
            member_ids = [
                m.agent_config_id
                for m in members_result.scalars().all()
                if m.agent_config_id
            ]
            if member_ids:
                stmt = select(AgentConfigDB).where(AgentConfigDB.id.in_(member_ids))
                agents_result = await session.execute(stmt)
                for agent in agents_result.scalars().all():
                    agent.is_active = is_active
        if category is not None:
            team.category = category
        if order is not None:
            team.order = order
        if is_expanded is not None:
            team.is_expanded = is_expanded
        await session.commit()
        await session.refresh(team)
        if status is not None:
            cache = get_cache()
            await cache.delete("agents:all")
        return team


async def delete_team(team_id: str) -> bool:
    """按 ID 删除团队。未找到返回 False。"""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(TeamDB).where(TeamDB.id == team_id))
        team = result.scalar_one_or_none()
        if not team:
            return False
        await session.delete(team)
        await session.commit()
        return True


async def add_team_member(
    team_id: str,
    name: str,
    role: str = "待配置角色",
    agent_config_id: str | None = None,
) -> dict[str, Any] | None:
    """向团队添加新成员 agent。

    Returns:
        带成员详情的字典，团队未找到返回 None。

    """
    factory = get_session_factory()
    async with factory() as session:
        team = await session.get(TeamDB, team_id)
        if not team:
            return None
        count = await session.execute(
            select(TeamAgentDB)
            .where(TeamAgentDB.team_id == team_id)
            .order_by(TeamAgentDB.order.desc())
            .limit(1)
        )
        last = count.scalar_one_or_none()
        member = TeamAgentDB(
            id=str(uuid4()),
            team_id=team_id,
            agent_config_id=agent_config_id,
            name=name,
            role=role,
            order=(last.order + 1) if last else 0,
        )
        session.add(member)
        await session.commit()
        await session.refresh(member)
        return {
            "id": member.id,
            "name": member.name,
            "role": member.role,
            "order": member.order,
            "agent_config_id": member.agent_config_id,
        }


async def remove_team_member(team_id: str, member_id: str) -> bool:
    """从团队移除成员。未找到返回 False。"""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(TeamAgentDB).where(TeamAgentDB.id == member_id, TeamAgentDB.team_id == team_id)
        )
        member = result.scalar_one_or_none()
        if not member:
            return False
        await session.delete(member)
        await session.commit()
        return True


async def reorder_team_members(team_id: str, member_ids: list[str]) -> None:
    """按给定 ID 序列顺序重排团队成员。"""
    factory = get_session_factory()
    async with factory() as session:
        for idx, mid in enumerate(member_ids):
            await session.execute(
                sa_update(TeamAgentDB)
                .where(TeamAgentDB.id == mid, TeamAgentDB.team_id == team_id)
                .values(order=idx)
            )
        await session.commit()


async def link_agent_config(member_id: str, agent_config_id: str) -> bool:
    """将团队成员绑定到现有 agent 配置。成员未找到返回 False。"""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(TeamAgentDB).where(TeamAgentDB.id == member_id))
        member = result.scalar_one_or_none()
        if not member:
            return False
        member.agent_config_id = agent_config_id
        await session.commit()
        return True
