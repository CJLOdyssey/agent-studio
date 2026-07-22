"""Admin dashboard repository — stats and log queries."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select

from backend.core.infra.database import (
    AgentConfigDB,
    AuditLogDB,
    CommandLogDB,
    MCPServerDB,
    PromptDB,
    RegisteredSkillDB,
    RegisteredToolDB,
    TeamDB,
    get_session_factory,
)


async def get_dashboard_stats() -> dict[str, Any]:
    """Return dashboard stat counts for agents, prompts, tools, MCPs, skills, teams, and today's logs."""
    factory = get_session_factory()
    async with factory() as session:
        agents = await session.execute(
            select(func.count()).select_from(AgentConfigDB).where(AgentConfigDB.is_active)
        )
        prompts = await session.execute(
            select(func.count()).select_from(PromptDB).where(PromptDB.status == "active")
        )
        tools = await session.execute(
            select(func.count())
            .select_from(RegisteredToolDB)
            .where(RegisteredToolDB.status == "active")
        )
        mcps = await session.execute(
            select(func.count()).select_from(MCPServerDB).where(MCPServerDB.status == "active")
        )
        skills = await session.execute(
            select(func.count())
            .select_from(RegisteredSkillDB)
            .where(RegisteredSkillDB.status == "installed")
        )
        teams = await session.execute(select(func.count()).select_from(TeamDB))
        today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        logs_today = await session.execute(
            select(func.count())
            .select_from(CommandLogDB)
            .where(CommandLogDB.created_at >= today_start)
        )

        return {
            "agents": agents.scalar() or 0,
            "prompts": prompts.scalar() or 0,
            "tools": tools.scalar() or 0,
            "mcps": mcps.scalar() or 0,
            "skills": skills.scalar() or 0,
            "teams": teams.scalar() or 0,
            "logs_today": logs_today.scalar() or 0,
            "updated_at": datetime.now(UTC).isoformat(),
        }


async def get_command_logs(limit: int = 20, offset: int = 0) -> dict[str, Any]:
    """Return paginated command logs (newest first) with total count."""
    factory = get_session_factory()
    async with factory() as session:
        count_row = await session.execute(select(func.count()).select_from(CommandLogDB))
        total = count_row.scalar() or 0

        rows = (
            await session.execute(
                select(CommandLogDB)
                .order_by(CommandLogDB.created_at.desc())
                .offset(offset)
                .limit(limit)
            )
        ).scalars().all()

        items = [
            {
                "id": r.id,
                "timestamp": r.created_at.isoformat() if r.created_at else "",
                "command": r.command_name,
                "payload": r.payload,
                "result": r.result,
            }
            for r in rows
        ]

        return {"items": items, "total": total, "offset": offset, "limit": limit}


async def get_recent_activity(limit: int = 10) -> list[dict[str, Any]]:
    """Return recent audit log entries, newest first."""
    factory = get_session_factory()
    async with factory() as session:
        rows = (
            await session.execute(
                select(AuditLogDB)
                .order_by(AuditLogDB.created_at.desc())
                .limit(limit)
            )
        ).scalars().all()

        return [
            {
                "id": r.id,
                "action": r.action,
                "entity_type": r.entity_type,
                "entity_name": r.entity_name,
                "detail": r.detail,
                "timestamp": r.created_at.isoformat() if r.created_at else "",
            }
            for r in rows
        ]
