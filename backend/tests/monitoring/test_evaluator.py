"""Tests for monitoring.evaluator — firing/resolve state machine + notifications."""

from datetime import UTC, datetime, timedelta

import pytest
from monitoring.evaluator import AlertEvaluator
from sqlalchemy import select

from orm.alert import AlertEventDB, AlertRuleDB, NotificationDB
from orm.session import ProjectRun

from .conftest import make_rule, make_run


async def _insert(db, model, rows):
    async with db() as session:
        for row in rows:
            session.add(model(**row))
        await session.commit()


async def _events(db) -> list[AlertEventDB]:
    async with db() as session:
        return list((await session.execute(select(AlertEventDB))).scalars().all())


async def _notifications(db) -> list[NotificationDB]:
    async with db() as session:
        return list((await session.execute(select(NotificationDB))).scalars().all())


async def _rule(db, rule_id: str) -> AlertRuleDB:
    async with db() as session:
        return (await session.execute(select(AlertRuleDB).where(AlertRuleDB.id == rule_id))).scalar_one()


async def _set_resolved_at(db, event_id: str, when: datetime) -> None:
    async with db() as session:
        event = (await session.execute(select(AlertEventDB).where(AlertEventDB.id == event_id))).scalar_one()
        event.status = "resolved"
        event.resolved_at = when
        await session.commit()


@pytest.mark.asyncio
async def test_fires_when_metric_breaches(db):
    await _insert(db, AlertRuleDB, [make_rule(metric_type="error_count", operator="gt", threshold=0)])
    await _insert(db, ProjectRun, [make_run(status="error")])

    fired = await AlertEvaluator().evaluate_once()

    assert fired == 1
    events = await _events(db)
    assert len(events) == 1
    assert events[0].status == "firing"
    assert events[0].metric_value == 1.0
    assert events[0].threshold == 0.0


@pytest.mark.asyncio
async def test_fire_creates_default_notification_for_p1_p2(db):
    await _insert(db, AlertRuleDB, [make_rule(severity="P2", metric_type="error_count", operator="gt", threshold=0)])
    await _insert(db, ProjectRun, [make_run(status="error")])

    await AlertEvaluator().evaluate_once()

    notes = await _notifications(db)
    assert len(notes) == 1
    assert notes[0].user_id == "admin"
    assert notes[0].type == "alert"
    assert "test rule" in notes[0].title


@pytest.mark.asyncio
async def test_p3_no_default_notification(db):
    await _insert(db, AlertRuleDB, [make_rule(severity="P3", metric_type="error_count", operator="gt", threshold=0)])
    await _insert(db, ProjectRun, [make_run(status="error")])

    await AlertEvaluator().evaluate_once()

    assert await _notifications(db) == []


@pytest.mark.asyncio
async def test_no_fire_when_metric_within_threshold(db):
    await _insert(db, AlertRuleDB, [make_rule(metric_type="success_rate", operator="lt", threshold=90)])
    await _insert(db, ProjectRun, [make_run(status="converged")])

    fired = await AlertEvaluator().evaluate_once()

    assert fired == 0
    assert await _events(db) == []


@pytest.mark.asyncio
async def test_no_fire_without_data(db):
    await _insert(db, AlertRuleDB, [make_rule(metric_type="success_rate", operator="lt", threshold=90)])
    fired = await AlertEvaluator().evaluate_once()
    assert fired == 0


@pytest.mark.asyncio
async def test_already_firing_does_not_duplicate(db):
    await _insert(db, AlertRuleDB, [make_rule(metric_type="error_count", operator="gt", threshold=0)])
    await _insert(db, ProjectRun, [make_run(status="error")])

    evaluator = AlertEvaluator()
    assert await evaluator.evaluate_once() == 1
    assert await evaluator.evaluate_once() == 0

    assert len(await _events(db)) == 1


@pytest.mark.asyncio
async def test_resolves_open_event_when_healthy(db):
    await _insert(db, AlertRuleDB, [make_rule(metric_type="error_count", operator="gt", threshold=0)])
    await _insert(db, ProjectRun, [make_run(status="error")])

    evaluator = AlertEvaluator()
    assert await evaluator.evaluate_once() == 1
    event_id = (await _events(db))[0].id

    # Errors disappear from the window
    async with db() as session:
        from sqlalchemy import delete

        await session.execute(delete(ProjectRun))
        await session.commit()
    await _insert(db, ProjectRun, [make_run(status="converged")])

    assert await evaluator.evaluate_once() == 0
    events = await _events(db)
    assert events[0].status == "resolved"
    assert events[0].resolved_at is not None
    assert events[0].id == event_id


@pytest.mark.asyncio
async def test_cooldown_blocks_immediate_refire(db):
    rule = make_rule(cooldown_seconds=300, metric_type="error_count", operator="gt", threshold=0)
    await _insert(db, AlertRuleDB, [rule])
    await _insert(db, ProjectRun, [make_run(status="error")])

    evaluator = AlertEvaluator()
    assert await evaluator.evaluate_once() == 1
    event_id = (await _events(db))[0].id
    await _set_resolved_at(db, event_id, datetime.now(UTC) - timedelta(seconds=60))

    assert await evaluator.evaluate_once() == 0
    assert len(await _events(db)) == 1


@pytest.mark.asyncio
async def test_refire_after_cooldown_expires(db):
    rule = make_rule(cooldown_seconds=300, metric_type="error_count", operator="gt", threshold=0)
    await _insert(db, AlertRuleDB, [rule])
    await _insert(db, ProjectRun, [make_run(status="error")])

    evaluator = AlertEvaluator()
    assert await evaluator.evaluate_once() == 1
    event_id = (await _events(db))[0].id
    await _set_resolved_at(db, event_id, datetime.now(UTC) - timedelta(seconds=400))

    assert await evaluator.evaluate_once() == 1
    events = await _events(db)
    assert len(events) == 2
    assert events[1].status == "firing"


@pytest.mark.asyncio
async def test_silence_until_blocks_fire(db):
    silenced = datetime.now(UTC) + timedelta(hours=1)
    await _insert(
        db, AlertRuleDB, [make_rule(silence_until=silenced, metric_type="error_count", operator="gt", threshold=0)]
    )
    await _insert(db, ProjectRun, [make_run(status="error")])

    assert await AlertEvaluator().evaluate_once() == 0


@pytest.mark.asyncio
async def test_disabled_rule_not_evaluated(db):
    await _insert(db, AlertRuleDB, [make_rule(enabled=False, metric_type="error_count", operator="gt", threshold=0)])
    await _insert(db, ProjectRun, [make_run(status="error")])

    assert await AlertEvaluator().evaluate_once() == 0


@pytest.mark.asyncio
async def test_subscription_controls_recipient(db):
    from orm.alert import NotificationSubscriptionDB

    await _insert(
        db, NotificationSubscriptionDB, [{"id": "sub-1", "user_id": "alice", "severity": "P2", "enabled": True}]
    )
    await _insert(db, AlertRuleDB, [make_rule(severity="P2", metric_type="error_count", operator="gt", threshold=0)])
    await _insert(db, ProjectRun, [make_run(status="error")])

    await AlertEvaluator().evaluate_once()

    notes = await _notifications(db)
    assert len(notes) == 1
    assert notes[0].user_id == "alice"


@pytest.mark.asyncio
async def test_unsupported_operator_raises(db):
    from monitoring.evaluator import _breaches

    with pytest.raises(ValueError, match="unsupported operator"):
        _breaches("bogus", 1.0, 0.0)
