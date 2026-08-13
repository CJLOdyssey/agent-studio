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
from workflow.models import NodeStrategy

from .pipeline_utils import log_memory_diff

logger = get_logger(__name__)


def _resolve_final_and_roles(
    artifacts: dict[str, Any],
    workflow_config: Any,
    last_content: str,
) -> tuple[str, set[str], set[str]]:
    """Resolve the final deliverable and reviewer/reporter role sets.

    The final deliverable is the reporter's ``_final_report`` when present,
    otherwise the last non-reviewer node's artifact (reviewer output is a
    machine verdict, never a user-facing deliverable), else the last message.
    """
    node_by_role = {n.role_identifier: n for n in workflow_config.nodes}
    reviewer_roles = {
        r for r, n in node_by_role.items()
        if n.strategy.value == NodeStrategy.REVIEWER.value
    }
    reporter_roles = {
        r for r, n in node_by_role.items()
        if n.strategy.value == NodeStrategy.REPORTER.value
    }
    final_report = str(artifacts.get("_final_report") or "").strip()
    if final_report:
        return final_report, reviewer_roles, reporter_roles
    content_roles = [
        r for r in artifacts
        if r not in ("_final_report",) and r in node_by_role
        and r not in reviewer_roles and r not in reporter_roles
    ]
    if content_roles:
        last_role = content_roles[-1]
        text = str(artifacts.get(last_role) or "").strip()
        if text:
            return text, reviewer_roles, reporter_roles
    return last_content, reviewer_roles, reporter_roles


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
        final, reviewer_roles, reporter_roles = _resolve_final_and_roles(
            artifacts, workflow_config, last_content
        )
        verdicts = result.get("verdicts", {}) if isinstance(result, dict) else {}
        rounds = result.get("round_number", 1) if isinstance(result, dict) else 1

        await update_run_result(
            run_id=run_id, pm_document="", code=final,
            review=f"Team done: {len(artifacts)} outputs, {rounds} round(s)",
            approved=True, status="converged",
        )
        # 行业化布局：每条角色输出 = 独立消息（agent_name=角色），reviewer
        # verdict 以人类可读文本独立落库（徽章不可持久化，刷新后靠此保留）。
        for role, content in artifacts.items():
            if role in ("_final_report",) or role in reviewer_roles or role in reporter_roles:
                continue
            text = str(content or "").strip()
            if not text:
                continue
            try:
                await save_message(run_id, "agent", role, text, 1)
            except Exception:
                logger.warning("[TEAM] failed to persist node message role=%s run=%s", role, run_id, exc_info=True)
        for role, v in (verdicts or {}).items():
            if role not in reviewer_roles:
                continue
            try:
                score = v.get("score")
                head = "✅ 通过" if v.get("approved") else "❌ 未通过"
                if score is not None:
                    head += f" · score {score}"
                reason = str(v.get("reason") or "").strip()
                text = f"{head}\n理由：{reason}" if reason else head
                await save_message(run_id, "agent", role, text, 1)
            except Exception:
                logger.warning("[TEAM] failed to persist verdict message role=%s run=%s", role, run_id, exc_info=True)
        # 最终成品：reporter 输出（或无 reporter 时最后产出）作为交付物。
        if final:
            try:
                await save_message(run_id, "agent", "团队汇总", final, 1)
            except Exception:
                logger.warning("[TEAM] failed to persist final message run=%s", run_id, exc_info=True)
        display = final
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
