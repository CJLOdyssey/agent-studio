"""Tests for cost/summary.py — get_summary."""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.mark.asyncio
async def test_get_summary_empty():
    from cost.summary import get_summary

    mock_row = (0, 0.0, 0, 0, 0)
    mock_result = MagicMock()
    mock_result.one.return_value = mock_row
    mock_result.all.return_value = []

    mock_session = AsyncMock()
    mock_session.execute.return_value = mock_result

    result = await get_summary(
        session=mock_session,
        days=7,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 7),
    )
    assert isinstance(result, dict)
    assert "total_cost_usd" in result
    assert "total_tokens" in result
    assert "total_calls" in result
