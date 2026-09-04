"""性能追踪与分析。"""

from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import case, func, select

from core.infra.database import get_session_factory
from core.infra.logging_config import get_logger
from cost.time_window import DEFAULT_DAYS, apply_window, bucket_starts, resolve_window
from orm.session import ProjectRun
from orm.token_usage import TokenUsageDB

logger = get_logger(__name__)


def _bucket_key(granularity: str, dt_val: datetime) -> str:
    """hour 用完整 UTC 时间戳，其它用日期（与 PG date_trunc 桶 key 对齐）。"""
    return dt_val.strftime("%Y-%m-%dT%H:%M:%S") if granularity == "hour" else dt_val.date().isoformat()


class PerformanceTracker:
    """追踪并分析智能体性能指标。"""

    async def get_performance_summary(
        self,
        team_id: str | None = None,
        days: int = DEFAULT_DAYS,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict[str, Any]:
        """获取整体性能摘要。"""
        window = resolve_window(start_date, end_date, days)
        factory = get_session_factory()
        async with factory() as session:
            # 构建 run 的基础查询
            run_stmt = apply_window(
                select(ProjectRun), ProjectRun.created_at, window
            )
            if team_id:
                # 关联 sessions 以按 team 过滤
                from orm.session import SessionDB

                run_stmt = run_stmt.join(SessionDB, ProjectRun.session_id == SessionDB.id).where(
                    SessionDB.team_id == team_id
                )

            result = await session.execute(run_stmt)
            runs = result.scalars().all()

            if not runs:
                return {
                    "period_days": window.span_days,
                    "avg_response_time_s": 0,
                    "avg_success_rate": 0,
                    "avg_tokens_per_call": 0,
                    "total_calls": 0,
                }

            # 由 created_at → updated_at 计算响应时间
            response_times = []
            success_count = 0
            for r in runs:
                duration = (r.updated_at - r.created_at).total_seconds()
                response_times.append(duration)
                if r.status in ("converged",):
                    success_count += 1

            avg_response = sum(response_times) / len(response_times) if response_times else 0
            success_rate = success_count / len(runs) * 100 if runs else 0

            # 计算 P50 与 P95 百分位
            sorted_times = sorted(response_times)
            n = len(sorted_times)
            p50_idx = int(n * 0.5)
            p95_idx = int(n * 0.95)
            p50 = sorted_times[min(p50_idx, n - 1)]
            p95 = sorted_times[min(p95_idx, n - 1)]

            # 获取 token 数据
            token_stmt = apply_window(
                select(
                    func.sum(TokenUsageDB.total_tokens).label("total_tokens"),
                    func.count(TokenUsageDB.id).label("total_calls"),
                ),
                TokenUsageDB.timestamp,
                window,
            )
            if team_id:
                token_stmt = token_stmt.where(TokenUsageDB.team_id == team_id)

            token_result = await session.execute(token_stmt)
            token_row = token_result.first()

            total_tokens = int(token_row.total_tokens or 0) if token_row else 0
            total_calls = int(token_row.total_calls or 0) if token_row else 0
            avg_tokens = round(total_tokens / total_calls) if total_calls > 0 else 0

            return {
                "period_days": window.span_days,
                "avg_response_time_s": round(avg_response, 1),
                "p50_response_time_s": round(p50, 1),
                "p95_response_time_s": round(p95, 1),
                "avg_success_rate": round(success_rate, 1),
                "avg_tokens_per_call": avg_tokens,
                "total_calls": total_calls,
            }

    async def get_performance_trend(
        self,
        team_id: str | None = None,
        days: int = DEFAULT_DAYS,
        start_date: date | None = None,
        end_date: date | None = None,
        granularity: str = "day",
        tz_offset_min: int | None = None,
    ) -> dict[str, Any]:
        """性能趋势，按 granularity(hour/day/week/month) 分桶 + 空桶补齐。

        窗口与桶宽由调用方显式给出（前端范围预设：今天/昨天→hour）。此前硬编码
        ``func.date(...)`` 按天分桶，导致"今天"区间只有 1 个数据点（历史缺陷）。
        ``hour`` 桶 key 用完整时间戳，其余用日期；Python 侧按对齐后的桶起点补齐
        空桶，保证 X 轴连续。
        ``tz_offset_min`` 提供时按用户本地日界/整点切桶（DB 平移 ts+offset 再截），
        X 轴不会按 UTC 漂移出用户的一天。
        """
        if granularity not in ("hour", "day", "week", "month"):
            raise ValueError(f"granularity 仅支持 hour/day/week/month，收到: {granularity}")

        tz_off = timedelta(minutes=int(tz_offset_min)) if tz_offset_min else timedelta(0)
        window = resolve_window(start_date, end_date, days, tz_offset_min=tz_offset_min)
        trunc_unit = {"hour": "hour", "day": "day", "week": "week", "month": "month"}[granularity]
        bucket_col = func.date_trunc(trunc_unit, ProjectRun.created_at + tz_off).label("bucket")
        token_bucket_col = func.date_trunc(trunc_unit, TokenUsageDB.timestamp + tz_off).label("bucket")
        if tz_offset_min:
            from cost.time_window import local_bucket_starts

            starts = local_bucket_starts(granularity, window, tz_offset_min)
        else:
            starts = bucket_starts(granularity, window.start, window.end)

        factory = get_session_factory()
        async with factory() as session:
            # 按所选桶宽分组的响应时间趋势
            run_stmt = (
                apply_window(
                    select(
                        bucket_col,
                        func.avg(
                            func.extract("epoch", ProjectRun.updated_at)
                            - func.extract("epoch", ProjectRun.created_at)
                        ).label("avg_duration_s"),
                        func.count(ProjectRun.id).label("total_runs"),
                        func.sum(
                            case(
                                (ProjectRun.status == "converged", 1),
                                else_=0,
                            )
                        ).label("success_count"),
                    ),
                    ProjectRun.created_at,
                    window,
                )
                .group_by(bucket_col)
                .order_by("bucket")
            )

            if team_id:
                from orm.session import SessionDB

                run_stmt = run_stmt.join(SessionDB, ProjectRun.session_id == SessionDB.id).where(
                    SessionDB.team_id == team_id
                )

            result = await session.execute(run_stmt)

            # 每桶 token 趋势（相同粒度）用于 avg_tokens 列
            token_stmt = (
                apply_window(
                    select(
                        token_bucket_col,
                        func.avg(TokenUsageDB.total_tokens).label("avg_tokens"),
                    ),
                    TokenUsageDB.timestamp,
                    window,
                )
                .group_by(token_bucket_col)
                .order_by("bucket")
            )
            if team_id:
                token_stmt = token_stmt.where(TokenUsageDB.team_id == team_id)

            token_rows = {
                _bucket_key(granularity, r.bucket): r.avg_tokens
                for r in (await session.execute(token_stmt)).all()
            }

            # 桶内单次调用明细：hour 视图下附上每条 run 的精确发起时刻(本地 HH:MM:SS)+耗时，
            # 让 tooltip 能看到"19:30 / 20:30 / 21:10" 而非只一个整点聚合值（对齐大厂：趋势
            # hover 到分秒级别的单条明细）。非 hour 粒度不附，避免宽窗口明细爆炸。
            detail_map: dict[str, list[dict[str, Any]]] = {}
            if granularity == "hour":
                det_stmt = apply_window(
                    select(
                        ProjectRun.created_at,
                        ProjectRun.updated_at,
                    ),
                    ProjectRun.created_at,
                    window,
                )
                if team_id:
                    det_stmt = det_stmt.join(SessionDB, ProjectRun.session_id == SessionDB.id).where(
                        SessionDB.team_id == team_id
                    )
                for dr in (await session.execute(det_stmt)).all():
                    local = (
                        (dr.created_at + tz_off).replace(tzinfo=None)
                        if tz_off
                        else dr.created_at.replace(tzinfo=None)
                    )
                    key = local.replace(minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S")
                    dur = float((dr.updated_at - dr.created_at).total_seconds()) if dr.updated_at else 0.0
                    detail_map.setdefault(key, []).append(
                        {"t": local.strftime("%H:%M:%S"), "dur": round(dur, 1)}
                    )

            run_map: dict[str, dict[str, Any]] = {}
            for r in result.all():
                key = _bucket_key(granularity, r.bucket)
                avg_dur = float(r.avg_duration_s or 0)
                total = r.total_runs or 0
                success = r.success_count or 0
                run_map[key] = {
                    "time_bucket": key,
                    "avg_response_time_s": round(avg_dur, 1),
                    "calls": total,
                    "success_rate": round(success / total * 100, 1) if total > 0 else 0,
                }

            # 空桶补零以保持 X 轴连续（例如"今天"即便空闲时段也可产生至多 24 个整点）。
            trend = []
            for probe in starts:
                key = _bucket_key(granularity, probe)
                item = run_map.get(key)
                if item is None:
                    item = {
                        "time_bucket": key,
                        "avg_response_time_s": 0.0,
                        "calls": 0,
                        "success_rate": 0.0,
                    }
                item["avg_tokens"] = round(token_rows.get(key, 0))
                # hour 视图附带该桶内每条 run 的精确时刻明细（供 tooltip 展示）
                if granularity == "hour":
                    item["runs"] = detail_map.get(key, [])
                trend.append(item)

            return {"trend": trend}

    async def get_agent_ranking(
        self,
        team_id: str | None = None,
        days: int = DEFAULT_DAYS,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict[str, Any]:
        """获取 agent/node 性能排行。"""
        window = resolve_window(start_date, end_date, days)
        factory = get_session_factory()
        async with factory() as session:
            stmt = (
                apply_window(
                    select(
                        TokenUsageDB.node_id,
                        func.count(TokenUsageDB.id).label("calls"),
                        func.sum(TokenUsageDB.total_tokens).label("total_tokens"),
                        func.sum(TokenUsageDB.cost_usd).label("total_cost"),
                    ),
                    TokenUsageDB.timestamp,
                    window,
                )
                .group_by(TokenUsageDB.node_id)
                .order_by(func.sum(TokenUsageDB.total_tokens).desc())
            )
            if team_id:
                stmt = stmt.where(TokenUsageDB.team_id == team_id)

            result = await session.execute(stmt)
            rows = result.all()

            ranking = []
            for i, r in enumerate(rows, 1):
                calls = r.calls or 0
                tokens = r.total_tokens or 0
                ranking.append(
                    {
                        "rank": i,
                        "node_id": r.node_id,
                        "calls": calls,
                        "total_tokens": tokens,
                        "total_cost_usd": float(r.total_cost or 0),
                        "avg_tokens": round(tokens / calls) if calls > 0 else 0,
                    }
                )

            return {"ranking": ranking}


# 单例
_performance_tracker: PerformanceTracker | None = None


def get_performance_tracker() -> PerformanceTracker:
    """获取性能追踪器单例。"""
    global _performance_tracker
    if _performance_tracker is None:
        _performance_tracker = PerformanceTracker()
    return _performance_tracker
