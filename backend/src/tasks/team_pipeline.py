"""Team pipeline — orchestrates multi-agent workflow execution."""

import gc
from typing import Any

from broker import publish_run_message
from checkpoint import create_checkpointer_async
from core.config import load_config
from core.infra.logging_config import get_logger
from repository import save_message, update_run_result, update_run_status
from repository.workflows import get_workflow_config_by_team
from workflow.dynamic_team_graph import DynamicTeamGraph

from .pipeline_utils import log_memory_diff

logger = get_logger(__name__)


def _compose_team_output(artifacts: dict[str, Any], fallback: str) -> str:
    """Compose per-node artifacts into labeled markdown blocks for display.

    Each node's independent output (generator content, reviewer opinion) becomes
    its own ``## <role_identifier>`` block so the UI can present them separately.
    The internal ``_final_report`` key is excluded — a reporter node stores the
    same content under its own role_identifier. Falls back to *fallback* (the
    run's final code) when there are no per-node artifacts.
    """
    blocks: list[str] = []
    for role, content in artifacts.items():
        if role == "_final_report":
            continue
        text = str(content or "").strip()
        if not text:
            continue
        blocks.append(f"## {role}\n\n{text}")
    return "\n\n---\n\n".join(blocks) if blocks else fallback


async def _run_team_pipeline(
    requirement: str,
    run_id: str,
    session_id: str | None,
    team_id: str,
    key_id: str | None = None,
    model: str = "",
    api_key: str = "",
    api_base: str | None = None,
) -> None:
    cfg = load_config()
    workflow_config = await get_workflow_config_by_team(team_id)
    if workflow_config is None:
        logger.warning("[TEAM] no workflow config for team %s", team_id)
        return

    logger.info("[TEAM] starting run=%s team=%s nodes=%d", run_id, team_id, len(workflow_config.nodes))
    try:
        await update_run_status(run_id, "in_progress")
        graph = DynamicTeamGraph(
            model=model or cfg.model,
            api_key=api_key or cfg.api_key,
            base_url=api_base or cfg.api_base,
            checkpointer=await create_checkpointer_async(),
        )
        await graph.set_workflow(workflow_config)
        result = await graph.run(
            requirement=requirement,
            thread_id=f"team-{team_id}-{run_id}",
            run_id=run_id,
        )
        artifacts = result.get("artifacts", {}) if isinstance(result, dict) else {}
        msgs = result.get("messages", []) if isinstance(result, dict) else []
        last_content = ""
        for m in reversed(msgs):
            if hasattr(m, "content") and m.content:
                last_content = str(m.content)
                break
        final = artifacts.get("_final_report", last_content)
        display = _compose_team_output(artifacts, final)
        verdicts = result.get("verdicts", {}) if isinstance(result, dict) else {}
        rounds = result.get("round_number", 1) if isinstance(result, dict) else 1

        await update_run_result(
            run_id=run_id, pm_document="", code=final,
            review=f"Team done: {len(artifacts)} outputs, {rounds} round(s)",
            approved=True, status="converged",
        )
        if display:
            try:
                await save_message(run_id, "agent", "team", display, 1)
            except Exception:
                logger.warning("[TEAM] failed to persist display message for run=%s", run_id, exc_info=True)
        await publish_run_message(
            run_id,
            {
                "type": "team_result", "status": "completed",
                "artifacts": artifacts, "display": display,
                "verdicts": verdicts, "rounds": rounds,
            },
        )
        logger.info("[TEAM] completed run=%s artifacts=%d", run_id, len(artifacts))
    except Exception as e:
        logger.error("[TEAM] fatal run=%s error=%s", run_id, str(e), exc_info=True)
        await update_run_status(run_id, "error")
    finally:
        gc.collect()
        log_memory_diff()
