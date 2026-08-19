"""Metric queries backing alert rules — one source of truth for rule metric values.

Open/closed: new metric types register via the ``@metric`` decorator, so the
evaluator and rule CRUD never need to grow a branch per metric.
"""

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import case, func, select

from core.infra.database import get_session_factory
from core.infra.logging_config import get_logger
from orm.session import ProjectRun
from orm.token_usage import TokenUsageDB

logger = get_logger(__name__)

MetricHandler = Callable[[int, str | None], Awaitable[float | None]]
_HANDLERS: dict[str, MetricHandler] = {}


def metric(metric_type: str) -> Callable[[MetricHandler], MetricHandler]:
    """Register a metric handler under ``metric_type``."""

    def decorator(handler: MetricHandler) -> MetricHandler:
        _HANDLERS[metric_type] = handler
        return handler

    return decorator


def supported_metrics() -> list[str]:
    """Names of every registered metric type."""
    return sorted(_HANDLERS)


def _cutoff(window_seconds: int) -> datetime:
    return datetime.now(UTC) - timedelta(seconds=window_seconds)


def _team_join(stmt: Any, team_id: str | None) -> Any:
    if team_id is None:
        return stmt
    from orm.session import SessionDB

    return stmt.join(SessionDB, ProjectRun.session_id == SessionDB.id).where(SessionDB.team_id == team_id)


@metric("success_rate")
async def _success_rate(window_seconds: int, team_id: str | None) -> float | None:
    """Percent of runs that converged within the window; None when no runs."""
    async with get_session_factory()() as session:
        stmt = select(
            func.count(ProjectRun.id).label("total"),
            func.sum(case((ProjectRun.status == "converged", 1), else_=0)).label("ok"),
        ).where(ProjectRun.created_at >= _cutoff(window_seconds))
        row = (await session.execute(_team_join(stmt, team_id))).first()
        total = int(row.total or 0) if row else 0
        if total == 0:
            return None
        ok = int(row.ok or 0) if row else 0
        return ok / total * 100


async def _durations(window_seconds: int, team_id: str | None) -> list[float]:
    """Run durations (updated_at - created_at) in seconds within the window."""
    async with get_session_factory()() as session:
        stmt = select(ProjectRun.created_at, ProjectRun.updated_at).where(
            ProjectRun.created_at >= _cutoff(window_seconds)
        )
        rows = (await session.execute(_team_join(stmt, team_id))).all()
        return [max((r.updated_at - r.created_at).total_seconds(), 0.0) for r in rows]


@metric("p95_latency")
async def _p95_latency(window_seconds: int, team_id: str | None) -> float | None:
    durations = sorted(await _durations(window_seconds, team_id))
    if not durations:
        return None
    return durations[min(int(len(durations) * 0.95), len(durations) - 1)]


@metric("avg_latency")
async def _avg_latency(window_seconds: int, team_id: str | None) -> float | None:
    durations = await _durations(window_seconds, team_id)
    if not durations:
        return None
    return sum(durations) / len(durations)


@metric("daily_cost")
async def _daily_cost(window_seconds: int, team_id: str | None) -> float:
    """USD cost accumulated within the window (0 is a valid measurement)."""
    async with get_session_factory()() as session:
        stmt = select(func.sum(TokenUsageDB.cost_usd)).where(TokenUsageDB.timestamp >= _cutoff(window_seconds))
        if team_id:
            stmt = stmt.where(TokenUsageDB.team_id == team_id)
        value = (await session.execute(stmt)).scalar_one_or_none()
        return float(value or 0.0)


@metric("error_count")
async def _error_count(window_seconds: int, team_id: str | None) -> float:
    """Number of runs that ended in error within the window (0 is valid)."""
    async with get_session_factory()() as session:
        stmt = select(func.count(ProjectRun.id)).where(
            ProjectRun.status == "error", ProjectRun.created_at >= _cutoff(window_seconds)
        )
        row = (await session.execute(_team_join(stmt, team_id))).scalar_one_or_none()
        return float(row or 0.0)


class MetricService:
    """Resolves a metric value for a rule window; None means no data."""

    async def get(self, metric_type: str, window_seconds: int, team_id: str | None = None) -> float | None:
        handler = _HANDLERS.get(metric_type)
        if handler is None:
            raise ValueError(f"unsupported metric type: {metric_type}")
        return await handler(window_seconds, team_id)


_metric_service: MetricService | None = None


def get_metric_service() -> MetricService:
    global _metric_service
    if _metric_service is None:
        _metric_service = MetricService()
    return _metric_service
