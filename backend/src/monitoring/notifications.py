"""告警事件的通知分发 —— 感知订阅，仅应用内。

单一职责：将触发的告警事件转为 ``notifications`` 中的记录，
尊重按用户订阅，无订阅时采用合理默认策略。
"""

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.infra.logging_config import get_logger
from orm.alert import AlertEventDB, NotificationDB, NotificationSubscriptionDB

logger = get_logger(__name__)

# 当无订阅匹配事件严重级别时，回退到此策略（severity -> user_ids）。
# 让 P1/P2 开箱即可见，P3 则通过订阅选择性开启。
_DEFAULT_POLICY: dict[str, tuple[str, ...]] = {
    "P1": ("admin",),
    "P2": ("admin",),
    "P3": (),
}


class NotificationService:
    """为触发的告警创建应用内通知。"""

    async def notify(self, session: AsyncSession, event: AlertEventDB, rule_name: str) -> int:
        """在调用方事务中为 ``event`` 创建通知。

        返回创建的通知数。
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
        """按订阅或默认策略，应看到此事件的用户。"""
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
