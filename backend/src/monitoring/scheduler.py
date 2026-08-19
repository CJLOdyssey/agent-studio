"""Background alert evaluation loop — wired into the app lifespan.

Uses the same asyncio periodic-task pattern as GC / retention cleanup so the
backend needs no external scheduler (Celery beat is not running).
"""

import asyncio
import os
from typing import Any

from core.infra.logging_config import get_logger
from monitoring.evaluator import AlertEvaluator

logger = get_logger(__name__)

_EVAL_INTERVAL_SECONDS = float(os.environ.get("MONITOR_EVAL_INTERVAL_SECONDS", "60"))


def start_alert_evaluator(app: Any) -> None:
    """Start the periodic evaluator task; stored on app.state for shutdown."""
    evaluator = AlertEvaluator()

    async def _loop() -> None:
        while True:
            try:
                fired = await evaluator.evaluate_once()
                if fired:
                    logger.info("Alert evaluation tick fired %d event(s)", fired)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Alert evaluation tick failed, continuing...")
            await asyncio.sleep(_EVAL_INTERVAL_SECONDS)

    app.state.alert_eval_task = asyncio.create_task(_loop())
    logger.info("[MONITOR] alert evaluator started | interval=%.0fs", _EVAL_INTERVAL_SECONDS)
