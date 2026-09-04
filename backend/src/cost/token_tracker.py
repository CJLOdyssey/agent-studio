"""Token 用量追踪与成本计算。

定价表遵循 PostHog 风格的生产实践：
  - 用 effective_from 日期做版本化
  - 单一事实来源（不内联费率）
  - 未知模型 fail-loud（不静默回退）
  - 可通过 MODEL_PRICING_JSON 环境变量覆盖
"""

from __future__ import annotations

from datetime import UTC, date, datetime, time
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select

from core.infra.database import get_session_factory
from core.infra.logging_config import get_logger
from cost.pricing import (
    ModelPrice,
    calculate_cost,
    get_model_pricing,
    list_pricing,
)
from cost.time_window import (
    DEFAULT_DAYS,
    bucket_starts,
    resolve_window,
)
from orm.token_usage import TokenUsageDB

logger = get_logger(__name__)

# 向后兼容：pricing 模块拆分后，保留旧导入路径。
__all__ = [
    "ModelPrice",
    "calculate_cost",
    "get_model_pricing",
    "list_pricing",
]


# 向后兼容：桶函数已迁移到 time_window，保留旧导入路径。
_bucket_starts = bucket_starts


# ── 从 attribution / usage_query 拆分的归因与作用域辅助 ──
# re-export 保持向后兼容（外部仍可从 cost.token_tracker 导入）。
from cost.attribution import (  # noqa: F401
    DimensionSpec,
    _aggregate_attribution_dimension,
    _apply_label_map,
    _resolve_id_to_name,
)
from cost.usage_query import (  # noqa: F401
    USAGE_ORDER_COLUMNS,
    UsageHistoryPage,
    _scope_usage,
    resolve_usage_order,
)

# ── TokenTracker 类 ──────────────────────────────────────────────────

