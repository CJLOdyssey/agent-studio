"""针对 ``llm_spans`` 的 trace 查询。

列表视图按 run 分组 span（每个 run = 一条 trace），暴露聚合指标
（模型集、tokens、cost、duration、错误数），使 trace 浏览器表格的每行
汇总一个完整 run。详情视图返回单个 run 的完整 span 树（父 + 子）供瀑布图渲染。
"""


from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from sqlalchemy import func, select

from core.infra.database import get_session_factory
from orm.llm_span import LLMSpanDB
from orm.session import ProjectRun, SessionDB


def _utc_day_start(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=UTC)


def _utc_day_end(d: date) -> datetime:
    return datetime.combine(d, time.max, tzinfo=UTC)


def _as_dict(s: Any) -> dict[str, Any]:
    return {
        "id": s.id,
        "run_id": s.run_id,
        "session_id": s.session_id,
        "parent_span_id": s.parent_span_id,
        "span_type": s.span_type,
        "node_id": s.node_id,
        "model": s.model,
        "prompt_tokens": s.prompt_tokens,
        "completion_tokens": s.completion_tokens,
        "total_tokens": s.total_tokens,
        "cost_usd": s.cost_usd,
        "duration_ms": s.duration_ms,
        "status": s.status,
        "error": s.error,
        "team_id": s.team_id,
        "user_id": s.user_id,
        "key_id": s.key_id,
        "input_snapshot": s.input_snapshot,
        "output_snapshot": s.output_snapshot,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


async def list_traces(
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    days: int = 7,
    run_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    team_id: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """按 run 分组返回 trace，最新在前，带分页。

    每条 trace 行聚合其 span（顶层 status/duration/cost/tokens）
    并统计子 span 数量。行以 run 为 key，使列表与 cost/run 页面的语义一致。
    """
    end = datetime.now(UTC) if end_date is None else _utc_day_end(end_date)
    start = end - timedelta(days=days) if start_date is None else _utc_day_start(start_date)

    factory = get_session_factory()
    async with factory() as session:
        # 按 run_id 分组，每个 run 形成一条 trace。
        base = (
            select(
                LLMSpanDB.run_id.label("run_id"),
                func.count(LLMSpanDB.id).label("span_count"),
                func.sum(LLMSpanDB.total_tokens).label("total_tokens"),
                func.sum(LLMSpanDB.prompt_tokens).label("prompt_tokens"),
                func.sum(LLMSpanDB.completion_tokens).label("completion_tokens"),
                func.sum(LLMSpanDB.cost_usd).label("cost_usd"),
                func.max(LLMSpanDB.created_at).label("last_at"),
                func.sum(LLMSpanDB.duration_ms).label("duration_ms"),
            )
            .where(LLMSpanDB.created_at >= start, LLMSpanDB.created_at <= end)
        )
        if team_id:
            base = base.where(LLMSpanDB.team_id == team_id)
        if user_id:
            base = base.where(LLMSpanDB.user_id == user_id)
        if run_id:
            base = base.where(LLMSpanDB.run_id == run_id)
        base = base.group_by(LLMSpanDB.run_id)

        total_stmt = select(func.count()).select_from(base.subquery())
        total = (await session.execute(total_stmt)).scalar_one()

        rows = (
            await session.execute(
                base.order_by(func.max(LLMSpanDB.created_at).desc()).offset(offset).limit(limit)
            )
        ).all()

        traces: list[dict[str, Any]] = []
        run_ids = [r.run_id for r in rows if r.run_id]
        # 各 run 的状态：取状态以构建 error/success 计数
        status_map: dict[str, dict[str, int]] = {}
        if run_ids:
            st_rows = (
                await session.execute(
                    select(
                        LLMSpanDB.run_id.label("run_id"),
                        LLMSpanDB.status.label("status"),
                        func.count(LLMSpanDB.id).label("c"),
                    )
                    .where(LLMSpanDB.run_id.in_(run_ids))
                    .group_by(LLMSpanDB.run_id, LLMSpanDB.status)
                )
            ).all()
            for s in st_rows:
                status_map.setdefault(s.run_id, {})[s.status] = s.c

        # 按大厂 trace 浏览器的方式解析每条 trace 首列标签：展示该 run 自己的
        # 输入（project_runs.requirement = 该 run 精确的用户提交），而非 session
        # 标题（后者是整个会话的首条消息，因此同一 session 的每个 run 都相同——
        # 参见 40e12a07 与 9ad5b83e，两者 requirement 不同却都显示
        # "你是 什么 模型"）。依次回退到 session 标题，再回退到空（UI 回退到 run_id）。
        label_map: dict[str, str | None] = {}
        if run_ids:
            # 该 run 自己的用户输入文本（权威来源）。
            run_req_rows = (
                await session.execute(
                    select(ProjectRun.id, ProjectRun.requirement).where(ProjectRun.id.in_(run_ids))
                )
            ).all()
            req_by_run: dict[str, str | None] = {
                rid: (req or None) for rid, req in run_req_rows
            }
            # 该 run 的 session（无 requirement 时作回退标题）。
            sid_rows = (
                await session.execute(
                    select(
                        LLMSpanDB.run_id.label("run_id"),
                        func.max(LLMSpanDB.session_id).label("session_id"),
                    )
                    .where(LLMSpanDB.run_id.in_(run_ids))
                    .group_by(LLMSpanDB.run_id)
                )
            ).all()
            session_ids = {row.session_id for row in sid_rows if row.session_id}
            title_map: dict[str, str] = {}
            if session_ids:
                title_rows = (
                    await session.execute(
                        select(SessionDB.id, SessionDB.title).where(SessionDB.id.in_(session_ids))
                    )
                ).all()
                for sid, title in title_rows:
                    title_map[sid] = title
            for r in run_ids:
                # 优先 requirement；其次 session 标题；否则 None
                label_map[r] = req_by_run.get(r) or None
            for row in sid_rows:
                if row.run_id in label_map and not label_map[row.run_id] and row.session_id:
                    label_map[row.run_id] = title_map.get(row.session_id)

        for r in rows:
            st = status_map.get(r.run_id, {})
            error_spans = st.get("error", 0)
            traces.append(
                {
                    "run_id": r.run_id,
                    "title": label_map.get(r.run_id),
                    "span_count": int(r.span_count or 0),
                    "total_tokens": int(r.total_tokens or 0),
                    "prompt_tokens": int(r.prompt_tokens or 0),
                    "completion_tokens": int(r.completion_tokens or 0),
                    "cost_usd": float(r.cost_usd or 0.0),
                    "duration_ms": int(r.duration_ms or 0),
                    "last_at": r.last_at.isoformat() if r.last_at else None,
                    "error_spans": int(error_spans),
                    "has_error": error_spans > 0,
                }
            )
    return {"traces": traces, "total": total, "limit": limit, "offset": offset}


async def get_trace(run_id: str, *, team_id: str | None = None, user_id: str | None = None) -> list[dict[str, Any]]:
    """返回某个 run 的完整有序 span 集合（父 + 子）。"""
    factory = get_session_factory()
    async with factory() as session:
        q = select(LLMSpanDB).where(LLMSpanDB.run_id == run_id)
        if team_id:
            q = q.where(LLMSpanDB.team_id == team_id)
        if user_id:
            q = q.where(LLMSpanDB.user_id == user_id)
        q = q.order_by(LLMSpanDB.created_at.asc())
        spans = (await session.execute(q)).scalars().all()
        return [_as_dict(s) for s in spans]
