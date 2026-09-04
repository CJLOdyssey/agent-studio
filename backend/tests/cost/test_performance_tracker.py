"""Tests for cost/performance_tracker.py — get_performance_tracker, _bucket_key."""

from datetime import date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from cost.performance_tracker import PerformanceTracker, _bucket_key, get_performance_tracker


# ---------------------------------------------------------------------------
# Pure function: _bucket_key
# ---------------------------------------------------------------------------


class TestBucketKey:
    def test_hour_granularity_returns_timestamp(self):
        dt = datetime(2025, 3, 15, 14, 30, 45)
        result = _bucket_key("hour", dt)
        assert result == "2025-03-15T14:30:45"

    def test_day_granularity_returns_date(self):
        dt = datetime(2025, 3, 15, 14, 30, 45)
        result = _bucket_key("day", dt)
        assert result == "2025-03-15"

    def test_week_granularity_returns_date(self):
        dt = datetime(2025, 3, 15, 10, 0, 0)
        result = _bucket_key("week", dt)
        assert result == "2025-03-15"

    def test_month_granularity_returns_date(self):
        dt = datetime(2025, 3, 15, 10, 0, 0)
        result = _bucket_key("month", dt)
        assert result == "2025-03-15"


# ---------------------------------------------------------------------------
# get_performance_tracker singleton
# ---------------------------------------------------------------------------


class TestGetPerformanceTracker:
    def test_returns_singleton(self):
        t1 = get_performance_tracker()
        t2 = get_performance_tracker()
        assert t1 is t2

    def test_returns_performance_tracker_instance(self):
        tracker = get_performance_tracker()
        assert isinstance(tracker, PerformanceTracker)


# ---------------------------------------------------------------------------
# PerformanceTracker.async methods (mocked DB)
# ---------------------------------------------------------------------------


class TestGetPerformanceSummary:
    @pytest.mark.asyncio
    async def test_empty_runs_returns_zeroed_summary(self):
        tracker = PerformanceTracker()
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("cost.performance_tracker.get_session_factory", return_value=mock_factory):
            with patch("cost.performance_tracker.apply_window", side_effect=lambda stmt, *a, **kw: stmt):
                with patch("cost.performance_tracker.resolve_window") as mock_resolve:
                    mock_resolve.return_value = MagicMock(span_days=30)
                    result = await tracker.get_performance_summary()

        assert result["total_calls"] == 0
        assert result["avg_response_time_s"] == 0
        assert result["avg_success_rate"] == 0

    @pytest.mark.asyncio
    async def test_with_runs_calculates_metrics(self):
        tracker = PerformanceTracker()

        now = datetime.now()
        mock_run_1 = MagicMock()
        mock_run_1.created_at = now - timedelta(seconds=10)
        mock_run_1.updated_at = now
        mock_run_1.status = "converged"

        mock_run_2 = MagicMock()
        mock_run_2.created_at = now - timedelta(seconds=20)
        mock_run_2.updated_at = now
        mock_run_2.status = "failed"

        mock_session = AsyncMock()

        # First call: runs query
        run_result = MagicMock()
        run_result.scalars.return_value.all.return_value = [mock_run_1, mock_run_2]

        # Second call: token query
        token_result = MagicMock()
        token_row = MagicMock()
        token_row.total_tokens = 1000
        token_row.total_calls = 2
        token_result.first.return_value = token_row

        mock_session.execute.side_effect = [run_result, token_result]

        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("cost.performance_tracker.get_session_factory", return_value=mock_factory):
            with patch("cost.performance_tracker.apply_window", side_effect=lambda stmt, *a, **kw: stmt):
                with patch("cost.performance_tracker.resolve_window") as mock_resolve:
                    mock_resolve.return_value = MagicMock(span_days=7)
                    result = await tracker.get_performance_summary()

        assert result["total_calls"] == 2
        assert result["avg_success_rate"] == 50.0
        assert result["avg_tokens_per_call"] == 500
        assert result["p50_response_time_s"] > 0
        assert result["p95_response_time_s"] > 0

    @pytest.mark.asyncio
    async def test_team_id_filters_tokens(self):
        tracker = PerformanceTracker()
        mock_session = AsyncMock()

        run_result = MagicMock()
        run_result.scalars.return_value.all.return_value = []

        token_result = MagicMock()
        token_row = MagicMock()
        token_row.total_tokens = None
        token_row.total_calls = None
        token_result.first.return_value = token_row

        mock_session.execute.side_effect = [run_result, token_result]

        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("cost.performance_tracker.get_session_factory", return_value=mock_factory):
            with patch("cost.performance_tracker.apply_window", side_effect=lambda stmt, *a, **kw: stmt):
                with patch("cost.performance_tracker.resolve_window") as mock_resolve:
                    mock_resolve.return_value = MagicMock(span_days=30)
                    result = await tracker.get_performance_summary(team_id="team_1")

        assert result["total_calls"] == 0
        assert result["avg_tokens_per_call"] == 0