class TokenTracker:
    """追踪工作流执行的 token 用量与成本。"""

    async def record_usage(
        self,
        run_id: str,
        node_id: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        team_id: str | None = None,
        user_id: str | None = None,
        key_id: str | None = None,
    ) -> None:
        """记录某工作流节点执行的 token 用量。"""
        total_tokens = prompt_tokens + completion_tokens
        try:
            cost_usd = calculate_cost(model, prompt_tokens, completion_tokens)
        except ValueError as exc:
            logger.warning("Cost calculation skipped: %s", exc)
            cost_usd = 0.0

        factory = get_session_factory()
        async with factory() as session:
            usage = TokenUsageDB(
                id=str(uuid4()),
                run_id=run_id,
                node_id=node_id,
                team_id=team_id,
                user_id=user_id,
                key_id=key_id,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                cost_usd=cost_usd,
            )
            session.add(usage)
            await session.commit()

        logger.debug(
            "Recorded token usage: run=%s, node=%s, "
            "model=%s, tokens=%d, cost=$%.6f",
            run_id, node_id, model, total_tokens, cost_usd,
        )

    async def get_usage_by_run(self, run_id: str) -> list[dict[str, Any]]:
        """获取某 run 的 token 用量。"""
        factory = get_session_factory()
        async with factory() as session:
            stmt = (
                select(TokenUsageDB)
                .where(TokenUsageDB.run_id == run_id)
                .order_by(TokenUsageDB.timestamp)
            )
            result = await session.execute(stmt)
            usages = result.scalars().all()

            return [
                {
                    "id": u.id,
                    "run_id": u.run_id,
                    "node_id": u.node_id,
                    "model": u.model,
                    "prompt_tokens": u.prompt_tokens,
                    "completion_tokens": u.completion_tokens,
                    "total_tokens": u.total_tokens,
                    "cost_usd": u.cost_usd,
                    "timestamp": u.timestamp.isoformat(),
                }
                for u in usages
            ]

    async def get_cost_by_runs(self, run_ids: list[str]) -> dict[str, float]:
        """批量获取多个 run 的总 cost_usd。返回 {run_id: cost}。"""
        if not run_ids:
            return {}
        factory = get_session_factory()
        async with factory() as session:
            stmt = (
                select(
                    TokenUsageDB.run_id,
                    func.sum(TokenUsageDB.cost_usd).label("total_cost"),
                )
                .where(TokenUsageDB.run_id.in_(run_ids))
                .group_by(TokenUsageDB.run_id)
            )
            result = await session.execute(stmt)
            return {row.run_id: float(row.total_cost or 0) for row in result.all()}

    async def get_summary(
        self,
        team_id: str | None = None,
        days: int = DEFAULT_DAYS,
        start_date: date | None = None,
        end_date: date | None = None,
        model: str | None = None,
        user_id: str | None = None,
        node_id: str | None = None,
        key_id: str | None = None,
    ) -> dict[str, Any]:
        """获取某 team 或所有 team 的 token 用量摘要。委托给 cost.summary 模块。"""
        from cost.summary import get_summary as _impl

        factory = get_session_factory()
        async with factory() as session:
            return await _impl(
                session=session,
                team_id=team_id,
                days=days,
                start_date=start_date,
                end_date=end_date,
                model=model,
                user_id=user_id,
                node_id=node_id,
                key_id=key_id,
            )

    async def get_spend_windows(
        self,
        team_id: str | None = None,
    ) -> dict[str, float]:
        """返回预算管理所需的两个统计口径花费（USD）。

        预算语义必须与"限额"对齐，不能是滑动窗口：
          - today_spend: 今天 00:00（UTC）到现在的累计
          - month_spend: 当前自然月 1 号 00:00 到现在的累计
        以前实现用 `days=1` / `days=30` 滚动窗口冒充日/月预算，
        在跨日/跨月边界会产生错误（1 号看到的"本月支出"混入上月尾巴）。

        两值均从同一作用域集合计算，因此始终满足 daily <= month
        （单日支出不可能超过当月）。
        """
        now = datetime.now(UTC)
        today_start = datetime.combine(now.date(), time.min, tzinfo=UTC)
        month_start = datetime.combine(
            now.date().replace(day=1), time.min, tzinfo=UTC
        )

        factory = get_session_factory()
        async with factory() as session:
            sum_expr = func.coalesce(func.sum(TokenUsageDB.cost_usd), 0.0)

            async def _window_total(start: datetime) -> float:
                stmt = select(sum_expr).where(
                    TokenUsageDB.timestamp >= start,
                    TokenUsageDB.timestamp <= now,
                )
                if team_id:
                    stmt = stmt.where(TokenUsageDB.team_id == team_id)
                result = await session.execute(stmt)
                return float(result.scalar_one() or 0.0)

            return {
                "today_spend": await _window_total(today_start),
                "month_spend": await _window_total(month_start),
            }

    async def get_daily_trend(
        self,
        team_id: str | None = None,
        days: int = DEFAULT_DAYS,
        model: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        granularity: str = "day",
        user_id: str | None = None,
        node_id: str | None = None,
        key_id: str | None = None,
        tz_offset_min: int | None = None,
    ) -> list[dict[str, Any]]:
        """按时间粒度返回成本趋势。委托给 cost.trend 模块。"""
        from cost.trend import get_daily_trend as _impl

        factory = get_session_factory()
        async with factory() as session:
            return await _impl(
                session=session,
                team_id=team_id,
                days=days,
                model=model,
                start_date=start_date,
                end_date=end_date,
                granularity=granularity,
                user_id=user_id,
                node_id=node_id,
                key_id=key_id,
                tz_offset_min=tz_offset_min,
            )

    async def get_cost_attribution(
        self,
        team_id: str | None = None,
        days: int = DEFAULT_DAYS,
        start_date: date | None = None,
        end_date: date | None = None,
        model: str | None = None,
        user_id: str | None = None,
        node_id: str | None = None,
    ) -> dict[str, Any]:
        """跨维度成本归因。委托给 cost.attribution_report 模块。"""
        from cost.attribution_report import get_cost_attribution as _impl

        factory = get_session_factory()
        async with factory() as session:
            return await _impl(
                session=session,
                team_id=team_id,
                days=days,
                start_date=start_date,
                end_date=end_date,
                model=model,
                user_id=user_id,
                node_id=node_id,
            )


    async def get_usage_history_page(
        self,
        team_id: str | None = None,
        days: int = DEFAULT_DAYS,
        model: str | None = None,
        limit: int = 50,
        offset: int = 0,
        start_date: date | None = None,
        end_date: date | None = None,
        search: str | None = None,
        order_by: str = "timestamp",
        order_dir: str = "desc",
        user_id: str | None = None,
        node_id: str | None = None,
        key_id: str | None = None,
    ) -> UsageHistoryPage:
        """获取一页请求级用量历史及总行数。

        ``total`` 在与页面本身相同的作用域（time/team/model/user/node/key/search）
        下计数，这正是前端做真实服务端分页所需的。

        ``search`` 模糊匹配 run_id / model（大小写不敏感）；排序参数经
        :func:`resolve_usage_order` 白名单校验，非法值抛 ValueError。
        """
        window = resolve_window(start_date, end_date, days)
        order_col, is_asc = resolve_usage_order(order_by, order_dir)
        factory = get_session_factory()
        async with factory() as session:
            scoped = _scope_usage(window, team_id, model, select(TokenUsageDB), user_id, node_id, key_id)
            if search:
                pattern = f"%{search.strip()}%"
                scoped = scoped.where(
                    TokenUsageDB.run_id.ilike(pattern)
                    | TokenUsageDB.model.ilike(pattern)
                )

            total_result = await session.execute(
                select(func.count()).select_from(scoped.subquery())
            )
            total = int(total_result.scalar() or 0)

            stmt = (
                scoped.order_by(order_col.desc() if not is_asc else order_col.asc())
                .limit(limit)
                .offset(offset)
            )

            result = await session.execute(stmt)
            usages = result.scalars().all()

            items = [
                {
                    # 保留完整时间戳（含时刻），前端自行决定展示粒度。
                    # 只回 %Y-%m-%d 会丢失时刻，导致表格所有行"同秒"的假象。
                    "date": u.timestamp.isoformat(),
                    "timestamp": u.timestamp.isoformat(),
                    "model": u.model,
                    "prompt_tokens": u.prompt_tokens,
                    "completion_tokens": u.completion_tokens,
                    "total_tokens": u.total_tokens,
                    "cost_usd": u.cost_usd,
                    "unpriced": get_model_pricing(u.model) is None,
                    "run_id": u.run_id,
                    "node_id": u.node_id,
                    "key_id": u.key_id,
                }
                for u in usages
            ]

            return UsageHistoryPage(items=items, total=total, limit=limit, offset=offset)

    async def get_usage_history(
        self,
        team_id: str | None = None,
        days: int = DEFAULT_DAYS,
        model: str | None = None,
        limit: int = 50,
        offset: int = 0,
        start_date: date | None = None,
        end_date: date | None = None,
        user_id: str | None = None,
        node_id: str | None = None,
        key_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """获取请求级用量历史（date, model, input, output, cost, run）。

        作为 :meth:`get_usage_history_page` 的薄封装保留，使只需行的既有调用方
        无需改动即可继续工作（开闭原则）。
        """
        page = await self.get_usage_history_page(
            team_id=team_id,
            days=days,
            model=model,
            limit=limit,
            offset=offset,
            start_date=start_date,
            end_date=end_date,
            user_id=user_id,
            node_id=node_id,
            key_id=key_id,
        )
        return page.items


# 单例
_token_tracker: TokenTracker | None = None


def get_token_tracker() -> TokenTracker:
    """获取 token 追踪器单例。"""
    global _token_tracker
    if _token_tracker is None:
        _token_tracker = TokenTracker()
    return _token_tracker
