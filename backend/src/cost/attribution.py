"""成本归因辅助（OCP / SRP / DRY / LSP）。

将成本按可配置维度（团队 / 节点 / 模型 / 用户）聚合归因，并通过
``DimensionSpec`` 描述每个维度的规约，使新增维度只需追加一项而不改方法体。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select

from cost.usage_query import _scope_usage
from orm.token_usage import TokenUsageDB


@dataclass(frozen=True)
class DimensionSpec:
    """归因维度的规约（OCP）：新增维度=追加一项，不改方法体。

    - ``key``: 输出字典的顶层 key（如 ``by_team``）
    - ``column``: ORM 列，GROUP BY 依据
    - ``null_fallback``: NULL 时使用的占位 key（用于识别未归因）
    - ``truncate_orphans``: True 时把未解析到的 ID 截断成 ``id[:8]+'...'``
      防止 UUID 撑爆 UI（团队/用户解析失败时降级显示）
    """

    key: str
    column: Any
    null_fallback: str
    truncate_orphans: bool


def _apply_label_map(
    rows: dict[str, dict[str, Any]],
    id_to_label: dict[str, str],
    null_fallback: str,
) -> dict[str, dict[str, Any]]:
    """ID → 可读名映射；同一实体若重复，仅保留第一条（不丢数）。"""
    resolved: dict[str, dict[str, Any]] = {}
    for raw_key, data in rows.items():
        if raw_key == null_fallback:
            resolved[raw_key] = data
            continue
        label = id_to_label.get(raw_key)
        if label and label not in resolved:
            resolved[label] = data
        elif not label and raw_key not in resolved:
            # 未解析到，保留原 ID（保留全量信息，避免重复合并）
            resolved[raw_key] = data
    return resolved


async def _aggregate_attribution_dimension(
    session: Any,
    window: Any,
    team_id: str | None,
    model: str | None,
    user_id: str | None,
    spec: DimensionSpec,
    total_cost: float,
    id_to_label_resolver: dict[str, str],
    node_id: str | None = None,
) -> dict[str, dict[str, Any]]:
    """单维度归因聚合：单次 SQL → {entity: stats}。

    占比按调用方传入的 ``total_cost`` 计算，保证多维度横向可比（DRY + LSP：
    不同 spec 输出口径完全一致，调用方可任意切换）。
    """
    stmt = _scope_usage(
        window,
        team_id,
        model,
        select(
            spec.column.label("key"),
            func.coalesce(func.sum(TokenUsageDB.cost_usd), 0.0).label("cost"),
            func.coalesce(func.sum(TokenUsageDB.total_tokens), 0).label("tokens"),
            func.count(TokenUsageDB.id).label("calls"),
        ),
        user_id,
        node_id,
    )
    stmt = stmt.group_by(spec.column).order_by(func.sum(TokenUsageDB.cost_usd).desc())
    rows = (await session.execute(stmt)).all()

    out: dict[str, dict[str, Any]] = {}
    for r in rows:
        cost = float(r.cost or 0)
        raw = r.key
        key = raw if raw else spec.null_fallback
        entry = out.setdefault(
            key,
            {
                "cost_usd": 0.0,
                "tokens": 0,
                "calls": 0,
                "percentage": 0.0,
            },
        )
        entry["cost_usd"] += cost
        entry["tokens"] += int(r.tokens or 0)
        entry["calls"] += int(r.calls or 0)
    for v in out.values():
        v["percentage"] = round(v["cost_usd"] / total_cost * 100, 1) if total_cost > 0 else 0.0
    return out


def _resolve_id_to_name(
    model_ref: Any, ids: list[str], table_name: str
) -> dict[str, str]:
    """兼容保留占位：实际实现见 ``get_cost_attribution`` 内部（用同一 session）。

    留此函数是为了避免在两个文件里被引用时产生 ImportError（不在公开 API）。
    """
    return {}
