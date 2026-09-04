"""成本/性能查询的时间窗口解析。

单一职责：将互斥的 ``start_date``/``end_date`` 与 ``days`` 输入
统一为一个绝对的、带时区的 ``TimeWindow``。

设计说明：
- 非法输入抛出 ``ValueError``；由路由层负责转换为 HTTP 错误。领域层
  绝不 import FastAPI（依赖倒置）。
- 保留 ``days`` 作为向后兼容的回退，使只发送 ``days`` 的既有调用方与
  前端版本无需改动即可继续工作。
- 所有 datetime 均为 UTC-aware，与 ``TokenUsageDB.timestamp``
  （``DateTime(timezone=True)``）一致，使每个 tracker 共享同一"现在"定义
  （此前 ``get_summary`` 用 naive ``utcnow()`` 而其它用 ``datetime.now(UTC)``）。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta, timezone
from typing import Any

MAX_SPAN_DAYS = 365
DEFAULT_DAYS = 7


@dataclass(frozen=True)
class TimeWindow:
    """绝对的、UTC-aware 查询窗口。``end`` 为闭区间。"""

    start: datetime
    end: datetime
    span_days: int


def _add_months(dt: datetime, months: int) -> datetime:
    month_index = dt.year * 12 + (dt.month - 1) + months
    year, month0 = divmod(month_index, 12)
    return dt.replace(year=year, month=month0 + 1, day=1)


def _start_of_day(dt: datetime) -> datetime:
    """UTC 当天 00:00:00。"""
    return datetime.combine(dt.date(), time.min, tzinfo=UTC)


def _start_of_week(dt: datetime) -> datetime:
    """返回 ``dt`` 所在 ISO 周的周一 00:00:00（PG date_trunc('week') 对齐）。"""
    monday = dt - timedelta(days=dt.weekday())
    return datetime.combine(monday.date(), time.min, tzinfo=UTC)


def bucket_starts(granularity: str, start: datetime, end: datetime) -> list[datetime]:
    """生成覆盖 ``[start, end]``（闭区间）的连续 UTC 桶起点序列（纯函数）。

    各 tracker（token/performance）共享同一桶定义，保证 X 轴与 DB ``date_trunc``
    的桶 key 一一对应。桶数上界由窗口跨度推导（+2 余量），结构上不可能静默截断；
    上界推导或步进异常时 fail-fast，绝不静默丢数据。
    """
    if granularity == "hour":
        probe = start.replace(minute=0, second=0, microsecond=0)
        step = timedelta(hours=1)
        max_buckets = int((end - probe).total_seconds() // 3600) + 2
    elif granularity == "day":
        probe = _start_of_day(start)
        step = timedelta(days=1)
        max_buckets = (end.date() - probe.date()).days + 2
    elif granularity == "week":
        probe = _start_of_week(start)
        step = timedelta(weeks=1)
        max_buckets = (end.date() - probe.date()).days // 7 + 2
    elif granularity == "month":
        probe = _add_months(_start_of_day(start), 0)
        step = None  # month 走 _add_months 步进
        max_buckets = (end.year - probe.year) * 12 + (end.month - probe.month) + 2
    else:
        raise ValueError(f"granularity 仅支持 hour/day/week/month，收到: {granularity}")

    starts: list[datetime] = []
    while probe < end:
        starts.append(probe)
        probe = _add_months(probe, 1) if granularity == "month" else probe + (step or timedelta(0))
        if len(starts) > max_buckets:
            raise RuntimeError(
                f"桶序列生成异常（granularity={granularity}, {start} ~ {end}）: "
                f"超出推导上界 {max_buckets}，拒绝静默截断"
            )
    return starts


def local_bucket_starts(
    granularity: str,
    window: TimeWindow,
    tz_offset_min: int,
) -> list[datetime]:
    """返回覆盖 ``window`` 的 NAIVE *本地墙钟* 桶起点序列。

    当提供用户时区偏移时由 tracker 使用。返回的 naive 时间戳保存本地墙钟值
    （如 ``2026-09-03T13:00:00`` 表示本地 13:00），并与
    ``date_trunc(unit, ts + tz_offset_min)`` 生成的 DB 桶标签（其*值*同样是本地
    墙钟）一致。hour/day/week/month 均对齐本地边界，使 X 轴不因偏移而漂移
    （历史仅 UTC 的缺陷）。
    """
    off = timedelta(minutes=int(tz_offset_min))
    # 将 UTC-aware 窗口转换为 naive 本地墙钟边界。
    s = (window.start + off).replace(tzinfo=None)
    e = (window.end + off).replace(tzinfo=None)

    if granularity == "hour":
        probe = s.replace(minute=0, second=0, microsecond=0)
        step = timedelta(hours=1)
        guard = int((e - s).total_seconds() // 3600) + 2
    elif granularity == "day":
        probe = datetime.combine(s.date(), time.min)
        step = timedelta(days=1)
        guard = (e.date() - s.date()).days + 2
    elif granularity == "week":
        probe = datetime.combine(s.date() - timedelta(days=s.weekday()), time.min)
        step = timedelta(weeks=1)
        guard = (e.date() - s.date()).days // 7 + 2
    elif granularity == "month":
        probe = datetime.combine(s.replace(day=1).date(), time.min)
        step = None
        guard = (e.year - s.year) * 12 + (e.month - s.month) + 2
    else:
        raise ValueError(f"granularity 仅支持 hour/day/week/month，收到: {granularity}")

    starts: list[datetime] = []
    while probe <= e:
        starts.append(probe)
        probe = _add_months(probe, 1) if step is None else probe + step
        if len(starts) > guard:
            raise RuntimeError(f"本地桶序列异常（granularity={granularity}）: 超出上界 {guard}")
    return starts


def resolve_window(
    start_date: date | None = None,
    end_date: date | None = None,
    days: int = DEFAULT_DAYS,
    tz_offset_min: int | None = None,
) -> TimeWindow:
    """从自定义日期解析查询窗口，回退到 ``days``。

    ``tz_offset_min``（相对 UTC 的分钟数，东为正，如 +8h → 480）使*日历日*边界
    落在用户本地午夜而非 UTC 午夜。省略时保留历史纯 UTC 行为（向后兼容既有调用方）。

    异常：
        ValueError: 区间只给了一半、倒置或过宽时。
    """
    if start_date is not None and end_date is not None:
        if start_date > end_date:
            raise ValueError("start_date 不能晚于 end_date")
        span_days = (end_date - start_date).days + 1
        if span_days > MAX_SPAN_DAYS:
            raise ValueError(f"查询区间不能超过 {MAX_SPAN_DAYS} 天")
        if tz_offset_min:
            tz = timezone(timedelta(minutes=int(tz_offset_min)))
            # 本地日界：start = 用户 local 00:00；end = 次日 day exclusive 转 UTC - 1us
            start_local = datetime.combine(start_date, time.min, tzinfo=tz)
            end_local = datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=tz)
            return TimeWindow(
                start=start_local.astimezone(UTC),
                end=end_local.astimezone(UTC) - timedelta(microseconds=1),
                span_days=span_days,
            )
        return TimeWindow(
            start=datetime.combine(start_date, time.min, tzinfo=UTC),
            end=datetime.combine(end_date, time.max, tzinfo=UTC),
            span_days=span_days,
        )

    if start_date is not None or end_date is not None:
        raise ValueError("start_date 与 end_date 必须同时提供")

    if days < 1 or days > MAX_SPAN_DAYS:
        raise ValueError(f"days 必须在 1 ~ {MAX_SPAN_DAYS} 之间")

    end = datetime.now(UTC)
    return TimeWindow(start=end - timedelta(days=days), end=end, span_days=days)


def apply_window(stmt: Any, column: Any, window: TimeWindow) -> Any:
    """将 SELECT 按 ``column`` 约束到 ``window``（两端均含）。"""
    return stmt.where(column >= window.start, column <= window.end)


def apply_scope(
    stmt: Any,
    window: TimeWindow,
    timestamp_column: Any,
    team_id: str | None = None,
    team_column: Any = None,
    model: str | None = None,
    model_column: Any = None,
    user_id: str | None = None,
    user_column: Any = None,
    node_id: str | None = None,
    node_column: Any = None,
    key_id: str | None = None,
    key_column: Any = None,
) -> Any:
    """将共享的 time/team/model/user/node/key 作用域应用到语句。

    把过滤条件组合集中一处，使每个 tracker 方法保持一致（DRY），而非各自重新
    推导谓词。额外维度是可选关键字参数，既有调用方无需改动即可继续工作
    （开闭原则）。
    """
    stmt = apply_window(stmt, timestamp_column, window)
    if team_id and team_column is not None:
        stmt = stmt.where(team_column == team_id)
    if model and model_column is not None:
        stmt = stmt.where(model_column == model)
    if user_id and user_column is not None:
        stmt = stmt.where(user_column == user_id)
    if node_id and node_column is not None:
        stmt = stmt.where(node_column == node_id)
    if key_id and key_column is not None:
        stmt = stmt.where(key_column == key_id)
    return stmt
