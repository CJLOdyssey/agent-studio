"""Project run repository — CRUD for run lifecycle management."""

import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import desc, select

from core.infra.database import ProjectRun, SessionDB, get_session_factory


async def get_session_runs(session_id: str) -> list[ProjectRun]:
    """Return all project runs belonging to a session, ordered by creation time."""
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(ProjectRun)
            .where(ProjectRun.session_id == session_id)
            .order_by(ProjectRun.created_at)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def get_runs_by_session_ids(session_ids: list[str]) -> dict[str, list[ProjectRun]]:
    """Batch-load runs for multiple session IDs, keyed by session_id."""
    if not session_ids:
        return {}
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(ProjectRun)
            .where(ProjectRun.session_id.in_(session_ids))
            .order_by(ProjectRun.created_at)
        )
        result = await session.execute(stmt)
        runs = list(result.scalars().all())
        grouped: dict[str, list[ProjectRun]] = {}
        for run in runs:
            grouped.setdefault(run.session_id or "", []).append(run)
        return grouped


async def create_run(
    requirement: str,
    session_id: str | None = None,
    parent_run_id: str | None = None,
    requirement_versions: list[str] | None = None,
) -> str:
    """Create a new project run and return its ID.

    Also touches the parent session's updated_at timestamp.
    ``parent_run_id`` links an edit-regenerate to the run it replaces;
    ``requirement_versions`` carries the user-message edit history chain.
    """
    run_id = str(uuid4())
    run = ProjectRun(
        id=run_id,
        session_id=session_id,
        requirement=requirement,
        status="pending",
        parent_run_id=parent_run_id,
        requirement_versions=json.dumps(requirement_versions) if requirement_versions else None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    factory = get_session_factory()
    async with factory() as session:
        session.add(run)
        await session.commit()
        if session_id:
            sess = await session.get(SessionDB, session_id)
            if sess:
                sess.updated_at = datetime.now(UTC)
                await session.commit()
    return run_id


async def update_run_status(run_id: str, status: str) -> Any:
    """Update the status field of a project run."""
    factory = get_session_factory()
    async with factory() as session:
        run = await session.get(ProjectRun, run_id)
        if run:
            run.status = status
            run.updated_at = datetime.now(UTC)
            await session.commit()


async def update_run_result(
    run_id: str,
    pm_document: str,
    code: str,
    review: str,
    approved: bool,
    status: str,
) -> Any:
    """Persist the full result payload of a completed run."""
    factory = get_session_factory()
    async with factory() as session:
        run = await session.get(ProjectRun, run_id)
        if run:
            run.pm_document = pm_document
            run.code = code
            run.review = review
            run.approved = approved
            run.status = status
            run.updated_at = datetime.now(UTC)
            await session.commit()


async def get_run(run_id: str) -> ProjectRun | None:
    """Fetch a single project run by its primary key ID."""
    factory = get_session_factory()
    async with factory() as session:
        run = await session.get(ProjectRun, run_id)
        return run


async def get_runs(limit: int = 20, user_id: str | None = None) -> list[ProjectRun]:
    """Return the most recent project runs, up to the given limit.

    When ``user_id`` is given, only runs belonging to that user's sessions
    are returned (session ownership is the run's owner boundary).
    """
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(ProjectRun).order_by(desc(ProjectRun.created_at)).limit(limit)
        if user_id and user_id != "anonymous":
            stmt = stmt.join(SessionDB, SessionDB.id == ProjectRun.session_id).where(
                SessionDB.user_id == user_id
            )
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def get_run_ancestors(run_id: str) -> list[ProjectRun]:
    """Return the run and all its ancestors via parent_run_id, root-first.

    Fetches the whole chain in one recursive CTE query instead of walking one
    ``session.get`` per ancestor level. Depth is capped to guard against
    cycles in corrupt data (previously capped by a seen-set walk).
    """
    from sqlalchemy import desc, literal, select
    from sqlalchemy.orm import aliased

    factory = get_session_factory()
    async with factory() as session:
        parent = aliased(ProjectRun)
        chain = (
            select(ProjectRun.id, ProjectRun.parent_run_id, literal(0).label("depth"))
            .where(ProjectRun.id == run_id)
            .cte(name="run_chain", recursive=True)
        )
        chain = chain.union_all(
            select(parent.id, parent.parent_run_id, chain.c.depth + 1)
            .join(chain, parent.id == chain.c.parent_run_id)
            .where(chain.c.depth < 100)
        )
        result = await session.execute(
            select(ProjectRun)
            .join(chain, ProjectRun.id == chain.c.id)
            .order_by(desc(chain.c.depth))
        )
        return list(result.scalars().all())
