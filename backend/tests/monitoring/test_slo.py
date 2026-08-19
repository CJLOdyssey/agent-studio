"""Tests for monitoring.slo — error budget over a rolling window."""

import pytest
from monitoring.slo import SLOService

from orm.session import ProjectRun

from .conftest import make_run


async def _insert(db, model, rows):
    async with db() as session:
        for row in rows:
            session.add(model(**row))
        await session.commit()


@pytest.mark.asyncio
async def test_sli_and_budget(db):
    await _insert(
        db, ProjectRun, [make_run(status="converged") for _ in range(7)] + [make_run(status="error") for _ in range(3)]
    )

    snap = await SLOService().calculate(target_percent=95.0, window_seconds=86400)

    assert snap["total_requests"] == 10
    assert snap["error_count"] == 3
    assert snap["sli_percent"] == pytest.approx(70.0)
    assert snap["budget_remaining_percent"] == pytest.approx(-25.0)
    assert snap["burn_rate"] == pytest.approx(6.0)


@pytest.mark.asyncio
async def test_empty_window_is_full_sli(db):
    snap = await SLOService().calculate(target_percent=95.0, window_seconds=86400)
    assert snap["total_requests"] == 0
    assert snap["sli_percent"] == 100.0
    assert snap["burn_rate"] == 0.0


@pytest.mark.asyncio
async def test_old_runs_excluded_from_window(db):
    from datetime import UTC, datetime, timedelta

    old = datetime.now(UTC) - timedelta(days=2)
    await _insert(
        db,
        ProjectRun,
        [
            make_run(status="error", created_at=old),
            make_run(status="converged"),
        ],
    )

    snap = await SLOService().calculate(target_percent=95.0, window_seconds=86400)

    assert snap["total_requests"] == 1
    assert snap["error_count"] == 0
    assert snap["sli_percent"] == 100.0
