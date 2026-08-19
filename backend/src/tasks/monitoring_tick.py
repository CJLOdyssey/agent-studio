"""Celery beat task — periodic alert evaluation tick.

Drives :class:`monitoring.evaluator.AlertEvaluator` every
``MONITOR_EVAL_INTERVAL_SECONDS`` (default 60s) via the beat schedule
declared in ``broker/__init__.py``. All rule/event/notification state
transitions happen inside the evaluator; this task only invokes it.
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
    """Evaluate all enabled alert rules; returns the number of state changes."""
    try:
        changed = asyncio.run(_evaluate())
        logger.info("[MONITOR] tick evaluated %d state changes", changed)
        return changed
    except Exception as exc:  # noqa: BLE001 — beat task must never kill the schedule
        logger.exception("[MONITOR] tick failed: %s", exc)
        raise
