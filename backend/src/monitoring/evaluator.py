"""告警规则评估 —— 触发/解决状态机。

单一职责：决定规则何时触发、触发事件何时解决，并遵守冷却期。指标解析与通知
分发是注入的依赖（接口隔离），使此类可独立测试。
"""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.infra.database import get_session_factory
from core.infra.logging_config import get_logger
from monitoring.metrics import MetricService, get_metric_service
from monitoring.notifications import NotificationService, get_notification_service
from orm.alert import AlertEventDB, AlertRuleDB

logger = get_logger(__name__)

_COMPARATORS: dict[str, Any] = {
    "gt": lambda value, threshold: value > threshold,
    "gte": lambda value, threshold: value >= threshold,
    "lt": lambda value, threshold: value < threshold,
    "lte": lambda value, threshold: value <= threshold,
}


class AlertEvaluator:
    """针对实时指标评估已启用的告警规则。"""

    def __init__(
        self,
        metric_service: MetricService | None = None,
        notification_service: NotificationService | None = None,
    ) -> None:
        self._metrics = metric_service or get_metric_service()
        self._notifier = notification_service or get_notification_service()

    async def evaluate_once(self) -> int:
        """对所有已启用规则执行一次评估 tick。

        返回新触发事件数。触发与解决在同一事务中提交。
        """
        now = datetime.now(UTC)
        fired = 0
        async with get_session_factory()() as session:
            rules = await self._enabled_rules(session, now)
            for rule in rules:
                value = await self._metrics.get(rule.metric_type, rule.window_seconds, rule.team_id)
                if value is None:
                    continue
                if _breaches(rule.operator, value, rule.threshold):
                    if await self._maybe_fire(session, rule, value, now):
                        fired += 1
                else:
                    await self._resolve_open(session, rule, now)
            await session.commit()
        return fired

    async def _enabled_rules(self, session: AsyncSession, now: datetime) -> list[AlertRuleDB]:
        stmt = select(AlertRuleDB).where(
            AlertRuleDB.enabled.is_(True),
            (AlertRuleDB.silence_until.is_(None)) | (AlertRuleDB.silence_until <= now),
        )
        return list((await session.execute(stmt)).scalars().all())

    async def _latest_event(self, session: AsyncSession, rule_id: str) -> AlertEventDB | None:
        stmt = (
            select(AlertEventDB)
            .where(AlertEventDB.rule_id == rule_id)
            .order_by(AlertEventDB.triggered_at.desc())
            .limit(1)
        )
        return (await session.execute(stmt)).scalars().first()

    async def _maybe_fire(self, session: AsyncSession, rule: AlertRuleDB, value: float, now: datetime) -> bool:
        """除非已在触发或处于冷却期，否则创建触发事件。"""
        latest = await self._latest_event(session, rule.id)
        if latest is not None and latest.status == "firing":
            return False
        if latest is not None and latest.resolved_at is not None:
            elapsed = (now - _as_utc(latest.resolved_at)).total_seconds()
            if elapsed < rule.cooldown_seconds:
                return False
        event = AlertEventDB(
            id=str(uuid4()),
            rule_id=rule.id,
            metric_value=value,
            threshold=rule.threshold,
            severity=rule.severity,
            status="firing",
            message=_message(rule, value),
            triggered_at=now,
        )
        session.add(event)
        await self._notifier.notify(session, event, rule.name)
        logger.info(
            "Alert fired | rule=%s | metric=%s | value=%.2f | threshold=%.2f",
            rule.id,
            rule.metric_type,
            value,
            rule.threshold,
        )
        return True

    async def _resolve_open(self, session: AsyncSession, rule: AlertRuleDB, now: datetime) -> None:
        stmt = (
            select(AlertEventDB)
            .where(AlertEventDB.rule_id == rule.id, AlertEventDB.status == "firing")
            .order_by(AlertEventDB.triggered_at.asc())
            .limit(1)
        )
        event = (await session.execute(stmt)).scalars().first()
        if event is None:
            return
        event.status = "resolved"
        event.resolved_at = now
        logger.info("Alert resolved | rule=%s", rule.id)


def _breaches(operator: str, value: float, threshold: float) -> bool:
    comparator = _COMPARATORS.get(operator)
    if comparator is None:
        raise ValueError(f"unsupported operator: {operator}")
    return bool(comparator(value, threshold))


def _as_utc(dt: datetime) -> datetime:
    """将可能无时区的 datetime（SQLite 会丢弃 tzinfo）归一化为 UTC。"""
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt


def _message(rule: AlertRuleDB, value: float) -> str:
    return f"{rule.name}：{rule.metric_type} = {value:.2f}，阈值 {rule.threshold:.2f}（{rule.operator}）"


_evaluator: AlertEvaluator | None = None


def get_evaluator() -> AlertEvaluator:
    global _evaluator
    if _evaluator is None:
        _evaluator = AlertEvaluator()
    return _evaluator
