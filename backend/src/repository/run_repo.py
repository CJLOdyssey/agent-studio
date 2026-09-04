"""项目 run 仓库——run 生命周期管理的 CRUD。"""

import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import desc, select

from core.infra.database import get_session_factory
from orm import ProjectRun, SessionDB


async def get_session_runs(session_id: str) -> list[ProjectRun]:
    """返回属于某会话的所有项目 run，按创建时间排序。"""
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
    """批量加载多个会话 ID 的 run，按 session_id 分组。"""
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
    """创建新的项目 run 并返回其 ID。

    同时更新父会话的 updated_at 时间戳。
    ``parent_run_id`` 将编辑-重新生成链接到它替换的 run；
    ``requirement_versions`` 承载用户消息的编辑历史链。
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
    """更新项目 run 的 status 字段。"""
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
    """持久化已完成 run 的完整结果载荷。"""
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
    """按主键 ID 获取单个项目 run。"""
    factory = get_session_factory()
    async with factory() as session:
        run = await session.get(ProjectRun, run_id)
        return run


async def get_runs(limit: int = 20, user_id: str | None = None) -> list[ProjectRun]:
    """返回最近的项目 run，至多给定 limit 条。

    当给出 ``user_id`` 时，仅返回属于该用户会话的 run
    （会话属主是 run 的属主边界）。
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
    """通过 parent_run_id 返回 run 及其所有祖先，根在前。

    用一次递归 CTE 查询获取整条链，而非每个祖先层级走一次
    ``session.get``。深度有上限，以防损坏数据中的循环
    （此前由 seen-set 遍历限制）。
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
