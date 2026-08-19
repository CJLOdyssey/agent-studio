"""Alert domain repository — rules, events, notifications, and subscriptions.

Pure SQLAlchemy functions following the repository layer convention
(see ``repository/keys_crud.py``): no HTTP concerns, one session per call.
"""

from datetime import UTC, datetime
from typing import Any, cast
from uuid import uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.engine import CursorResult

from core.infra.database import get_session_factory
from orm.alert import (
    AlertEventDB,
    AlertRuleDB,
    NotificationDB,
    NotificationSubscriptionDB,
)

_DEFAULT_PAGE_LIMIT = 20
_MAX_PAGE_LIMIT = 100


def _clamp(limit: int, offset: int) -> tuple[int, int]:
    return min(max(limit, 1), _MAX_PAGE_LIMIT), max(offset, 0)


# ── Rules ───────────────────────────────────────────────────────────────────


async def list_rules(
    *,
    limit: int = _DEFAULT_PAGE_LIMIT,
    offset: int = 0,
    enabled: bool | None = None,
    metric_type: str | None = None,
) -> list[AlertRuleDB]:
    """List alert rules ordered by most recently updated first."""
    limit, offset = _clamp(limit, offset)
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AlertRuleDB).order_by(AlertRuleDB.updated_at.desc())
        if enabled is not None:
            stmt = stmt.where(AlertRuleDB.enabled.is_(enabled))
        if metric_type:
            stmt = stmt.where(AlertRuleDB.metric_type == metric_type)
        result = await session.execute(stmt.limit(limit).offset(offset))
        return list(result.scalars().all())


async def count_rules(*, enabled: bool | None = None, metric_type: str | None = None) -> int:
    """Count rules matching the given filters."""
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(func.count()).select_from(AlertRuleDB)
        if enabled is not None:
            stmt = stmt.where(AlertRuleDB.enabled.is_(enabled))
        if metric_type:
            stmt = stmt.where(AlertRuleDB.metric_type == metric_type)
        result = await session.execute(stmt)
        return int(result.scalar_one())


async def get_rule(rule_id: str) -> AlertRuleDB | None:
    """Fetch a single rule by id."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(AlertRuleDB).where(AlertRuleDB.id == rule_id))
        return result.scalar_one_or_none()


async def create_rule(data: dict[str, Any], created_by: str) -> AlertRuleDB:
    """Create a rule from validated payload fields; returns the persisted row."""
    factory = get_session_factory()
    async with factory() as session:
        rule = AlertRuleDB(
            id=str(uuid4()),
            name=data["name"],
            metric_type=data["metric_type"],
            operator=data["operator"],
            threshold=data["threshold"],
            window_seconds=data.get("window_seconds", 3600),
            severity=data["severity"],
            runbook_url=data.get("runbook_url"),
            cooldown_seconds=data.get("cooldown_seconds", 300),
            team_id=data.get("team_id"),
            created_by=created_by,
        )
        session.add(rule)
        await session.commit()
        await session.refresh(rule)
        return rule


async def update_rule(rule_id: str, data: dict[str, Any]) -> AlertRuleDB | None:
    """Apply partial updates to a rule; returns the row or None when missing."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(AlertRuleDB).where(AlertRuleDB.id == rule_id))
        rule = result.scalar_one_or_none()
        if rule is None:
            return None
        for field, value in data.items():
            if field == "silence_until" or value is not None:
                setattr(rule, field, value)
        await session.commit()
        await session.refresh(rule)
        return rule


async def delete_rule(rule_id: str) -> bool:
    """Delete a rule; historical events are kept for the audit trail."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(delete(AlertRuleDB).where(AlertRuleDB.id == rule_id))
        await session.commit()
        return cast(CursorResult[Any], result).rowcount > 0


# ── Events ──────────────────────────────────────────────────────────────────


async def list_events(
    *,
    limit: int = _DEFAULT_PAGE_LIMIT,
    offset: int = 0,
    rule_id: str | None = None,
    status: str | None = None,
    severity: str | None = None,
) -> list[tuple[AlertEventDB, str]]:
    """List events (newest first) with the owning rule name for display.

    The rule name falls back to the rule id so history survives rule deletion.
    """
    limit, offset = _clamp(limit, offset)
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(AlertEventDB, AlertRuleDB.name)
            .outerjoin(AlertRuleDB, AlertEventDB.rule_id == AlertRuleDB.id)
            .order_by(AlertEventDB.triggered_at.desc())
        )
        if rule_id:
            stmt = stmt.where(AlertEventDB.rule_id == rule_id)
        if status:
            stmt = stmt.where(AlertEventDB.status == status)
        if severity:
            stmt = stmt.where(AlertEventDB.severity == severity)
        result = await session.execute(stmt.limit(limit).offset(offset))
        return [(event, rule_name or event.rule_id) for event, rule_name in result.all()]


async def get_event(event_id: str) -> AlertEventDB | None:
    """Fetch a single event by id."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(AlertEventDB).where(AlertEventDB.id == event_id))
        return result.scalar_one_or_none()


