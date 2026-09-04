"""_bucket_starts 纯函数单测：桶对齐、连续补齐、长窗口不截断。

回归背景（get_daily_trend 旧实现的两个静默 bug）：
1. 补桶循环用 ``guard < 60`` 魔法数，窗口超过 60 桶时尾部真实数据被静默丢弃；
2. ``days`` 回退窗口 + ``hour`` 粒度时 probe 未对齐整点，与 DB ``date_trunc``
   的桶 key 全部错位，返回全空桶。
"""

from datetime import UTC, datetime, timedelta

import pytest

from cost.token_tracker import _bucket_starts

DAY_END = datetime(2026, 9, 3, 23, 59, 59, 999999, tzinfo=UTC)  # window.end 闭区间形态


class TestDayGranularity:
    def test_100_day_window_no_truncation(self):
        """回归：>60 桶的窗口不再被 guard 截断。"""
        start = datetime(2026, 1, 1, tzinfo=UTC)
        end = datetime(2026, 4, 10, 23, 59, 59, 999999, tzinfo=UTC)  # 100 天
        starts = _bucket_starts("day", start, end)
        assert len(starts) == 100
        assert starts[0] == datetime(2026, 1, 1, tzinfo=UTC)
        assert starts[-1] == datetime(2026, 4, 10, tzinfo=UTC)

    def test_max_span_365_days_continuous(self):
        """MAX_SPAN_DAYS 上界窗口：365 桶全量生成且严格连续。"""
        start = datetime(2025, 1, 1, tzinfo=UTC)
        end = datetime(2025, 12, 31, 23, 59, 59, 999999, tzinfo=UTC)
        starts = _bucket_starts("day", start, end)
        assert len(starts) == 365
        for prev, curr in zip(starts, starts[1:]):
            assert curr - prev == timedelta(days=1)

    def test_start_snaps_to_day_boundary(self):
        start = datetime(2026, 9, 3, 14, 23, 5, tzinfo=UTC)
        starts = _bucket_starts("day", start, DAY_END)
        assert starts == [datetime(2026, 9, 3, tzinfo=UTC)]

    def test_bucket_start_equal_to_end_excluded(self):
        """语义保持：probe < end（end 恰为整点时当日桶不含）。"""
        start = datetime(2026, 1, 1, tzinfo=UTC)
        end = datetime(2026, 1, 5, tzinfo=UTC)
        assert len(_bucket_starts("day", start, end)) == 4  # 01-01 ~ 01-04


class TestHourGranularity:
    def test_single_day_24_buckets_aligned(self):
        start = datetime(2026, 9, 3, tzinfo=UTC)
        starts = _bucket_starts("hour", start, DAY_END)
        assert len(starts) == 24
        assert all(s.minute == 0 and s.second == 0 and s.microsecond == 0 for s in starts)
        assert starts[0] == datetime(2026, 9, 3, 0, tzinfo=UTC)
        assert starts[-1] == datetime(2026, 9, 3, 23, tzinfo=UTC)

    def test_non_aligned_start_snaps_to_hour(self):
        """回归：非整点起点（days 回退窗口）必须对齐整点，否则 DB 桶 key 全 miss。"""
        start = datetime(2026, 9, 3, 14, 23, 5, tzinfo=UTC)
        end = datetime(2026, 9, 4, 9, 10, tzinfo=UTC)
        starts = _bucket_starts("hour", start, end)
        assert starts[0] == datetime(2026, 9, 3, 14, tzinfo=UTC)
        assert len(starts) == 20  # 03 日 14:00~23:00 + 04 日 00:00~09:00


class TestWeekGranularity:
    def test_spans_two_iso_weeks_aligned_to_monday(self):
        start = datetime(2026, 9, 2, tzinfo=UTC)  # 周三
        end = datetime(2026, 9, 8, 23, 59, 59, 999999, tzinfo=UTC)  # 下周二
        starts = _bucket_starts("week", start, end)
        assert starts[0] == datetime(2026, 8, 31, tzinfo=UTC)  # 周一
        assert [s.strftime("%Y-%m-%d") for s in starts] == ["2026-08-31", "2026-09-07"]


class TestMonthGranularity:
    def test_cross_month_first_of_each(self):
        start = datetime(2026, 1, 15, tzinfo=UTC)
        end = datetime(2026, 3, 15, 23, 59, 59, 999999, tzinfo=UTC)
        starts = _bucket_starts("month", start, end)
        assert [s.strftime("%Y-%m-%d") for s in starts] == ["2026-01-01", "2026-02-01", "2026-03-01"]

    def test_single_month(self):
        start = datetime(2026, 7, 4, tzinfo=UTC)
        end = datetime(2026, 7, 31, 23, 59, 59, 999999, tzinfo=UTC)
        assert len(_bucket_starts("month", start, end)) == 1

    def test_year_boundary_no_overflow(self):
        start = datetime(2026, 11, 20, tzinfo=UTC)
        end = datetime(2027, 1, 10, 23, 59, 59, 999999, tzinfo=UTC)
        starts = _bucket_starts("month", start, end)
        assert [s.strftime("%Y-%m") for s in starts] == ["2026-11", "2026-12", "2027-01"]


class TestInvalidGranularity:
    def test_unknown_granularity_raises(self):
        with pytest.raises(ValueError, match="granularity"):
            _bucket_starts("year", datetime(2026, 1, 1, tzinfo=UTC), datetime(2026, 2, 1, tzinfo=UTC))
