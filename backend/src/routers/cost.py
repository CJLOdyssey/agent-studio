"""成本追踪 API 端点。

查询窗口契约（所有端点共享）：
  - 同时提供 ``start_date`` + ``end_date`` 时二者优先。
  - ``days`` 保留作为向后兼容的回退。
  - 非法窗口由 :func:`_window_or_422` 以 422 拒绝。
"""

from datetime import date
from typing import Annotated, Any

from cost.performance_tracker import get_performance_tracker
from cost.token_tracker import get_token_tracker
from fastapi import APIRouter, Depends, HTTPException, Query

from auth.auth_middleware import get_current_user

from .cost_schemas import (
    BudgetUpdate,
    _load_budget,
    _save_budget,
    _window_or_422,
)

router = APIRouter(prefix="/api/cost", tags=["cost"])


# ── 共享查询参数 ───────────────────────────────────────────
# 声明一次，使每个端点保持一致（DRY）。

# Annotated 别名使窗口契约在各端点间保持一致，而无需在参数间
# 共享单个可变 Query 实例。
StartParam = Annotated[date | None, Query(description="Start date (YYYY-MM-DD), inclusive")]
EndParam = Annotated[date | None, Query(description="End date (YYYY-MM-DD), inclusive")]
DaysParam = Annotated[
    int, Query(ge=1, le=365, description="Fallback period when no custom range is given")
]
ModelParam = Annotated[str | None, Query(description="Model name (optional)")]
UserParam = Annotated[str | None, Query(description="User ID (optional)")]
NodeParam = Annotated[str | None, Query(description="Workflow node ID (optional)")]
KeyParam = Annotated[str | None, Query(description="API key ID (user_api_keys.id, optional)")]
SearchParam = Annotated[
    str | None,
    Query(max_length=200, description="Fuzzy-match run_id / model (case-insensitive)"),
]
OrderByParam = Annotated[
    str, Query(pattern="^(timestamp|prompt_tokens|completion_tokens|cost_usd)$", description="Sort column")
]
OrderDirParam = Annotated[str, Query(pattern="^(asc|desc)$", description="Sort direction")]


