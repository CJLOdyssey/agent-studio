"""Tests for cost/trend.py — get_daily_trend."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_get_daily_trend_invalid_granularity():
    from cost.trend import get_daily_trend

    with pytest.raises(ValueError, match="granularity"):
        await get_daily_trend(session=AsyncMock(), granularity="bad")


@pytest.mark.asyncio
async def test_get_daily_trend_empty_result():
    from cost.trend import get_daily_trend

    mock_session = AsyncMock()
    mock_session.execute.return_value = SimpleNamespace(all=lambda: [])

    result = await get_daily_trend(
        session=mock_session,
        days=3,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 3),
    )
    assert isinstance(result, list)
    assert len(result) >= 1
    for bucket in result:
        assert "day" in bucket
        assert "total_tokens" in bucket
        assert "total_cost" in bucket
        assert "by_model" in bucket


@pytest.mark.asyncio
async def test_get_daily_trend_with_data():
    from cost.trend import get_daily_trend

    row = SimpleNamespace(
        bucket=datetime(2026, 1, 1, 0, 0, 0),
        model="gpt-4",
        prompt_tokens=100,
        completion_tokens=50,
        total_tokens=150,
        cost_usd=0.5,
        calls=3,
    )
    mock_session = AsyncMock()
    mock_session.execute.return_value = SimpleNamespace(all=lambda: [row])

    result = await get_daily_trend(
        session=mock_session,
        days=1,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 1),
    )
    assert len(result) >= 1
    bucket = result[0]
    assert bucket["total_tokens"] == 150
    assert bucket["total_cost"] == 0.5
    assert bucket["calls"] == 3
    assert "gpt-4" in bucket["by_model"]


@pytest.mark.asyncio
async def test_get_daily_trend_with_tz_offset():
    from cost.trend import get_daily_trend

    mock_session = AsyncMock()
    mock_session.execute.return_value = SimpleNamespace(all=lambda: [])

    result = await get_daily_trend(
        session=mock_session,
        days=1,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 1),
        tz_offset_min=480,
    )
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_get_daily_trend_hour_granularity():
    from cost.trend import get_daily_trend

    mock_session = AsyncMock()
    mock_session.execute.return_value = SimpleNamespace(all=lambda: [])

    result = await get_daily_trend(
        session=mock_session,
        days=1,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 1),
        granularity="hour",
    )
    assert isinstance(result, list)
    for bucket in result:
        assert "T" in bucket["day"]
