from uuid import uuid4

from sqlalchemy import select
from sqlalchemy import update as sa_update
from sqlalchemy.orm import selectinload

from virtual_team.database import TeamAgentDB, TeamDB, get_session_factory


async def get_teams() -> list[dict]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(TeamDB)
            .order_by(TeamDB.order)
            .options(
                selectinload(TeamDB.members).selectinload(TeamAgentDB.agent_config),
            )
        )
        result = await session.execute(stmt)
        teams = result.scalars().all()
        return [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "status": t.status,
                "order": t.order,
                "is_expanded": t.is_expanded,
                "agents": [
                    {
                        "id": m.id,
                        "name": m.name,
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


async def get_team(team_id: str) -> dict | None:
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
            "order": t.order,
            "is_expanded": t.is_expanded,
            "agents": [
                {
                    "id": m.id,
                    "name": m.name,
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
    name: str, description: str | None = None, status: str | None = None
) -> TeamDB | None:
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
    order: int | None = None,
    is_expanded: bool | None = None,
) -> TeamDB | None:
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
        if order is not None:
            team.order = order
        if is_expanded is not None:
            team.is_expanded = is_expanded
        await session.commit()
        await session.refresh(team)
        return team


async def delete_team(team_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(TeamDB).where(TeamDB.id == team_id))
        team = result.scalar_one_or_none()
        if not team:
            return False
        await session.delete(team)
        await session.commit()
        return True


async def add_team_member(team_id: str, name: str, role: str = "待配置角色") -> dict | None:
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
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(TeamAgentDB).where(TeamAgentDB.id == member_id))
        member = result.scalar_one_or_none()
        if not member:
            return False
        member.agent_config_id = agent_config_id
        await session.commit()
        return True
