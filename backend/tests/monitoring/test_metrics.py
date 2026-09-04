"""Tests for monitoring.metrics — metric queries over run/token data."""

from datetime import UTC, datetime, timedelta

import pytest
from monitoring.metrics import MetricService, supported_metrics

from orm.session import ProjectRun
from orm.token_usage import TokenUsageDB

from .conftest import make_run, make_token_usage


async def _insert(db, model, rows):
    async with db() as session:
        for row in rows:
            session.add(model(**row))
        await session.commit()


@pytest.mark.asyncio
async def test_supported_metrics_include_core_five():
    names = supported_metrics()
    for expected in ("success_rate", "p95_latency", "avg_latency", "daily_cost", "error_count"):
        assert expected in names


@pytest.mark.asyncio
async def test_success_rate_with_no_runs_returns_none(db):
    svc = MetricService()
    assert await svc.get("success_rate", 3600) is None


@pytest.mark.asyncio
async def test_success_rate_mixed_statuses(db):
    await _insert(
        db,
        ProjectRun,
        [
            make_run(status="converged"),
            make_run(status="converged"),
            make_run(status="error"),
        ],
    )
    value = await MetricService().get("success_rate", 3600)
    assert value == pytest.approx(66.67, abs=0.1)


@pytest.mark.asyncio
async def test_success_rate_excludes_old_runs(db):
    old = datetime.now(UTC) - timedelta(hours=2)
    await _insert(
        db,
        ProjectRun,
        [
            make_run(status="error", created_at=old),
            make_run(status="converged"),
        ],
    )
    value = await MetricService().get("success_rate", 3600)
    assert value == pytest.approx(100.0)


@pytest.mark.asyncio
async def test_p95_latency_orders_durations(db):
    await _insert(
        db,
        ProjectRun,
        [
            make_run(duration_s=1.0),
            make_run(duration_s=2.0),
            make_run(duration_s=3.0),
            make_run(duration_s=4.0),
            make_run(duration_s=5.0),
        ],
    )
    value = await MetricService().get("p95_latency", 3600)
    assert value == pytest.approx(5.0)


@pytest.mark.asyncio
async def test_avg_latency(db):
    await _insert(
        db,
        ProjectRun,
        [
            make_run(duration_s=1.0),
            make_run(duration_s=3.0),
        ],
    )
    value = await MetricService().get("avg_latency", 3600)
    assert value == pytest.approx(2.0)


@pytest.mark.asyncio
async def test_daily_cost_sums_window(db):
    now = datetime.now(UTC)
    await _insert(
        db,
        TokenUsageDB,
        [
            make_token_usage(cost_usd=1.5, timestamp=now),
            make_token_usage(cost_usd=2.5, timestamp=now - timedelta(minutes=5)),
            make_token_usage(cost_usd=99.0, timestamp=now - timedelta(hours=2)),
        ],
    )
    value = await MetricService().get("daily_cost", 3600)
    assert value == pytest.approx(4.0)


@pytest.mark.asyncio
async def test_daily_cost_without_data_is_zero(db):
    value = await MetricService().get("daily_cost", 3600)
    assert value == 0.0


@pytest.mark.asyncio
async def test_error_count_counts_errors_only(db):
    await _insert(
        db,
        ProjectRun,
        [
            make_run(status="error"),
            make_run(status="error"),
            make_run(status="converged"),
        ],
    )
    value = await MetricService().get("error_count", 3600)
    assert value == pytest.approx(2.0)


@pytest.mark.asyncio
async def test_unknown_metric_raises(db):
    with pytest.raises(ValueError, match="unsupported metric type"):
        await MetricService().get("bogus_metric", 3600)


@pytest.mark.asyncio
async def test_metric_service_singleton():
    assert MetricService() is not MetricService()
    from monitoring.metrics import get_metric_service

    assert get_metric_service() is get_metric_service()
