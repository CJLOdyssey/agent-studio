"""Admin dashboard API: real stats from existing tables and command logs."""

from datetime import UTC, datetime

from fastapi import APIRouter
from sqlalchemy import func, select

from virtual_team.database import (
    AgentConfigDB,
    CommandLogDB,
    MCPServerDB,
    PromptDB,
    RegisteredSkillDB,
    RegisteredToolDB,
    TeamDB,
    get_session_factory,
)
from virtual_team.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["admin"])


@router.get("/api/admin/stats")
async def get_dashboard_stats():
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


@router.get("/api/admin/logs")
async def get_command_logs(limit: int = 50, offset: int = 0):
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(CommandLogDB)
            .order_by(CommandLogDB.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await session.execute(stmt)
        rows = result.scalars().all()
        return [
            {
                "id": r.id,
                "timestamp": r.created_at.isoformat() if r.created_at else "",
                "command": r.command_name,
                "payload": r.payload,
                "result": r.result,
            }
            for r in rows
        ]
