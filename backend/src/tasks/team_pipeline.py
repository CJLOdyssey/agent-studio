"""Team pipeline — orchestrates multi-agent workflow execution."""

import gc
from typing import Any

from broker import publish_run_message
from checkpoint import close_checkpointer, create_checkpointer_async
from core.config import load_config
from core.infra.logging_config import get_logger
from repository import (
    get_messages,
    list_attachments_by_run,
    save_message,
    update_message_content,
    update_run_result,
    update_run_status,
)
from repository.workflows import get_workflow_config_by_team
from workflow.dynamic_team_graph import DynamicTeamGraph
from workflow.models import NodeStrategy

from .pipeline_utils import log_memory_diff, notify_session_changed

logger = get_logger(__name__)


async def _load_attachment_payload(run_id: str) -> tuple[str, str]:
    """Load the run's bound attachments as (model context, download links).

    Mirrors the agent pipeline: extracted_text goes into the model context
    (injected as a SystemMessage by the node factory) and deterministic
    download links are appended to the final team summary. Fail-open — any
    error degrades to empty payloads so the team run still executes.
    """
    try:
        atts = await list_attachments_by_run(run_id)
        if not atts:
            return "", ""
        blocks = [
            f"[附件: {a.filename}]\n{a.extracted_text}" for a in atts if a.extracted_text and a.extracted_text.strip()
        ]
        context = "\n\n".join(blocks)
        links = "\n".join(f"- [📥 {a.filename}](/api/attachments/{a.id})" for a in atts)
        return context, f"\n\n{links}"
    except Exception:
        logger.warning("Failed to load attachment payload for run %s", run_id, exc_info=True)
        return "", ""


def _resolve_final_and_roles(
    artifacts: dict[str, Any],
    workflow_config: Any,
    last_content: str,
) -> tuple[str, set[str], set[str], bool]:
    """Resolve the final deliverable and reviewer/reporter role sets.

    The final deliverable is the reporter's ``_final_report`` when present,
    otherwise the last non-reviewer node's artifact (reviewer output is a
    machine verdict, never a user-facing deliverable), else the last message.

    Returns (final, reviewer_roles, reporter_roles, from_role_artifact):
    ``from_role_artifact`` is True when ``final`` duplicates a per-role
    artifact that is already persisted as its own message — callers must
    then skip the extra "团队汇总" save to avoid duplicate rows on reload.
    """
    node_by_role = {n.role_identifier: n for n in workflow_config.nodes}
    reviewer_roles = {r for r, n in node_by_role.items() if n.strategy.value == NodeStrategy.REVIEWER.value}
    reporter_roles = {r for r, n in node_by_role.items() if n.strategy.value == NodeStrategy.REPORTER.value}
    final_report = str(artifacts.get("_final_report") or "").strip()
    if final_report:
        return final_report, reviewer_roles, reporter_roles, False
    content_roles = [
        r
        for r in artifacts
        if r not in ("_final_report",) and r in node_by_role and r not in reviewer_roles and r not in reporter_roles
    ]
    if content_roles:
        last_role = content_roles[-1]
        text = str(artifacts.get(last_role) or "").strip()
        if text:
            return text, reviewer_roles, reporter_roles, True
    return last_content, reviewer_roles, reporter_roles, False


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
    checkpointer = None
    try:
        await update_run_status(run_id, "in_progress")
        checkpointer = await create_checkpointer_async()
        attachment_context, attachment_links = await _load_attachment_payload(run_id)
        graph = DynamicTeamGraph(
            model=model or cfg.model,
            api_key=api_key or cfg.api_key,
            base_url=api_base or cfg.api_base,
            checkpointer=checkpointer,
            attachment_context=attachment_context,
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
        final, reviewer_roles, reporter_roles, final_from_role_artifact = _resolve_final_and_roles(
            artifacts, workflow_config, last_content
        )
        verdicts = result.get("verdicts", {}) if isinstance(result, dict) else {}
        rounds = result.get("round_number", 1) if isinstance(result, dict) else 1

        await update_run_result(
            run_id=run_id,
            pm_document="",
            code=final,
            review=f"Team done: {len(artifacts)} outputs, {rounds} round(s)",
            approved=True,
            status="converged",
        )
        await notify_session_changed(session_id)
        # 行业化布局：每条角色输出 = 独立消息（agent_name=角色），reviewer
        # verdict 以人类可读文本独立落库（徽章不可持久化，刷新后靠此保留）。
        last_saved_role = ""
        for role, content in artifacts.items():
            if role in ("_final_report",) or role in reviewer_roles or role in reporter_roles:
                continue
            text = str(content or "").strip()
            if not text:
                continue
            try:
                await save_message(run_id, "agent", role, text, 1)
                last_saved_role = role
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
        # M4: final 若来自已独立保存的角色 artifact（无 reporter 回退场景），
        # 再存「团队汇总」会产生重复行（刷新后同内容两条），跳过。
        # 附件下载链接拼到交付物消息尾部（对齐 agent_pipeline 的确定性链接注入，
        # 前端据此提供可点击下载；用户消息的附件徽章不覆盖 AI 消息）。
        if final and not final_from_role_artifact:
            try:
                await save_message(run_id, "agent", "团队汇总", final + attachment_links, 1)
            except Exception:
                logger.warning("[TEAM] failed to persist final message run=%s", run_id, exc_info=True)
        elif final_from_role_artifact and attachment_links and last_saved_role:
            # 无 reporter：交付物 = 已保存的角色消息，把下载链接追加到它上面
            # （与 agent_pipeline 的 update_message_content 追加同一模式）。
            try:
                msgs = await get_messages(run_id)
                last = next(
                    (m for m in reversed(msgs) if getattr(m, "agent_name", None) == last_saved_role),
                    None,
                )
                if last and attachment_links.strip() not in (last.content or ""):
                    await update_message_content(last.id, (last.content or "") + attachment_links)
            except Exception:
                logger.warning("[TEAM] failed to append attachment links run=%s", run_id, exc_info=True)
        display = final
        await publish_run_message(
            run_id,
            {
                "type": "team_result",
                "status": "completed",
                "team_id": team_id,
                "artifacts": artifacts,
                "display": display,
                "verdicts": verdicts,
                "rounds": rounds,
            },
        )
        logger.info("[TEAM] completed run=%s artifacts=%d", run_id, len(artifacts))
    except Exception as e:
        logger.error("[TEAM] fatal run=%s error=%s", run_id, str(e), exc_info=True)
        # 失败也必须发终态事件（error）：否则前端 running 态永卡转圈。
        # 用 content 字段（前端 handleErrorEvent 唯一消费字段，见 H1 契约）。
        await publish_run_message(run_id, {"type": "error", "content": f"团队执行失败: {e}"})
        await update_run_status(run_id, "error")
        await notify_session_changed(session_id)
    finally:
        if checkpointer is not None:
            try:
                await close_checkpointer(checkpointer)
            except Exception:
                logger.warning("[TEAM] failed to close checkpointer run=%s", run_id, exc_info=True)
        # run 结束即释放 buffer pubsub 连接（同 agent_pipeline，防 Redis 池耗尽）
        try:
            from broker import stop_buffer

            await stop_buffer(run_id)
        except Exception:
            logger.debug("stop_buffer failed for run %s", run_id, exc_info=True)
        gc.collect()
        log_memory_diff()