class TestGetPerformanceTrend:
    @pytest.mark.asyncio
    async def test_invalid_granularity_raises(self):
        tracker = PerformanceTracker()
        with pytest.raises(ValueError, match="granularity"):
            await tracker.get_performance_trend(granularity="second")

    @pytest.mark.asyncio
    async def test_empty_trend_returns_empty_buckets(self):
        tracker = PerformanceTracker()
        mock_session = AsyncMock()

        # run query returns empty
        run_result = MagicMock()
        run_result.all.return_value = []

        # token query returns empty
        token_result = MagicMock()
        token_result.all.return_value = []

        # detail query returns empty
        detail_result = MagicMock()
        detail_result.all.return_value = []

        mock_session.execute.side_effect = [run_result, token_result, detail_result]

        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("cost.performance_tracker.get_session_factory", return_value=mock_factory):
            with patch("cost.performance_tracker.apply_window", side_effect=lambda stmt, *a, **kw: stmt):
                with patch("cost.performance_tracker.resolve_window") as mock_resolve:
                    mock_resolve.return_value = MagicMock(start=datetime(2025, 1, 1), end=datetime(2025, 1, 3))
                    with patch("cost.performance_tracker.bucket_starts", return_value=[
                        datetime(2025, 1, 1), datetime(2025, 1, 2), datetime(2025, 1, 3),
                    ]):
                        result = await tracker.get_performance_trend(
                            granularity="day", days=3
                        )

        assert "trend" in result
        assert len(result["trend"]) >= 1


class TestGetAgentRanking:
    @pytest.mark.asyncio
    async def test_empty_ranking(self):
        tracker = PerformanceTracker()
        mock_session = AsyncMock()
        rank_result = MagicMock()
        rank_result.all.return_value = []
        mock_session.execute.return_value = rank_result

        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("cost.performance_tracker.get_session_factory", return_value=mock_factory):
            with patch("cost.performance_tracker.apply_window", side_effect=lambda stmt, *a, **kw: stmt):
                with patch("cost.performance_tracker.resolve_window") as mock_resolve:
                    mock_resolve.return_value = MagicMock(span_days=30)
                    result = await tracker.get_agent_ranking()

        assert result["ranking"] == []

    @pytest.mark.asyncio
    async def test_ranking_with_data(self):
        tracker = PerformanceTracker()
        mock_session = AsyncMock()
        rank_result = MagicMock()
        row1 = MagicMock()
        row1.node_id = "agent_a"
        row1.calls = 10
        row1.total_tokens = 5000
        row1.total_cost = 0.5
        row2 = MagicMock()
        row2.node_id = "agent_b"
        row2.calls = 5
        row2.total_tokens = 2000
        row2.total_cost = 0.2
        rank_result.all.return_value = [row1, row2]
        mock_session.execute.return_value = rank_result

        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("cost.performance_tracker.get_session_factory", return_value=mock_factory):
            with patch("cost.performance_tracker.apply_window", side_effect=lambda stmt, *a, **kw: stmt):
                with patch("cost.performance_tracker.resolve_window") as mock_resolve:
                    mock_resolve.return_value = MagicMock(span_days=30)
                    result = await tracker.get_agent_ranking()

        assert len(result["ranking"]) == 2
        assert result["ranking"][0]["rank"] == 1
        assert result["ranking"][0]["node_id"] == "agent_a"
        assert result["ranking"][0]["avg_tokens"] == 500
