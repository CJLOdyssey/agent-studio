from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import desc, select

from virtual_team.database import ProjectRun, SessionDB, get_session_factory


async def get_session_runs(session_id: str) -> list[ProjectRun]:
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


async def create_run(requirement: str, session_id: str | None = None) -> str:
    run_id = str(uuid4())
    run = ProjectRun(
        id=run_id,
        session_id=session_id,
        requirement=requirement,
        status="pending",
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


async def update_run_status(run_id: str, status: str):
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
):
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
    factory = get_session_factory()
    async with factory() as session:
        run = await session.get(ProjectRun, run_id)
        return run


async def get_runs(limit: int = 20) -> list[ProjectRun]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(ProjectRun).order_by(desc(ProjectRun.created_at)).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())
