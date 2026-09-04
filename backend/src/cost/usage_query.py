"""用量查询的作用域与排序辅助。

单一职责：集中管理共享的 time/team/model/user/node/key 作用域过滤，
以及服务端排序白名单解析，供 tracker 各查询方法复用（防止各端点逐渐偏离）。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from cost.time_window import TimeWindow, apply_scope
from orm.token_usage import TokenUsageDB


@dataclass(frozen=True)
class UsageHistoryPage:
    """一页用量历史行及其作用域下的总数。"""

    items: list[dict[str, Any]]
    total: int
    limit: int
    offset: int


# 使用历史排序白名单：列名 → ORM 列。前端排序下沉服务端后，
# order_by 是外部输入，必须走白名单映射（绝不字符串拼接进 order_by）。
USAGE_ORDER_COLUMNS = {
    "timestamp": "timestamp",
    "prompt_tokens": "prompt_tokens",
    "completion_tokens": "completion_tokens",
    "cost_usd": "cost_usd",
}


def resolve_usage_order(order_by: str, order_dir: str) -> tuple[Any, bool]:
    """校验并解析排序参数 → (ORM 列, 是否升序)。非法值 fail-fast（项目红线：不给隐式默认）。"""
    if order_by not in USAGE_ORDER_COLUMNS:
        raise ValueError(
            f"order_by 仅支持 {'/'.join(USAGE_ORDER_COLUMNS)}，收到: {order_by}"
        )
    if order_dir not in ("asc", "desc"):
        raise ValueError(f"order_dir 仅支持 asc/desc，收到: {order_dir}")
    column = getattr(TokenUsageDB, USAGE_ORDER_COLUMNS[order_by])
    return column, order_dir == "asc"


def _scope_usage(
    window: TimeWindow,
    team_id: str | None,
    model: str | None,
    stmt: Any,
    user_id: str | None = None,
    node_id: str | None = None,
    key_id: str | None = None,
) -> Any:
    """将共享的 time/team/model/user/node/key 作用域应用到 TokenUsageDB 语句。

    每个 tracker 方法用相同谓词过滤同一张表；集中管理可防止各端点逐渐偏离。
    """
    return apply_scope(
        stmt,
        window,
        TokenUsageDB.timestamp,
        team_id,
        TokenUsageDB.team_id,
        model,
        TokenUsageDB.model,
        user_id,
        TokenUsageDB.user_id,
        node_id,
        TokenUsageDB.node_id,
        key_id,
        TokenUsageDB.key_id,
    )
