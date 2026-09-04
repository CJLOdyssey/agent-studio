"""按时间粒度返回成本趋势。

单一职责：将 get_daily_trend 的查询/补桶逻辑从 TokenTracker 中解耦，
使其成为可独立测试的纯函数。"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import func, select

from cost.time_window import bucket_starts, resolve_window
from cost.usage_query import _scope_usage
from orm.token_usage import TokenUsageDB


async def get_daily_trend(
    *,
    session: Any,
    team_id: str | None = None,
    days: int = 7,
    model: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    granularity: str = "day",
    user_id: str | None = None,
    node_id: str | None = None,
    key_id: str | None = None,
    tz_offset_min: int | None = None,
) -> list[dict[str, Any]]:
    """按时间粒度返回成本趋势。

    范围与粒度由调用方显式给出（前端"范围预设"直接决定窗口+桶宽）：
    - day/hour 用于较短窗口（今天/昨天/近几天）；hour 对齐整点，长窗口桶数多、慎用。
    - week/month 保留用于较宽历史视图。
    窗口始终 = 调用方给的区间；空桶由 Python 补齐保证 X 轴连续。

    ``granularity`` 仅接受 hour/day/week/month。
    ``tz_offset_min``：用户时区(分钟，东为正)。有值时日历日边界按用户本地 00:00，
    小时桶也按本地整点切，避免"今天"从 UTC 日界(=本地早上 8 点)起算的历史偏差。
    """
    if granularity not in ("hour", "day", "week", "month"):
        raise ValueError(f"granularity 仅支持 hour/day/week/month，收到: {granularity}")

    trunc_unit = {"hour": "hour", "day": "day", "week": "week", "month": "month"}[granularity]
    tz_off = timedelta(minutes=int(tz_offset_min)) if tz_offset_min else timedelta(0)
    bucket_col = func.date_trunc(trunc_unit, TokenUsageDB.timestamp + tz_off).label("bucket")

    window = resolve_window(start_date, end_date, days, tz_offset_min=tz_offset_min)
    if tz_offset_min:
        from cost.time_window import local_bucket_starts

        starts = local_bucket_starts(granularity, window, tz_offset_min)
    else:
        starts = bucket_starts(granularity, window.start, window.end)

    stmt = _scope_usage(
        window,
        team_id,
        model,
        select(
            bucket_col,
            TokenUsageDB.model.label("model"),
            func.sum(TokenUsageDB.prompt_tokens).label("prompt_tokens"),
            func.sum(TokenUsageDB.completion_tokens).label("completion_tokens"),
            func.sum(TokenUsageDB.total_tokens).label("total_tokens"),
            func.sum(TokenUsageDB.cost_usd).label("cost_usd"),
            func.count(TokenUsageDB.id).label("calls"),
        ),
        user_id,
        node_id,
        key_id,
    )
    stmt = stmt.group_by(bucket_col, TokenUsageDB.model).order_by(bucket_col)

    result = await session.execute(stmt)
    rows = result.all()

    def _bucket_key(dt_val: datetime) -> str:
        return dt_val.strftime("%Y-%m-%dT%H:%M:%S") if granularity == "hour" else dt_val.date().isoformat()

    raw: dict[str, dict[str, Any]] = {}
    for r in rows:
        key = _bucket_key(r.bucket)
        bucket = raw.setdefault(
            key,
            {"day": key, "total_tokens": 0, "total_cost": 0.0, "calls": 0, "by_model": {}},
        )
        prompt = r.prompt_tokens or 0
        completion = r.completion_tokens or 0
        total = r.total_tokens or 0
        cost = float(r.cost_usd or 0)
        calls = r.calls or 0
        bucket["total_tokens"] += total
        bucket["total_cost"] += cost
        bucket["calls"] += calls
        bucket["by_model"][r.model] = {
            "prompt_tokens": prompt,
            "completion_tokens": completion,
            "total_tokens": total,
            "cost_usd": cost,
            "calls": calls,
        }

    ordered: list[dict[str, Any]] = []
    for probe in starts:
        key = _bucket_key(probe)
        if key in raw:
            ordered.append(raw[key])
        else:
            ordered.append(
                {"day": key, "total_tokens": 0, "total_cost": 0.0, "calls": 0, "by_model": {}}
            )
    return ordered
