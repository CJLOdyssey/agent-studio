"""成本归因报告（从 TokenTracker.get_cost_attribution 提取）。

单一职责：跨维度聚合成本归因，生成前端所需的归因报告。"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select

from cost.attribution import (
    DimensionSpec,
    _aggregate_attribution_dimension,
    _apply_label_map,
)
from cost.time_window import resolve_window
from cost.usage_query import _scope_usage
from orm.token_usage import TokenUsageDB


async def get_cost_attribution(
    *,
    session: Any,
    team_id: str | None = None,
    days: int = 7,
    start_date: Any = None,
    end_date: Any = None,
    model: str | None = None,
    user_id: str | None = None,
    node_id: str | None = None,
) -> dict[str, Any]:
    """跨可配置维度获取成本归因。

    每个维度由一个小的 ``DimensionSpec`` 描述：分组列、可选的人类可读
    ID → 标签解析器、以及 null 的回退 key。新增维度（如 by_agent）只需
    在此加一行——聚合循环无需改动。实现 OCP + SRP：本方法负责编排，
    各维度工作由 :func:`_aggregate_attribution_dimension` 完成。
    """
    window = resolve_window(start_date, end_date, days)

    total_stmt = _scope_usage(
        window, team_id, model, select(func.coalesce(func.sum(TokenUsageDB.cost_usd), 0.0)), user_id, node_id
    )
    total_cost = float((await session.execute(total_stmt)).scalar() or 0.0)

    async def _resolve_id_to_name(model_ref: Any, ids: list[str], table_name: str) -> dict[str, str]:
        if not ids:
            return {}
        try:
            from orm.agent import TeamDB
            from orm.auth import UserDB

            table = TeamDB if table_name == "teams" else UserDB
            if table_name == "teams":
                stmt = select(table.id, table.name).where(table.id.in_(ids))  # type: ignore[union-attr]
            else:
                stmt = select(table.id, table.username).where(table.id.in_(ids))  # type: ignore[union-attr]
            rows = (await session.execute(stmt)).all()
            return {r[0]: r[1] for r in rows}
        except Exception:
            return {}

    dimension_specs = [
        DimensionSpec(key="by_team", column=TokenUsageDB.team_id, null_fallback="未分配", truncate_orphans=True),
        DimensionSpec(key="by_node", column=TokenUsageDB.node_id, null_fallback="unknown", truncate_orphans=False),
        DimensionSpec(key="by_model", column=TokenUsageDB.model, null_fallback="unknown", truncate_orphans=False),
        DimensionSpec(key="by_user", column=TokenUsageDB.user_id, null_fallback="unknown", truncate_orphans=True),
    ]

    results: dict[str, dict[str, dict[str, Any]]] = {}
    total_entities = 0

    for spec in dimension_specs:
        id_to_label: dict[str, str] = {}
        if spec.key == "by_team":
            id_to_label = await _resolve_id_to_name(spec.column, [], "teams")
        elif spec.key == "by_user":
            id_to_label = await _resolve_id_to_name(spec.column, [], "users")

        aggregate = await _aggregate_attribution_dimension(
            session=session,
            window=window,
            team_id=team_id,
            model=model,
            user_id=user_id,
            spec=spec,
            total_cost=total_cost,
            id_to_label_resolver=id_to_label,
            node_id=node_id,
        )
        results[spec.key] = aggregate
        total_entities += len(aggregate)

    if results["by_team"]:
        ids = list(results["by_team"].keys())
        id_to_label = await _resolve_id_to_name(TokenUsageDB.team_id, ids, "teams")
        if id_to_label:
            results["by_team"] = _apply_label_map(results["by_team"], id_to_label, "未分配")
    if results["by_user"]:
        ids = list(results["by_user"].keys())
        id_to_label = await _resolve_id_to_name(TokenUsageDB.user_id, ids, "users")
        if id_to_label:
            results["by_user"] = _apply_label_map(results["by_user"], id_to_label, "unknown")

    from cost.pricing import get_model_pricing

    unpriced_models = {
        m for m in results.get("by_model", {}) if get_model_pricing(m) is None
    }
    for m, data in results.get("by_model", {}).items():
        data["unpriced"] = m in unpriced_models

    unattributed_stmt = _scope_usage(
        window,
        team_id,
        model,
        select(func.coalesce(func.sum(TokenUsageDB.cost_usd), 0.0)).where(
            TokenUsageDB.team_id.is_(None) & TokenUsageDB.user_id.is_(None)
        ),
        user_id,
        node_id,
    )
    unattributed_cost = float((await session.execute(unattributed_stmt)).scalar() or 0.0)
    unattributed_ratio = unattributed_cost / total_cost if total_cost > 0 else 0.0

    return {
        "total_cost": total_cost,
        "total_entities": total_entities,
        "unattributed_cost": unattributed_cost,
        "unattributed_ratio": unattributed_ratio,
        "unpriced_models": sorted(unpriced_models),
        **results,
    }
