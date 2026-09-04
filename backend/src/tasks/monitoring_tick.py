"""Celery beat 任务——周期性告警评估 tick。

按 ``broker/__init__.py`` 中声明的 beat 调度，每隔
``MONITOR_EVAL_INTERVAL_SECONDS``（默认 60s）驱动一次
:class:`monitoring.evaluator.AlertEvaluator`。所有规则/事件/通知的状态
转换都在评估器内部发生；本任务仅调用它。
"""

import asyncio
import os
from typing import Any

from core.infra.logging_config import get_logger
from tasks.registry import _task

logger = get_logger(__name__)

EVAL_INTERVAL_SECONDS = float(os.environ.get("MONITOR_EVAL_INTERVAL_SECONDS", "60"))


async def _evaluate() -> int:
    from monitoring.evaluator import AlertEvaluator

    return await AlertEvaluator().evaluate_once()


@_task(name="monitoring.tick", bind=True, max_retries=2, default_retry_delay=5)
def monitoring_tick(self: Any) -> int:
    """评估所有已启用的告警规则；返回状态变更次数。"""
    try:
        changed = asyncio.run(_evaluate())
        logger.info("[MONITOR] tick evaluated %d state changes", changed)
        return changed
    except Exception as exc:  # noqa: BLE001 — beat 任务绝不能中断调度
        logger.exception("[MONITOR] tick failed: %s", exc)
        raise


async def _cleanup_audit_logs() -> int:
    """删除超过 AUDIT_LOG_RETENTION_DAYS（默认 365 天）的审计日志。"""
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import delete

    from core.infra.database import get_session_factory
    from orm import AuditLogDB

    days = int(os.environ.get("AUDIT_LOG_RETENTION_DAYS", "365"))
    cutoff = datetime.now(UTC) - timedelta(days=days)
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            delete(AuditLogDB).where(AuditLogDB.created_at < cutoff)
        )
        await session.commit()
        return result.rowcount or 0  # type: ignore[attr-defined]


@_task(name="audit.cleanup", bind=True, max_retries=2, default_retry_delay=10)
def audit_cleanup(self: Any) -> int:
    """删除超过保留期的审计日志；返回删除条数。"""
    try:
        deleted = asyncio.run(_cleanup_audit_logs())
        if deleted:
            logger.info("[AUDIT] cleanup deleted %d old entries", deleted)
        return deleted
    except Exception as exc:
        logger.exception("[AUDIT] cleanup failed: %s", exc)
        raise