@router.get("/token-usage")
async def get_token_usage(
    run_id: str = Query(..., description="Run ID to get token usage for"),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """获取特定 run 的 token 用量详情。"""
    tracker = get_token_tracker()
    usages = await tracker.get_usage_by_run(run_id)

    total_tokens = sum(u["total_tokens"] for u in usages)
    total_cost = sum(u["cost_usd"] for u in usages)

    return {
        "run_id": run_id,
        "total_tokens": total_tokens,
        "total_cost_usd": total_cost,
        "usages": usages,
    }


@router.get("/summary")
async def get_cost_summary(
    team_id: str | None = Query(None, description="Team ID (optional)"),
    days: DaysParam = 7,
    start_date: StartParam = None,
    end_date: EndParam = None,
    model: ModelParam = None,
    user_id: UserParam = None,
    node_id: NodeParam = None,
    key_id: KeyParam = None,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """获取某团队或所有团队的 token 用量汇总。"""
    window = _window_or_422(start_date, end_date, days)
    tracker = get_token_tracker()
    summary = await tracker.get_summary(
        team_id=team_id,
        start_date=window.start.date(),
        end_date=window.end.date(),
        model=model,
        user_id=user_id,
        node_id=node_id,
        key_id=key_id,
    )
    return summary


@router.get("/models")
async def get_model_pricing(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """获取可用模型及其定价。"""
    from cost.token_tracker import list_pricing

    pricing_table = list_pricing()
    models = [
        {
            "model": model_name,
            "prompt_cost_per_1k": p["prompt"],
            "completion_cost_per_1k": p["completion"],
            "effective_from": p["effective_from"],
        }
        for model_name, p in pricing_table.items()
    ]

    return {"models": models}


@router.get("/budget")
async def get_budget(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """获取当前预算配置与支出状态。

    `daily_spend`/`monthly_spend` 用真正的日窗（今天 00:00→now）与自然月窗
    （本月 1 号→now），不再用 days=1/30 的滚动窗口冒充。
    """
    budget = _load_budget()
    tracker = get_token_tracker()

    windows = await tracker.get_spend_windows()
    daily_spend = windows["today_spend"]
    monthly_spend = windows["month_spend"]
    daily_limit = budget.get("daily_limit", 0.0)
    monthly_limit = budget.get("monthly_limit", 0.0)

    return {
        "daily_limit": daily_limit,
        "monthly_limit": monthly_limit,
        "daily_spend": daily_spend,
        "monthly_spend": monthly_spend,
        "daily_exceeded": daily_limit > 0 and daily_spend > daily_limit,
        "monthly_exceeded": monthly_limit > 0 and monthly_spend > monthly_limit,
        "daily_percent": round(daily_spend / daily_limit * 100, 1) if daily_limit > 0 else 0,
        "monthly_percent": round(monthly_spend / monthly_limit * 100, 1) if monthly_limit > 0 else 0,
    }


@router.put("/budget")
async def update_budget(
    body: BudgetUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """更新预算上限。"""
    _save_budget({"daily_limit": body.daily_limit, "monthly_limit": body.monthly_limit})
    return {"status": "ok", "daily_limit": body.daily_limit, "monthly_limit": body.monthly_limit}


@router.get("/daily-trend")
async def get_daily_trend(
    team_id: str | None = Query(None, description="Team ID (optional)"),
    days: DaysParam = 7,
    model: ModelParam = None,
    start_date: StartParam = None,
    end_date: EndParam = None,
    granularity: str = Query("day", pattern="^(hour|day|week|month)$", description="聚合粒度"),
    user_id: UserParam = None,
    node_id: NodeParam = None,
    key_id: KeyParam = None,
    tz_offset_min: int | None = Query(None, description="用户时区偏移(分钟，东为正)；有值时日历日/小时桶按本地对齐"),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """获取按日/周/月分桶的成本趋势。

    范围与粒度正交：窗口始终由 start_date/end_date（或 days）决定，
    granularity 只在窗口内决定桶宽，不改变查询范围。tz_offset_min 让"今天"从用户
    本地 00:00 起、小时桶按本地整点切，避免 UTC 日界把轴平移出用户的一天。
    """
    _window_or_422(start_date, end_date, days)  # 仅校验跨度合法性
    tracker = get_token_tracker()
    trend = await tracker.get_daily_trend(
        team_id=team_id,
        model=model,
        days=days,
        start_date=start_date,
        end_date=end_date,
        granularity=granularity,
        user_id=user_id,
        node_id=node_id,
        key_id=key_id,
        tz_offset_min=tz_offset_min,
    )
    return {"trend": trend}


@router.get("/usage-history")
async def get_usage_history(
    team_id: str | None = Query(None, description="Team ID (optional)"),
    days: DaysParam = 7,
    model: ModelParam = None,
    limit: int = Query(50, ge=1, le=200, description="Max rows"),
    offset: int = Query(0, ge=0, description="Offset"),
    start_date: StartParam = None,
    end_date: EndParam = None,
    search: SearchParam = None,
    order_by: OrderByParam = "timestamp",
    order_dir: OrderDirParam = "desc",
    user_id: UserParam = None,
    node_id: NodeParam = None,
    key_id: KeyParam = None,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """获取请求级用量历史及用于分页的作用域总数。"""
    window = _window_or_422(start_date, end_date, days)
    tracker = get_token_tracker()
    try:
        page = await tracker.get_usage_history_page(
            team_id=team_id,
            model=model,
            limit=limit,
            offset=offset,
            start_date=window.start.date(),
            end_date=window.end.date(),
            search=search,
            order_by=order_by,
            order_dir=order_dir,
            user_id=user_id,
            node_id=node_id,
            key_id=key_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        "history": page.items,
        "total": page.total,
        "limit": page.limit,
        "offset": page.offset,
    }


@router.get("/usage-history/export")
async def export_usage_history(
    team_id: str | None = Query(None, description="Team ID (optional)"),
    days: DaysParam = 7,
    model: ModelParam = None,
    start_date: StartParam = None,
    end_date: EndParam = None,
    search: SearchParam = None,
    user_id: UserParam = None,
    node_id: NodeParam = None,
    key_id: KeyParam = None,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """导出当前作用域（+搜索）的完整（不分页）用量历史。"""
    window = _window_or_422(start_date, end_date, days)
    tracker = get_token_tracker()
    page = await tracker.get_usage_history_page(
        team_id=team_id,
        model=model,
        limit=100_000,
        offset=0,
        start_date=window.start.date(),
        end_date=window.end.date(),
        search=search,
        user_id=user_id,
        node_id=node_id,
        key_id=key_id,
    )
    return {"history": page.items, "total": page.total}


@router.get("/attribution")
async def get_cost_attribution(
    team_id: str | None = Query(None, description="Team ID (optional)"),
    days: DaysParam = 7,
    model: ModelParam = None,
    start_date: StartParam = None,
    end_date: EndParam = None,
    user_id: UserParam = None,
    node_id: NodeParam = None,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """跨可配置维度获取成本归因。

    响应结构（DRY 稳定，客户端可统一遍历）：

    ``total_cost`` 为所有维度共享的全局分母（LSP：切换维度可得到可比百分比）；
    ``unattributed_cost`` 与 ``unattributed_ratio`` 用于质量横幅（SRP：归因方法
    拥有作用域 + 总数，视图层渲染横幅）。

    维度：``by_team`` / ``by_node`` / ``by_model`` / ``by_user``。
    新增维度只需在 :class:`DimensionSpec` 中加一条目。
    """
    window = _window_or_422(start_date, end_date, days)
    tracker = get_token_tracker()
    attribution = await tracker.get_cost_attribution(
        team_id=team_id,
        model=model,
        start_date=window.start.date(),
        end_date=window.end.date(),
        user_id=user_id,
        node_id=node_id,
    )
    return attribution


@router.get("/attribution/export")
async def export_cost_attribution(
    team_id: str | None = Query(None, description="Team ID (optional)"),
    days: DaysParam = 7,
    model: ModelParam = None,
    start_date: StartParam = None,
    end_date: EndParam = None,
    user_id: UserParam = None,
    node_id: NodeParam = None,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """导出归因全量（与归因表同口径）——前端 CSV 序列化所需。"""
    window = _window_or_422(start_date, end_date, days)
    tracker = get_token_tracker()
    attribution = await tracker.get_cost_attribution(
        team_id=team_id,
        model=model,
        start_date=window.start.date(),
        end_date=window.end.date(),
        user_id=user_id,
        node_id=node_id,
    )
    return attribution


@router.get("/performance/summary")
async def get_performance_summary(
    team_id: str | None = Query(None, description="Team ID (optional)"),
    days: DaysParam = 7,
    start_date: StartParam = None,
    end_date: EndParam = None,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """获取整体性能汇总。"""
    window = _window_or_422(start_date, end_date, days)
    tracker = get_performance_tracker()
    summary = await tracker.get_performance_summary(
        team_id=team_id,
        start_date=window.start.date(),
        end_date=window.end.date(),
    )
    return summary


@router.get("/performance/trend")
async def get_performance_trend(
    team_id: str | None = Query(None, description="Team ID (optional)"),
    days: DaysParam = 7,
    start_date: StartParam = None,
    end_date: EndParam = None,
    granularity: str = Query("day", pattern="^(hour|day|week|month)$", description="聚合粒度"),
    tz_offset_min: int | None = Query(None, description="用户时区偏移(分钟，东为正)；有值时日历日/小时桶按本地对齐"),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """性能趋势。窗口 + 桶宽（granularity）由调用方显式给定，前端"今天/昨天"自动选
    hour 而非硬编码 day，否则单天区间只会得到 1 个数据点（历史缺陷）。tz_offset_min
    使"今天"从用户本地 00:00 起、按本地整点切桶。"""
    _window_or_422(start_date, end_date, days)  # 仅校验跨度合法性
    tracker = get_performance_tracker()
    trend = await tracker.get_performance_trend(
        team_id=team_id,
        days=days,
        start_date=start_date,
        end_date=end_date,
        granularity=granularity,
        tz_offset_min=tz_offset_min,
    )
    return trend


@router.get("/performance/ranking")
async def get_agent_ranking(
    team_id: str | None = Query(None, description="Team ID (optional)"),
    days: DaysParam = 7,
    start_date: StartParam = None,
    end_date: EndParam = None,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """获取 agent/节点性能排名。"""
    window = _window_or_422(start_date, end_date, days)
    tracker = get_performance_tracker()
    ranking = await tracker.get_agent_ranking(
        team_id=team_id,
        start_date=window.start.date(),
        end_date=window.end.date(),
    )
    return ranking
