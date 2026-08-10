"""Task helper utilities."""
import asyncio
import contextlib
import hashlib
import json
import os
import shlex
import threading
import time
import tracemalloc
from typing import Any

from mcp import StdioServerParameters
from mcp.client.session import ClientSession
from mcp.client.stdio import stdio_client

from broker import publish_run_message
from core.infra.logging_config import get_logger
from core.mock_fallback import run_mock
from repository import (
    create_memory_entry,
    update_run_result,
    update_run_status,
)

logger = get_logger(__name__)

# ── Shared memory diagnostics ─────────────────────────────────────────────
_run_counter = 0
_baseline_snapshot: tracemalloc.Snapshot | None = None


def log_memory_diff() -> None:
    """Log current RSS and optional tracemalloc diff for leak detection.

    RSS read via ``/proc/pid/status`` is cheap (microseconds) and always kept.
    The tracemalloc snapshot + compare is EXPENSIVE — at multi-hundred-MB RSS it
    blocks the event loop for seconds, stalling concurrent request handlers. It
    is therefore gated behind ``MEM_TRACE=1`` and off by default.
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


# Thread-local event loop for celery threads-pool workers.
#
# WHY: asyncio.run() creates a fresh loop per task, but SQLAlchemy's async
# engine (QueuePool) and broker Redis pools are cached per-loop (or module-level).
# A fresh loop per task reuses connections created under a *closed* loop and
# blows up with "Future attached to a different loop" (or hangs on half-dead
# connections). Celery threads-pool runs tasks serially per thread, so caching
# one loop per thread is safe and lets pools stay valid across tasks.
_loop_local = threading.local()


def _run_async(coro: Any) -> Any:
    return asyncio.run(coro)


BALANCE_ERROR_KEYWORDS = [
    "insufficient_quota", "insufficient_balance", "insufficient balance", "余额不足",
    "billing limit", "quota exceeded", "payment required",
    "account balance", "402",
]


def _is_balance_error(exc: Exception) -> bool:
    """Check if the exception is caused by insufficient model balance/quota."""
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
                    "type": "status",
                    "status": "error",
                    "error": str(exc),
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


# In-process cache for MCP stdio discovery results. Spawning a stdio subprocess
# (and its up-to-25s timeout) is expensive and is repeated on every workflow run
# (per agent, per run). The discovered tool list is cached per (endpoint, args,
# env) config so repeated single-agent/team runs reuse it. A config change
# produces a different cache key and re-discovers automatically. Legitimate
# empty results (the MCP responds but exposes no tools) are cached too — a
# broken MCP then fails fast instead of hanging each run.
#
# A timed-out discovery, however, only gets a short negative TTL. A single
# transient 25s timeout (slow MCP startup, network jitter) must not permanently
# disable that MCP's tools for the rest of the worker process, so we re-discover
# after the TTL instead of serving a stale empty list forever.
_MCP_DISCOVERY_CACHE: dict[str, list[dict[str, Any]]] = {}
_MCP_DISCOVERY_LOCKS: dict[str, tuple[asyncio.AbstractEventLoop, asyncio.Lock]] = {}
_MCP_DISCOVERY_MAX_ENTRIES = 32
_MCP_DISCOVERY_TIMEOUT_TTL_SECONDS = 60
# Negative cache: cache key -> monotonic deadline after which a timed-out
# discovery must be retried. Entries are cheap and self-expire on read.
_MCP_DISCOVERY_TIMEOUTS: dict[str, float] = {}


def _discovery_cache_key(
    endpoint: str,
    args: list[str] | None,
    env: dict[str, str] | None,
) -> str:
    payload = json.dumps(
        {"endpoint": endpoint, "args": args, "env": env},
        sort_keys=True, ensure_ascii=False, separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _get_discovery_lock(key: str) -> asyncio.Lock:
    """Return the per-key discovery lock bound to the current event loop.

    ``asyncio.Lock`` is loop-bound; Celery prefork workers run each task on a
    fresh event loop (via ``asyncio.run``), so a lock created on a dead loop
    must never be reused — it would raise "Future attached to a different loop".
    """
    loop = asyncio.get_running_loop()
    entry = _MCP_DISCOVERY_LOCKS.get(key)
    if entry is None or entry[0] is not loop:
        lock = asyncio.Lock()
        _MCP_DISCOVERY_LOCKS[key] = (loop, lock)
        return lock
    return entry[1]


def _store_discovery(key: str, result: list[dict[str, Any]]) -> None:
    """Store a discovery result, evicting all entries when the cap is reached."""
    if len(_MCP_DISCOVERY_CACHE) >= _MCP_DISCOVERY_MAX_ENTRIES:
        _MCP_DISCOVERY_CACHE.clear()
        _MCP_DISCOVERY_LOCKS.clear()
        _MCP_DISCOVERY_TIMEOUTS.clear()
    _MCP_DISCOVERY_CACHE[key] = result


def _get_cached_discovery(key: str) -> list[dict[str, Any]] | None:
    """Return a cached discovery result, or None when discovery must be retried.

    Normal results live in the process-wide cache forever. A timed-out (empty)
    result is kept only for the negative TTL window; once that expires we treat
    the entry as absent and re-discover instead of serving a permanently
    disabled tool list.
    """
    deadline = _MCP_DISCOVERY_TIMEOUTS.get(key)
    if deadline is not None:
        if time.monotonic() < deadline:
            return []
        _MCP_DISCOVERY_TIMEOUTS.pop(key, None)
    return _MCP_DISCOVERY_CACHE.get(key)


def _record_discovery_timeout(key: str) -> None:
    _MCP_DISCOVERY_TIMEOUTS[key] = (
        time.monotonic() + _MCP_DISCOVERY_TIMEOUT_TTL_SECONDS
    )


async def _discover_mcp_tools(
    endpoint: str,
    args: list[str] | None = None,
    env: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """Discover MCP stdio tools, caching the result per (endpoint, args, env).

    Discovery spawns a stdio subprocess and can block up to 25s, so the result
    is cached in-process. The cache is shared by single-agent and team execution
    paths, so repeated runs reuse the tool list instead of re-spawning the
    subprocess every time. A config change yields a different key and
    re-discovers. Concurrent discoveries of the same config are deduped with a
    per-key ``asyncio.Lock``.

    A timed-out discovery returns an empty list that is cached only briefly
    (negative TTL); after the TTL elapses the next run re-discovers, so one
    transient timeout does not silently disable the MCP's tools for the rest of
    the process.
    """
    from services.tool_handlers import _normalize_mcp_env

    env = _normalize_mcp_env(env)
    key = _discovery_cache_key(endpoint, args, env)
    cached = _get_cached_discovery(key)
    if cached is not None:
        return cached

    lock = _get_discovery_lock(key)
    async with lock:
        cached = _get_cached_discovery(key)
        if cached is not None:
            return cached
        result, timed_out = await _discover_mcp_tools_uncached(endpoint, args, env)
        if timed_out:
            _record_discovery_timeout(key)
        else:
            _store_discovery(key, result)
        return result


async def _discover_mcp_tools_uncached(
    endpoint: str,
    args: list[str] | None = None,
    env: dict[str, str] | None = None,
) -> tuple[list[dict[str, Any]], bool]:
    """Discover MCP tools once, returning (tools, timed_out).

    ``timed_out`` distinguishes a real empty tool list from a timeout-induced
    empty one so the caller can apply the negative TTL only to the latter.
    """
    if args:
        params = StdioServerParameters(command=endpoint, args=list(args), env=env)
    else:
        cmd = shlex.split(endpoint)
        params = StdioServerParameters(command=cmd[0], args=cmd[1:], env=env)
    try:
        async with asyncio.timeout(25):
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.list_tools()
                    return [
                        {
                            "name": t.name,
                            "description": t.description or "",
                            "inputSchema": t.inputSchema or {"type": "object"},
                        }
                        for t in (result.tools or [])
                    ], False
    except TimeoutError:
        logger.warning("MCP discovery timed out for endpoint: %s", endpoint)
        return [], True


def _build_session_context(memories: list[Any]) -> str:
    if not memories:
        return ""
    lines = ["\n\n【历史上下文】"]
    for m in memories:
        lines.append(f"- [{m.content_type}] {m.agent_role}: {m.summary}")
    return "\n".join(lines)


async def _get_rag_context(query: str, session_id: str) -> str:
    try:
        from rag.rag_pipeline import ensure_embedding_provider, retrieve_context
        from repository.keys import get_embedding_api_key

        api_key = await get_embedding_api_key()
        ensure_embedding_provider(api_key)
        return await retrieve_context(query=query, session_id=session_id, top_k=3)
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
    except Exception:
        logger.exception("Failed to save memory for run %s", run_id)
