"""Admin dashboard repository — stats and log queries."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select

from core.infra.database import (
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
            # is_active 标记与"是否可被团队使用"无关（陈旧数据多为 false），
            # 统计全部已配置的 agent 以反映真实数量。
            select(func.count()).select_from(AgentConfigDB)
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


async def get_command_logs(
    limit: int = 20,
    offset: int = 0,
    search: str = "",
    action: str = "",
    entity_type: str = "",
    level: str = "",
    start: str = "",
    end: str = "",
) -> dict[str, Any]:
    """Return paginated audit log entries (newest first) with total count.

    Primary source is the management audit trail (AuditLogDB: CRUD ops with
    acting user + client ip); command palette executions (CommandLogDB) are
    merged in as ``entity_type=command`` entries so the audit view is
    complete.

    Filtering and pagination happen at the SQL layer for the audit table
    (no full-table materialisation), so large audit histories page cleanly.
    """
    stmt = select(AuditLogDB).order_by(AuditLogDB.created_at.desc())
    count_stmt = select(func.count()).select_from(AuditLogDB)

    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            AuditLogDB.entity_name.ilike(like)
            | AuditLogDB.detail.ilike(like)
            | AuditLogDB.user_name.ilike(like)
        )
        count_stmt = count_stmt.where(
            AuditLogDB.entity_name.ilike(like)
            | AuditLogDB.detail.ilike(like)
            | AuditLogDB.user_name.ilike(like)
        )
    if action:
        stmt = stmt.where(AuditLogDB.action == action)
        count_stmt = count_stmt.where(AuditLogDB.action == action)
    if entity_type:
        stmt = stmt.where(AuditLogDB.entity_type == entity_type)
        count_stmt = count_stmt.where(AuditLogDB.entity_type == entity_type)
    if level:
        stmt = stmt.where(AuditLogDB.level == level)
        count_stmt = count_stmt.where(AuditLogDB.level == level)
    if start:
        stmt = stmt.where(AuditLogDB.created_at >= start)
        count_stmt = count_stmt.where(AuditLogDB.created_at >= start)
    if end:
        stmt = stmt.where(AuditLogDB.created_at <= end)
        count_stmt = count_stmt.where(AuditLogDB.created_at <= end)

    factory = get_session_factory()
    async with factory() as session:
        audit_total = (
            await session.execute(count_stmt)
        ).scalar() or 0
        audit_rows = (
            await session.execute(stmt.offset(offset).limit(limit))
        ).scalars().all()
        cmd_rows = (
            await session.execute(
                select(CommandLogDB)
                .order_by(CommandLogDB.created_at.desc())
                .limit(limit)
            )
        ).scalars().all()

    audit_items = [
        {
            "id": r.id,
            "timestamp": r.created_at.isoformat() if r.created_at else "",
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_name": r.entity_name,
            "detail": r.detail,
            "level": r.level,
            "before": r.before_snapshot or "",
            "after": r.after_snapshot or "",
            "user": r.user_name,
            "ip": r.client_ip,
            "user_agent": r.user_agent,
            "request_id": r.request_id,
        }
        for r in audit_rows
    ]
    cmd_items = [
        {
            "id": r.id,
            "timestamp": r.created_at.isoformat() if r.created_at else "",
            "action": r.command_name,
            "entity_type": "command",
            "entity_name": r.command_id,
            "detail": r.result or r.payload,
            "level": "info",
            "before": "",
            "after": "",
            "user": "",
            "ip": "",
            "user_agent": "",
            "request_id": "",
        }
        for r in cmd_rows
    ]

    # Commands are a secondary source: merge them into the page and cap at
    # the requested limit so the response stays bounded.
    items = audit_items + cmd_items
    items.sort(key=lambda x: x["timestamp"], reverse=True)
    items = items[:limit]
    return {
        "items": items,
        "total": audit_total,
        "offset": offset,
        "limit": limit,
    }


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
