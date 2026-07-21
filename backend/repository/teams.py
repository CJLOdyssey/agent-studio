"""Team repository — CRUD for teams and their member agents."""

from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy import update as sa_update
from sqlalchemy.orm import selectinload

from backend.core.infra.cache import get_cache
from backend.core.infra.database import TeamAgentDB, TeamDB, get_session_factory


async def get_teams(user_id: str | None = None) -> list[dict[str, Any]]:
    """Return all teams with their member agents eagerly loaded.

    Args:
        user_id: If provided, filter to teams owned by this user.

    Returns:
        A list of team dicts, each containing an "agents" list with config details.

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
        if user_id:
            stmt = stmt.where(TeamDB.owner_id == user_id)
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


async def get_cached_teams(user_id: str | None = None) -> list[dict[str, Any]]:
    """Return all teams, using Redis cache with 5-min TTL.

    Falls through to DB on cache miss; mutations invalidate the cache.
    """
    cache = get_cache()
    cache_key = f"teams:all:{user_id or 'global'}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return [_team_from_dict(d) for d in cached]

    result = await get_teams(user_id=user_id)
    serialized = [_team_to_dict(t) for t in result]
    await cache.set(cache_key, serialized)
    return result


async def _invalidate_team_cache() -> None:
    """Invalidate all team cache entries after mutations."""
    cache = get_cache()
    await cache.invalidate_pattern("teams:all:*")


def _team_to_dict(team: dict[str, Any]) -> dict[str, Any]:
    """Serialize a team dict for cache storage."""
    return {
        "id": team["id"],
        "name": team["name"],
        "description": team.get("description"),
        "status": team.get("status", "active"),
        "order": team["order"],
        "is_expanded": team.get("is_expanded", False),
        "agents": team.get("agents", []),
        "created_at": team.get("created_at"),
    }


def _team_from_dict(d: dict[str, Any]) -> dict[str, Any]:
    """Deserialize a team dict from cache."""
    return {
        "id": str(d["id"]),
        "name": str(d["name"]),
        "description": d.get("description"),
        "status": str(d.get("status", "active")),
        "order": int(d.get("order", 0)),
        "is_expanded": bool(d.get("is_expanded", False)),
        "agents": d.get("agents", []),
        "created_at": d.get("created_at"),
    }


async def get_team(team_id: str) -> dict[str, Any] | None:
    """Fetch a single team by ID with its member agents eagerly loaded.

    Returns:
        A team dict with "agents" list, or None if not found.

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
    name: str, description: str | None = None, status: str | None = None
) -> TeamDB | None:
    """Create a new team if the name is not already taken.

    Returns:
        The new TeamDB row, or None if the name already exists.

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
            order=(last.order + 1) if last else 0,
        )
        session.add(team)
        await session.commit()
        await _invalidate_team_cache()
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
    """Partial-update a team. Only non-None fields are applied.

    Returns:
        The updated TeamDB row, or None if the ID was not found.

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
        if order is not None:
            team.order = order
        if is_expanded is not None:
            team.is_expanded = is_expanded
        await session.commit()
        await _invalidate_team_cache()
        await session.refresh(team)
        return team


async def delete_team(team_id: str) -> bool:
    """Delete a team by ID. Returns False if not found."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(TeamDB).where(TeamDB.id == team_id))
        team = result.scalar_one_or_none()
        if not team:
            return False
        await session.delete(team)
        await session.commit()
        await _invalidate_team_cache()
        return True


async def add_team_member(
    team_id: str,
    name: str,
    role: str = "待配置角色",
    agent_config_id: str | None = None,
) -> dict[str, Any] | None:
    """Add a new member agent to a team.

    Returns:
        A dict with member details, or None if the team was not found.

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
        await _invalidate_team_cache()
        await session.refresh(member)
        return {
            "id": member.id,
            "name": member.name,
            "role": member.role,
            "order": member.order,
            "agent_config_id": member.agent_config_id,
        }


async def remove_team_member(team_id: str, member_id: str) -> bool:
    """Remove a member from a team. Returns False if not found."""
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
        await _invalidate_team_cache()
        return True


async def reorder_team_members(team_id: str, member_ids: list[str]) -> None:
    """Reorder team members to match the given ID sequence order."""
    factory = get_session_factory()
    async with factory() as session:
        for idx, mid in enumerate(member_ids):
            await session.execute(
                sa_update(TeamAgentDB)
                .where(TeamAgentDB.id == mid, TeamAgentDB.team_id == team_id)
                .values(order=idx)
            )
        await session.commit()
        await _invalidate_team_cache()


async def link_agent_config(member_id: str, agent_config_id: str) -> bool:
    """Bind a team member to an existing agent config. Returns False if member not found."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(TeamAgentDB).where(TeamAgentDB.id == member_id))
        member = result.scalar_one_or_none()
        if not member:
            return False
        member.agent_config_id = agent_config_id
        await session.commit()
        await _invalidate_team_cache()
        return True
