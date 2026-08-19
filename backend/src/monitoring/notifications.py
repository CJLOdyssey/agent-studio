"""Notification dispatch for alert events — subscription-aware, in-app only.

Single responsibility: turn a fired alert event into rows in ``notifications``,
honoring per-user subscriptions with a sane default policy when none exist.
"""

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.infra.logging_config import get_logger
from orm.alert import AlertEventDB, NotificationDB, NotificationSubscriptionDB

logger = get_logger(__name__)

# When no subscription matches an event's severity, fall back to this policy
# (severity -> user_ids). Keeps P1/P2 visible out of the box while leaving P3
# opt-in via subscriptions.
_DEFAULT_POLICY: dict[str, tuple[str, ...]] = {
    "P1": ("admin",),
    "P2": ("admin",),
    "P3": (),
}


class NotificationService:
    """Creates in-app notifications for fired alerts."""

    async def notify(self, session: AsyncSession, event: AlertEventDB, rule_name: str) -> int:
        """Create notifications for ``event`` in the caller's transaction.

        Returns the number of notifications created.
        """
        recipients = await self._recipients(session, event)
        for user_id in recipients:
            session.add(
                NotificationDB(
                    id=str(uuid4()),
                    user_id=user_id,
                    title=f"[{event.severity}] {rule_name}",
                    body=event.message,
                    type="alert",
                    link=f"/monitor/alerts?rule_id={event.rule_id}",
                )
            )
        return len(recipients)

    async def _recipients(self, session: AsyncSession, event: AlertEventDB) -> list[str]:
        """Users who should see this event, per subscriptions or default policy."""
        subs = (
            (
                await session.execute(
                    select(NotificationSubscriptionDB).where(
                        NotificationSubscriptionDB.severity == event.severity,
                        NotificationSubscriptionDB.enabled.is_(True),
                    )
                )
            )
            .scalars()
            .all()
        )
        if not subs:
            return list(_DEFAULT_POLICY.get(event.severity, ()))
        return list({s.user_id for s in subs})


_notification_service: NotificationService | None = None


def get_notification_service() -> NotificationService:
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
