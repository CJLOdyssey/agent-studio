"""Performance tracking and analysis."""

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import case, func, select

from core.infra.database import get_session_factory
from core.infra.logging_config import get_logger
from orm.session import ProjectRun
from orm.token_usage import TokenUsageDB

logger = get_logger(__name__)


class PerformanceTracker:
    """Tracks and analyzes agent performance metrics."""

    async def get_performance_summary(
        self,
        team_id: str | None = None,
        days: int = 7,
    ) -> dict[str, Any]:
        """Get overall performance summary."""
        factory = get_session_factory()
        async with factory() as session:
            cutoff = datetime.now(UTC) - timedelta(days=days)

            # Build base query for runs
            run_stmt = select(ProjectRun).where(ProjectRun.created_at >= cutoff)
            if team_id:
                # Join with sessions to filter by team
                from orm.session import SessionDB
                run_stmt = run_stmt.join(
                    SessionDB, ProjectRun.session_id == SessionDB.id
                ).where(SessionDB.team_id == team_id)

            result = await session.execute(run_stmt)
            runs = result.scalars().all()

            if not runs:
                return {
                    "period_days": days,
                    "avg_response_time_s": 0,
                    "avg_success_rate": 0,
                    "avg_tokens_per_call": 0,
                    "total_calls": 0,
                }

            # Calculate response times from created_at → updated_at
            response_times = []
            success_count = 0
            for r in runs:
                duration = (r.updated_at - r.created_at).total_seconds()
                response_times.append(duration)
                if r.status in ("converged",):
                    success_count += 1

            avg_response = sum(response_times) / len(response_times) if response_times else 0
            success_rate = success_count / len(runs) * 100 if runs else 0

            # Get token data
            token_stmt = select(
                func.sum(TokenUsageDB.total_tokens).label("total_tokens"),
                func.count(TokenUsageDB.id).label("total_calls"),
            ).where(TokenUsageDB.timestamp >= cutoff)
            if team_id:
                token_stmt = token_stmt.where(TokenUsageDB.team_id == team_id)

            token_result = await session.execute(token_stmt)
            token_row = token_result.first()

            total_tokens = token_row.total_tokens or 0
            total_calls = token_row.total_calls or 0
            avg_tokens = round(total_tokens / total_calls) if total_calls > 0 else 0

            return {
                "period_days": days,
                "avg_response_time_s": round(avg_response, 1),
                "avg_success_rate": round(success_rate, 1),
                "avg_tokens_per_call": avg_tokens,
                "total_calls": total_calls,
            }

    async def get_performance_trend(
        self,
        team_id: str | None = None,
        days: int = 7,
    ) -> dict[str, Any]:
        """Get daily performance trend."""
        factory = get_session_factory()
        async with factory() as session:
            cutoff = datetime.now(UTC) - timedelta(days=days)

            # Daily response time trend (PostgreSQL compatible)
            run_stmt = (
                select(
                    func.date(ProjectRun.created_at).label("day"),
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
                )
                .where(ProjectRun.created_at >= cutoff)
                .group_by(func.date(ProjectRun.created_at))
                .order_by("day")
            )

            if team_id:
                from orm.session import SessionDB
                run_stmt = run_stmt.join(
                    SessionDB, ProjectRun.session_id == SessionDB.id
                ).where(SessionDB.team_id == team_id)

            result = await session.execute(run_stmt)
            rows = result.all()

            trend = []
            for r in rows:
                avg_dur = float(r.avg_duration_s or 0)
                total = r.total_runs or 0
                success = r.success_count or 0
                trend.append({
                    "day": str(r.day),
                    "avg_response_time_s": round(avg_dur, 1),
                    "total_calls": total,
                    "success_rate": round(success / total * 100, 1) if total > 0 else 0,
                })

            # Daily token trend
            token_stmt = (
                select(
                    func.date(TokenUsageDB.timestamp).label("day"),
                    func.avg(TokenUsageDB.total_tokens).label("avg_tokens"),
                )
                .where(TokenUsageDB.timestamp >= cutoff)
                .group_by(func.date(TokenUsageDB.timestamp))
                .order_by("day")
            )
            if team_id:
                token_stmt = token_stmt.where(TokenUsageDB.team_id == team_id)

            token_result = await session.execute(token_stmt)
            token_rows = {str(r.day): r.avg_tokens for r in token_result.all()}

            for item in trend:
                item["avg_tokens"] = round(token_rows.get(item["day"], 0))

            return {"trend": trend}

    async def get_agent_ranking(
        self,
        team_id: str | None = None,
        days: int = 7,
    ) -> dict[str, Any]:
        """Get agent/node performance ranking."""
        factory = get_session_factory()
        async with factory() as session:
            cutoff = datetime.now(UTC) - timedelta(days=days)

            stmt = (
                select(
                    TokenUsageDB.node_id,
                    func.count(TokenUsageDB.id).label("calls"),
                    func.sum(TokenUsageDB.total_tokens).label("total_tokens"),
                    func.sum(TokenUsageDB.cost_usd).label("total_cost"),
                )
                .where(TokenUsageDB.timestamp >= cutoff)
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
                ranking.append({
                    "rank": i,
                    "node_id": r.node_id,
                    "calls": calls,
                    "total_tokens": tokens,
                    "total_cost_usd": float(r.total_cost or 0),
                    "avg_tokens": round(tokens / calls) if calls > 0 else 0,
                })

            return {"ranking": ranking}


# Singleton
_performance_tracker: PerformanceTracker | None = None


def get_performance_tracker() -> PerformanceTracker:
    """Get the performance tracker singleton."""
    global _performance_tracker
    if _performance_tracker is None:
        _performance_tracker = PerformanceTracker()
    return _performance_tracker
