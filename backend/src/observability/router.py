"""可观测性事件、trace、错误与健康检查的调试 API 路由。"""

from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from core.infra.circuit_breaker import llm_circuit
from observability.analyzer import analyze_trace, recent_errors_report
from observability.startup_guard import health as guard_health
from observability.store import get_store

router = APIRouter(prefix="/api/debug", tags=["debug"])


@router.get("/events")
def list_events(
    trace_id: str | None = Query(None),
    q: str | None = Query(None),
    errors: bool = Query(False),
    slow: float | None = Query(None),
    seconds: int = Query(300),
    limit: int = Query(50),
) -> Any:
    """列出可观测性事件，支持可选过滤。"""
    store = get_store()
    if trace_id:
        data = store.by_trace(trace_id, limit)
    elif q:
        data = store.search(q, limit)
    elif errors:
        data = store.recent_errors(seconds, limit)
    elif slow is not None:
        data = store.slow_events(slow, seconds, limit)
    else:
        data = store.recent(seconds, limit)
    return {"events": data, "total": len(data)}


@router.get("/trace/{trace_id}")
def trace_detail(trace_id: str)-> Any:
    """按 ID 分析单条 trace。"""
    return analyze_trace(trace_id)


@router.get("/errors")
def errors(seconds: int = Query(300))-> Any:
    """列出最近的错误报告。"""
    return {"reports": recent_errors_report(seconds)}


@router.get("/stats")
def stats(seconds: int = Query(300))-> Any:
    """按级别返回事件计数。"""
    return get_store().stats(seconds)


@router.get("/health")
def observability_health()-> Any:
    """健康检查，含自检与启动保护状态。"""
    store = get_store()
    try:
        count = store.count()
        self_check = store.self_check()
        guard = guard_health()
        degraded = (
            self_check["write_errors"] > 0
            or self_check["disk_errors"] > 0
            or self_check["queue_size"] > 100
            or guard.get("crashed")
        )
        status = "degraded" if degraded else "ok"
        return {
            "status": status,
            "events_stored": count,
            "startup": guard,
            **self_check,
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "detail": str(e), "write_errors": -1},
        )


@router.get("/circuit-breakers")
def circuit_breakers() -> Any:
    """返回所有熔断器的当前状态。"""
    return {"circuit_breakers": [llm_circuit.status()]}
