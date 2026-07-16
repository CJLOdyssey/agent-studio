import gc

from virtual_team.broker import publish_run_message
from virtual_team.checkpoint import create_checkpointer_async
from virtual_team.config import load_config
from virtual_team.logging_config import get_logger
from virtual_team.repository import update_run_result, update_run_status
from virtual_team.repository.workflows import get_workflow_config_by_team
from virtual_team.workflow.dynamic_team_graph import DynamicTeamGraph

from .helpers import log_memory_diff

logger = get_logger(__name__)


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

        await update_run_result(
            run_id=run_id, pm_document="", code=final,
            review=f"Team done: {len(artifacts)} outputs",
            approved=True, status="converged",
        )
        await publish_run_message(run_id, {"type": "team_result", "status": "completed", "artifacts": artifacts})
        logger.info("[TEAM] completed run=%s artifacts=%d", run_id, len(artifacts))
    except Exception as e:
        logger.error("[TEAM] fatal run=%s error=%s", run_id, str(e), exc_info=True)
        await update_run_status(run_id, "error")
    finally:
        gc.collect()
        log_memory_diff()
