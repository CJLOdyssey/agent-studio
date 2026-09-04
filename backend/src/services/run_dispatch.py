"""Run 分发流水线（从 RunService._dispatch_pipeline 提取）。

单一职责：根据配置选择 celery/thread 模式分发 agent/team/complete 流水线。"""

from __future__ import annotations

import asyncio
import os
from collections.abc import Callable
from typing import Any

from core.infra.logging_config import get_logger
from repository import update_run_status

logger = get_logger(__name__)


def _get_dispatch_mode() -> str:
    return os.environ.get("RUN_DISPATCH", "thread")


async def dispatch_pipeline(
    *,
    requirement: str,
    run_id: str,
    session_id: str | None,
    user_id: str,
    team_id: str | None,
    agent_id: str | None,
    api_key: str,
    api_base: str | None,
    effective_model: str,
    resolved_key_id: str | None,
    image_model: bool,
    register_task: Callable[[str, asyncio.Task[Any]], None],
) -> dict[str, Any]:
    """分发流水线：celery 或线程模式，agent 或 team 流水线。"""
    dispatch = _get_dispatch_mode()
    try:
        if dispatch == "celery":
            from tasks import registry as _reg

            if team_id:
                from repository.workflows import get_workflow_config_by_team

                workflow = await get_workflow_config_by_team(team_id)
                if workflow:
                    _reg.run_team.delay(
                        requirement=requirement, run_id=run_id, session_id=session_id,
                        team_id=team_id, key_id=resolved_key_id, api_key=api_key,
                        api_base=api_base, model=effective_model,
                    )
                    logger.info("Team task -> celery | run=%s | team=%s", run_id, team_id)
                    return {"run_id": run_id, "status": "pending", "session_id": session_id}
            _reg.run_agent.delay(
                requirement=requirement, run_id=run_id, session_id=session_id,
                agent_id=agent_id, api_key=api_key, api_base=api_base,
                model=effective_model, user_id=user_id, key_id=resolved_key_id,
            )
            logger.info("Task -> celery | run=%s", run_id)
            return {"run_id": run_id, "status": "pending", "session_id": session_id}

        # thread 模式
        if team_id:
            from repository.workflows import get_workflow_config_by_team

            workflow = await get_workflow_config_by_team(team_id)
            if workflow:
                from tasks.team_pipeline import _run_team_pipeline

                task: asyncio.Task[Any] = asyncio.create_task(
                    _run_team_pipeline(
                        requirement=requirement, run_id=run_id, session_id=session_id,
                        team_id=team_id, key_id=resolved_key_id, user_id=user_id,
                        model=effective_model, api_key=api_key, api_base=api_base,
                    )
                )
                register_task(run_id, task)
                logger.info("Team task started (thread) | run=%s | team=%s | nodes=%d",
                            run_id, team_id, len(workflow.nodes))
                return {"run_id": run_id, "status": "pending", "session_id": session_id}

        from tasks import _run_agent_pipeline

        task = asyncio.create_task(
            _run_agent_pipeline(
                requirement=requirement, run_id=run_id, session_id=session_id,
                agent_id=agent_id, api_key=api_key, api_base=api_base,
                model=effective_model, user_id=user_id, key_id=resolved_key_id,
                image_model=image_model,
            )
        )
        register_task(run_id, task)
        logger.info("Task started (thread) | run_id=%s | session_id=%s | model=%s",
                     run_id, session_id, effective_model)
    except Exception:
        logger.exception("Failed to start agent task for run=%s", run_id)
        await update_run_status(run_id, "error")
        raise

    return {"run_id": run_id, "status": "pending", "session_id": session_id}


async def dispatch_complete(
    *,
    content: str,
    run_id: str,
    api_key: str,
    api_base: str | None,
    effective_model: str,
    thinking: str | None,
    question: str | None,
    register_task: Callable[[str, asyncio.Task[Any]], None],
) -> dict[str, Any]:
    """分发续写（complete）流水线。"""
    dispatch = _get_dispatch_mode()
    if dispatch == "celery":
        from tasks import registry as _reg

        _reg.complete_agent.delay(
            content=content, run_id=run_id, api_key=api_key, api_base=api_base,
            model=effective_model, thinking=thinking, question=question,
        )
        logger.info("Complete -> celery | run=%s", run_id)
        return {"run_id": run_id, "status": "running"}

    async def _run_pipeline() -> Any:
        try:
            from tasks import _complete_pipeline

            await _complete_pipeline(
                content=content, run_id=run_id, api_key=api_key, api_base=api_base,
                model=effective_model, thinking=thinking, question=question,
            )
        except Exception:
            logger.exception("Complete pipeline failed for run=%s", run_id)
            await update_run_status(run_id, "error")

    task = asyncio.create_task(_run_pipeline())
    register_task(run_id, task)
    return {"run_id": run_id, "status": "running"}
