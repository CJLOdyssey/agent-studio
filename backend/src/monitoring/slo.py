"""在滚动窗口内基于 runs 的 SLO 错误预算计算。"""

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import case, func, select

from core.infra.database import get_session_factory
from orm.session import ProjectRun


class SLOService:
    """针对目标 SLO 计算 SLI、剩余预算与燃尽速率。"""

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
        # 错误预算语义：target(如 99%) 允许 error_share(1%) 的错误配额。
        # 剩余预算 = 配额中还没被消耗的比例(0~100%)：
        #   actual_err = 当前实际错误率；burn_rate = actual_err / error_share
        #   剩余 = max(0, 1 - burn_rate) * 100
        # 修复历史缺陷 remaining = sli - target：error=0 时它给出 1.00(错当剩余1%)，
        # 实际应为 100%(配额一点没用)。两者单位/含义都不一致且与 burn_rate 打架。
        error_share = 100.0 - target_percent
        actual_err = max(0.0, 100.0 - sli)
        burn_rate = actual_err / error_share if error_share > 0 else 0.0
        remaining_pct = max(0.0, (1.0 - burn_rate)) * 100.0
        return {
            "target_percent": target_percent,
            "window_seconds": window_seconds,
            "total_requests": total,
            "error_count": errors,
            "sli_percent": round(sli, 2),
            "budget_remaining_percent": round(remaining_pct, 2),
            "burn_rate": round(burn_rate, 2),
        }


_slo_service: SLOService | None = None


def get_slo_service() -> SLOService:
    global _slo_service
    if _slo_service is None:
        _slo_service = SLOService()
    return _slo_service
