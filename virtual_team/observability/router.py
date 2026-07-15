from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from virtual_team.observability.analyzer import analyze_trace, recent_errors_report
from virtual_team.observability.startup_guard import health as guard_health
from virtual_team.observability.store import get_store

router = APIRouter(prefix="/api/debug", tags=["debug"])


@router.get("/events")
async def list_events(
    trace_id: str | None = Query(None),
    q: str | None = Query(None),
    errors: bool = Query(False),
    slow: float | None = Query(None),
    seconds: int = Query(300),
    limit: int = Query(50),
):
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
        cutoff = __import__("time").time() - seconds
        data = store._query(
            "SELECT * FROM events WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?",
            (cutoff, limit),
        )
    return {"events": data, "total": len(data)}


@router.get("/trace/{trace_id}")
async def trace_detail(trace_id: str):
    return analyze_trace(trace_id)


@router.get("/errors")
async def errors(seconds: int = Query(300)):
    return {"reports": recent_errors_report(seconds)}


@router.get("/stats")
async def stats(seconds: int = Query(300)):
    return get_store().stats(seconds)


@router.get("/health")
async def observability_health():
    store = get_store()
    try:
        count = store._query("SELECT COUNT(*) as cnt FROM events")[0]["cnt"]
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
