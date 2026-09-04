"""任务辅助工具函数。"""
import asyncio
import contextlib
import json
import os
import threading
import time
import tracemalloc
from typing import Any

from broker import publish_run_message, publish_user_event
from core.infra.logging_config import get_logger
from core.mock_fallback import run_mock
from rag.rag_memory import summarize_rollup
from repository import (
    create_memory_entry,
    delete_memory_entry,
    get_session,
    get_session_memories,
    update_run_result,
    update_run_status,
)

logger = get_logger(__name__)

__all__ = [
    "notify_session_changed",
    "log_memory_diff",
    "_run_async",
    "_is_balance_error",
    "_report_run_error",
    "_try_mock_fallback",
    "_parse_json_field",
    "_build_session_context",
    "_get_rag_context",
    "_save_output_memories",
    "_discover_mcp_tools",
]


async def notify_session_changed(session_id: str | None) -> None:
    """跨客户端同步：广播会话更新（从会话解析用户）。

    用于不携带 user_id 的终态路径（团队 / mock 回退）。
    """
    if not session_id:
        return
    try:
        sess = await get_session(session_id)
        user_id = sess.user_id if sess else None
        if not user_id:
            return
        await publish_user_event(
            user_id,
            {
                "type": "session.updated",
                "session_id": session_id,
                "ts": int(time.time()),
            },
        )
    except Exception:
        logger.debug("session sync notify failed for %s", session_id, exc_info=True)

# ── 会话记忆策略（P1 长期记忆） ─────────────────────────────────────
# 窗口裁剪：仅将最新 N 条注入上下文
# （Dify TokenBufferMemory / n8n trimMessages 同款思路，条数维度）。
MEMORY_MAX_INJECT = int(os.environ.get("MEMORY_MAX_INJECT", "20"))
# 滚动汇总：一旦会话条目超过此数，最旧的一半
# 合并为单条 rollup 条目（Open WebUI review 轻量版）。
MEMORY_ROLLUP_THRESHOLD = int(os.environ.get("MEMORY_ROLLUP_THRESHOLD", "20"))

# ── 共享内存诊断 ─────────────────────────────────────────────
_run_counter = 0
_baseline_snapshot: tracemalloc.Snapshot | None = None


def log_memory_diff() -> None:
    """记录当前 RSS 及可选的 tracemalloc 差异以检测泄漏。

    通过 ``/proc/pid/status`` 读取 RSS 很廉价（微秒级）且始终保留。
    tracemalloc 的快照 + 对比开销极大——在数百 MB RSS 时会阻塞事件循环数秒，
    拖累并发请求处理。因此它由 ``MEM_TRACE=1`` 门控，默认关闭。
    """
    global _baseline_snapshot
    try:
        pid = os.getpid()
        with open(f"/proc/{pid}/status") as f:
            rss_kb = int(f.read().split("VmRSS:")[1].split()[0])
        logger.info("[MEM] run=#%s pid=%s rss=%dKB", _run_counter, pid, rss_kb)
    except Exception:
        pass
    if os.environ.get("MEM_TRACE", "").lower() not in ("1", "true", "yes"):
        return
    if not tracemalloc.is_tracing():
        return
    current = tracemalloc.take_snapshot()
    if _baseline_snapshot is None:
        _baseline_snapshot = current
        return
    diff = current.compare_to(_baseline_snapshot, "lineno")
    top = [str(d) for d in diff[:10] if d.size_diff > 0]
    if top:
        logger.info("[MEM] top growth:\n%s", "\n".join(top))
    _baseline_snapshot = current


# 供 celery 线程池 worker 使用的线程本地事件循环。
#
# 原因：asyncio.run() 每个任务都新建循环，但 SQLAlchemy 的异步引擎（QueuePool）
# 和 broker Redis 池按循环（或模块级）缓存。每个任务新循环会复用在已*关闭*
# 循环下创建的连接，触发 "Future attached to a different loop" 错误（或在半死
# 连接上挂起）。Celery 线程池每线程串行执行任务，因此每线程缓存一个循环是
# 安全的，并能让池跨任务保持有效。
_loop_local = threading.local()


def _run_async(coro: Any) -> Any:
    return asyncio.run(coro)


BALANCE_ERROR_KEYWORDS = [
    "insufficient_quota", "insufficient_balance", "insufficient balance", "余额不足",
    "billing limit", "quota exceeded", "payment required",
    "account balance", "402",
]


def _is_balance_error(exc: Exception) -> bool:
    """判断异常是否由模型余额/额度不足导致。"""
    msg = str(exc).lower()
    return any(kw in msg for kw in BALANCE_ERROR_KEYWORDS)


def _report_run_error(run_id: str, exc: Exception) -> None:
    try:
        if _is_balance_error(exc):
            _run_async(
                publish_run_message(
                    run_id,
                    {
                        "type": "balance_warning",
                        "content": "模型余额不足，请检查 API Key 配置并确保账户有足够额度",
                    },
                )
            )
        _run_async(update_run_status(run_id, "error"))
        _run_async(
            publish_run_message(
                run_id,
                {
                    "type": "error",
                    "content": str(exc),
                },
            )
        )
    except Exception:
        logger.exception("Failed to update error status for run %s", run_id)