async def ack_event(event_id: str) -> AlertEventDB | None:
    """Mark an event as acknowledged; no-op for already acked events."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(AlertEventDB).where(AlertEventDB.id == event_id))
        event = result.scalar_one_or_none()
        if event is None or event.status == "acked":
            return event
        event.status = "acked"
        event.acked_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(event)
        return event


# ── Notifications ───────────────────────────────────────────────────────────


async def list_notifications(
    *,
    user_id: str,
    limit: int = _DEFAULT_PAGE_LIMIT,
    offset: int = 0,
    unread_only: bool = False,
) -> list[NotificationDB]:
    """List the current user's in-app notifications, newest first."""
    limit, offset = _clamp(limit, offset)
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(NotificationDB).where(NotificationDB.user_id == user_id)
        if unread_only:
            stmt = stmt.where(NotificationDB.read_at.is_(None))
        stmt = stmt.order_by(NotificationDB.created_at.desc())
        result = await session.execute(stmt.limit(limit).offset(offset))
        return list(result.scalars().all())


async def count_unread_notifications(user_id: str) -> int:
    """Count the user's unread notifications (bell badge)."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(func.count())
            .select_from(NotificationDB)
            .where(
                NotificationDB.user_id == user_id,
                NotificationDB.read_at.is_(None),
            )
        )
        return int(result.scalar_one())


async def mark_notification_read(user_id: str, notification_id: str) -> NotificationDB | None:
    """Mark one notification as read; None when missing or owned by another user."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(NotificationDB).where(
                NotificationDB.id == notification_id,
                NotificationDB.user_id == user_id,
            )
        )
        notification = result.scalar_one_or_none()
        if notification is None:
            return None
        if notification.read_at is None:
            notification.read_at = datetime.now(UTC)
            await session.commit()
            await session.refresh(notification)
        return notification


async def mark_all_notifications_read(user_id: str) -> int:
    """Mark every unread notification of the user as read; returns the count."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(NotificationDB).where(
                NotificationDB.user_id == user_id,
                NotificationDB.read_at.is_(None),
            )
        )
        rows = list(result.scalars().all())
        now = datetime.now(UTC)
        for row in rows:
            row.read_at = now
        await session.commit()
        return len(rows)


# ── Subscriptions ───────────────────────────────────────────────────────────


async def list_subscriptions(user_id: str) -> list[NotificationSubscriptionDB]:
    """Return the user's alert delivery subscriptions."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(NotificationSubscriptionDB)
            .where(NotificationSubscriptionDB.user_id == user_id)
            .order_by(NotificationSubscriptionDB.severity)
        )
        return list(result.scalars().all())


async def replace_subscriptions(user_id: str, items: list[dict[str, Any]]) -> list[NotificationSubscriptionDB]:
    """Replace the user's subscriptions atomically with the given set.

    ``items`` entries carry severity/team_id/enabled (team_id nullable).
    """
    factory = get_session_factory()
    async with factory() as session:
        await session.execute(delete(NotificationSubscriptionDB).where(NotificationSubscriptionDB.user_id == user_id))
        now = datetime.now(UTC)
        for item in items:
            session.add(
                NotificationSubscriptionDB(
                    id=str(uuid4()),
                    user_id=user_id,
                    severity=item["severity"],
                    team_id=item.get("team_id"),
                    enabled=item.get("enabled", True),
                    created_at=now,
                )
            )
        await session.commit()
        result = await session.execute(
            select(NotificationSubscriptionDB)
            .where(NotificationSubscriptionDB.user_id == user_id)
            .order_by(NotificationSubscriptionDB.severity)
        )
        return list(result.scalars().all())
