"""SLO error-budget calculation over runs in a rolling window."""

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import case, func, select

from core.infra.database import get_session_factory
from orm.session import ProjectRun


class SLOService:
    """Computes SLI, remaining budget, and burn rate for a target SLO."""

    async def calculate(
        self,
        target_percent: float,
        window_seconds: int = 30 * 86400,
        team_id: str | None = None,
    ) -> dict[str, Any]:
        cutoff = datetime.now(UTC) - timedelta(seconds=window_seconds)
        async with get_session_factory()() as session:
            stmt = select(
                func.count(ProjectRun.id).label("total"),
                func.sum(case((ProjectRun.status.in_(("error",)), 1), else_=0)).label("errors"),
            ).where(ProjectRun.created_at >= cutoff)
            if team_id:
                from orm.session import SessionDB

                stmt = stmt.join(SessionDB, ProjectRun.session_id == SessionDB.id).where(SessionDB.team_id == team_id)
            row = (await session.execute(stmt)).first()
            total = int(row.total or 0) if row else 0
            errors = int(row.errors or 0) if row else 0

        sli = (total - errors) / total * 100 if total > 0 else 100.0
        remaining = sli - target_percent
        error_share = 100.0 - target_percent
        burn_rate = (100.0 - sli) / error_share if error_share > 0 else 0.0
        return {
            "target_percent": target_percent,
            "window_seconds": window_seconds,
            "total_requests": total,
            "error_count": errors,
            "sli_percent": round(sli, 2),
            "budget_remaining_percent": round(remaining, 2),
            "burn_rate": round(burn_rate, 2),
        }


_slo_service: SLOService | None = None


def get_slo_service() -> SLOService:
    global _slo_service
    if _slo_service is None:
        _slo_service = SLOService()
    return _slo_service