def _try_mock_fallback(
    requirement: str, run_id: str, session_id: str | None, original_exc: Exception,
) -> dict[str, Any] | None:
    try:
        output = _run_async(run_mock(requirement, run_id, session_id))
        _run_async(
            update_run_result(
                run_id=run_id, pm_document="", code=output.response,
                review="LangGraph fallback", approved=True, status="converged",
            )
        )
        _run_async(
            publish_run_message(
                run_id,
                {"type": "result", "status": "completed", "approved": True,
                 "pm_document": "", "code": output.response, "review": "LangGraph fallback"},
            )
        )
        _run_async(notify_session_changed(session_id))
        if session_id:
            with contextlib.suppress(Exception):
                _run_async(_save_output_memories(session_id, run_id, output.response, {}))
        return {"run_id": run_id, "status": "completed", "fallback": True}
    except Exception as mock_exc:
        logger.exception("Mock fallback also failed for run=%s", run_id)
        _report_run_error(run_id, original_exc)
        raise mock_exc


def _parse_json_field(field: Any) -> list[Any]:
    if isinstance(field, str):
        try:
            return json.loads(field) if field else []
        except (json.JSONDecodeError, TypeError):
            return []
    return field or []



# MCP 发现缓存已拆分到 tasks.discovery_cache——re-export 保持兼容。
from tasks.discovery_cache import (  # noqa: F401
    _discover_mcp_tools,
    _discover_mcp_tools_uncached,
    _get_cached_discovery,
    _get_discovery_lock,
    _record_discovery_timeout,
    _store_discovery,
)


def _build_session_context(memories: list[Any], max_entries: int | None = None) -> str:
    """从记忆条目构建【历史上下文】块。

    窗口裁剪（行业惯例——Dify/n8n 在超出预算时丢弃最旧项）：
    仅注入最新 ``max_entries`` 条，使长会话的上下文不会无限增长。
    默认取环境变量 MEMORY_MAX_INJECT（20）。
    """
    if not memories:
        return ""
    limit = max_entries if max_entries is not None else MEMORY_MAX_INJECT
    lines = ["\n\n【历史上下文】"]
    for m in memories[-limit:]:
        lines.append(f"- [{m.content_type}] {m.agent_role}: {m.summary}")
    return "\n".join(lines)


async def _get_rag_context(query: str, session_id: str) -> str:
    try:
        from rag.rag_pipeline import ensure_embedding_provider, retrieve_context
        from repository.keys import get_embedding_config

        cfg = await get_embedding_config()
        if cfg is None or cfg["api_key"] is None:
            return ""
        ensure_embedding_provider(
            cfg["api_key"], model=cfg["model"], base_url=cfg["base_url"]
        )
        return await retrieve_context(
            query=query, session_id=session_id, top_k=3, rerank=True
        )
    except Exception:
        logger.warning("RAG context retrieval failed for session %s", session_id, exc_info=True)
        return ""


async def _save_output_memories(session_id: str, run_id: str, response: str, metadata: dict[str, Any]) -> None:
    summary = response[:200].replace("\n", " ")
    content_type = "code"
    if "<pm_document>" in response or "需求分析" in response:
        content_type = "pm_document"
    elif "<review>" in response or "问题" in response or "bug" in response.lower():
        content_type = "review"
    try:
        await create_memory_entry(
            session_id=session_id,
            run_id=run_id,
            agent_role="agent",
            content_type=content_type,
            summary=summary,
            details=response[:2000],
        )
        # 滚动汇总：一旦条目超过阈值，将最旧的一半合并为单条 rollup 条目，
        # 使每会话记忆保持有界（Open WebUI 周期性审查的轻量变体）。
        await _maybe_rollup_memories(session_id)
    except Exception:
        logger.exception("Failed to save memory for run %s", run_id)


async def _maybe_rollup_memories(session_id: str) -> None:
    """将会话记忆条目中最旧的一半合并为单条 rollup。

    当条目数超过 MEMORY_ROLLUP_THRESHOLD 时运行。被合并的条目会被删除；一条
    带合并摘要的 ``content_type="rollup"`` 条目取而代之（保留在头部以维持顺序）。
    """
    try:
        entries = await get_session_memories(session_id)
    except Exception:
        return
    if len(entries) <= MEMORY_ROLLUP_THRESHOLD:
        return

    # 保留最新的一半；合并最旧的一半。现有 rollup 的内容会并入新的 rollup，
    # 因此历史永不丢失。
    existing_rollup = next(
        (m for m in entries if m.content_type == "rollup"), None
    )
    keep = [m for m in entries if m.content_type != "rollup"]
    if len(keep) <= MEMORY_ROLLUP_THRESHOLD:
        return
    old, fresh = keep[: len(keep) // 2], keep[len(keep) // 2 :]
    if not old:
        return

    parts = []
    if existing_rollup:
        parts.append(existing_rollup.details or existing_rollup.summary)
    parts.append("\n".join(f"- [{m.content_type}] {m.agent_role}: {m.summary}" for m in old))
    merged = "\n".join(parts)
    summarized = await _summarize_rollup(merged)
    try:
        await create_memory_entry(
            session_id=session_id,
            run_id=old[0].run_id or "",
            agent_role="agent",
            content_type="rollup",
            summary=summarized[:500],
            details=merged[:4000],
        )
        for m in old:
            await delete_memory_entry(m.id)
        if existing_rollup:
            await delete_memory_entry(existing_rollup.id)
    except Exception:
        logger.exception("Failed to roll up memories for session %s", session_id)
    logger.info("[MEM] rolled up %d entries into session rollup (fresh=%d)", len(old), len(fresh))


async def _summarize_rollup(merged: str) -> str:
    """精简合并的记忆行——委托给 rag_memory（由 LLM 配置驱动）。"""
    return str(await summarize_rollup(merged))
