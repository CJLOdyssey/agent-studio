"""用量摘要查询（从 TokenTracker.get_summary 提取）。

单一职责：按维度聚合 token 用量统计，生成前端仪表盘摘要。"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select

from cost.time_window import resolve_window
from cost.usage_query import _scope_usage
from orm.token_usage import TokenUsageDB


async def get_summary(
    *,
    session: Any,
    team_id: str | None = None,
    days: int = 7,
    start_date: Any = None,
    end_date: Any = None,
    model: str | None = None,
    user_id: str | None = None,
    node_id: str | None = None,
    key_id: str | None = None,
) -> dict[str, Any]:
    """获取某 team 或所有 team 的 token 用量摘要。"""
    window = resolve_window(start_date, end_date, days)

    agg_exprs = (
        func.coalesce(func.sum(TokenUsageDB.total_tokens), 0),
        func.coalesce(func.sum(TokenUsageDB.cost_usd), 0.0),
        func.coalesce(func.sum(TokenUsageDB.prompt_tokens), 0),
        func.coalesce(func.sum(TokenUsageDB.completion_tokens), 0),
        func.count(TokenUsageDB.id),
    )
    total_stmt = _scope_usage(window, team_id, model, select(*agg_exprs), user_id, node_id, key_id)
    total_row = (await session.execute(total_stmt)).one()
    total_tokens = int(total_row[0])
    total_cost = float(total_row[1])
    total_prompt = int(total_row[2])
    total_completion = int(total_row[3])
    total_calls = int(total_row[4])

    async def _grouped(key_col: Any, label: str | None = None) -> dict[str, dict[str, Any]]:
        stmt = _scope_usage(
            window,
            team_id,
            model,
            select(
                key_col,
                func.coalesce(func.sum(TokenUsageDB.total_tokens), 0),
                func.coalesce(func.sum(TokenUsageDB.cost_usd), 0.0),
                func.count(TokenUsageDB.id),
            ),
            user_id,
            node_id,
            key_id,
        )
        stmt = stmt.group_by(key_col)
        out: dict[str, dict[str, Any]] = {}
        for row in (await session.execute(stmt)).all():
            key = row[0]
            display_key = str(key) if key is not None else (label or "unknown")
            out[display_key] = {
                "tokens": int(row[1]),
                "cost_usd": float(row[2]),
                "calls": int(row[3]),
            }
        return out

    by_model = await _grouped(TokenUsageDB.model)
    by_node = await _grouped(TokenUsageDB.node_id)
    by_user = await _grouped(TokenUsageDB.user_id, label="unknown")

    all_user_ids = [uid for uid in by_user if uid != "unknown"]
    if all_user_ids:
        try:
            from orm.auth import UserDB

            user_stmt = select(UserDB.id, UserDB.username).where(UserDB.id.in_(all_user_ids))
            user_result = await session.execute(user_stmt)
            id_to_name = {row.id: row.username for row in user_result.all()}

            resolved = {}
            for uid, data in by_user.items():
                display_name = id_to_name.get(uid, uid[:8] + "...")
                resolved[display_name] = data
            by_user = resolved
        except Exception:
            pass

    return {
        "period_days": window.span_days,
        "total_tokens": total_tokens,
        "total_cost_usd": total_cost,
        "total_prompt_tokens": total_prompt,
        "total_completion_tokens": total_completion,
        "total_calls": total_calls,
        "by_model": by_model,
        "by_node": by_node,
        "by_user": by_user,
    }
