"""Session repository — CRUD for conversation sessions."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import desc, select, update

from core.infra.database import SessionDB, get_session_factory


async def create_session(
    title: str = "新对话", user_id: str = "default", agent_id: str | None = None,
    kind: str = "normal", team_id: str | None = None,
) -> SessionDB:
    """Create a new conversation session and return the persisted row.

    Args:
        title: Display title for the session.
        user_id: Owner user ID.
        agent_id: Optional bound agent config ID.
        kind: Session kind — normal, agent, or team.
        team_id: Optional bound team ID (kind='team' sessions).

    Returns:
        The newly created SessionDB instance.

    """
    factory = get_session_factory()
    async with factory() as session:
        obj = SessionDB(
            id=str(uuid4()),
            title=title,
            user_id=user_id,
            kind=kind,
            agent_id=agent_id,
            team_id=team_id,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj


async def get_session(session_id: str) -> SessionDB | None:
    """Fetch a single session by its primary key ID."""
    factory = get_session_factory()
    async with factory() as session:
        return await session.get(SessionDB, session_id)


async def get_sessions(
    limit: int = 50, user_id: str | None = None, agent_id: str | None = None
) -> list[SessionDB]:
    """Return recent sessions, optionally filtered by user or agent.

    Args:
        limit: Maximum number of sessions to return.
        user_id: If set, only return sessions owned by this user.
        agent_id: If set, only return sessions bound to this agent config.

    Returns:
        A list of SessionDB rows sorted by last-updated descending.

    """
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(SessionDB).order_by(
            desc(SessionDB.is_pinned),
            desc(SessionDB.updated_at),
        ).limit(limit)
        if agent_id:
            stmt = stmt.where(SessionDB.agent_id == agent_id)
        if user_id:
            stmt = stmt.where(SessionDB.user_id == user_id)
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def update_session_title(session_id: str, title: str) -> SessionDB | None:
    """Update a session's title and return the refreshed row."""
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(SessionDB, session_id)
        if not obj:
            return None
        obj.title = title
        obj.updated_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(obj)
        return obj


async def update_session_pin(session_id: str, is_pinned: bool) -> SessionDB | None:
    """Pin/unpin a session. Returns the refreshed row, or None if not found."""
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(SessionDB, session_id)
        if not obj:
            return None
        obj.is_pinned = is_pinned
        obj.updated_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(obj)
        return obj


async def delete_session(session_id: str) -> bool:
    """Delete a session by ID. Returns False if not found."""
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(SessionDB, session_id)
        if not obj:
            return False
        await session.delete(obj)
        await session.commit()
        return True


async def update_session_team(session_id: str, team_id: str) -> None:
    """幂等补写：为会话绑定 team_id（URL 身份直开首次续聊时落库）。

    仅当会话当前 team_id 为空时写入——已有值不覆盖（尊重首次来源）。
    """
    factory = get_session_factory()
    async with factory() as session:
        await session.execute(
            update(SessionDB)
            .where(SessionDB.id == session_id, SessionDB.team_id.is_(None))
            .values(team_id=team_id)
        )
        await session.commit()
