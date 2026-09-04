"""监控事件/trace API——对可观测性事件的已认证访问。

将 EventStore 隔离在 ``get_current_user`` 之后（原始 ``/api/debug`` 路由
未认证）。复用共享存储查询方法与分析器，在其上增加结构化过滤与错误聚类。
过滤在 Python 中对时间窗口抓取结果运行——事件有界（每页上限），
因此保持廉价且不耦合到任一存储后端。
"""

from typing import Any

from fastapi import APIRouter, Request

from auth import get_user_id
from core.error_codes import ErrorCode, error_response
from core.infra.logging_config import get_logger
from observability.analyzer import analyze_trace
from observability.store import get_store

logger = get_logger(__name__)
router = APIRouter(tags=["monitor"])

_LEVELS = ("debug", "info", "warning", "error", "critical")


def _event_shape(row: dict[str, Any]) -> dict[str, Any]:
    """将事件行规范化为稳定的 camelCase 结构以供前端使用。"""
    return {
        "timestamp": row.get("timestamp"),
        "traceId": row.get("trace_id"),
        "spanId": row.get("span_id"),
        "parentSpanId": row.get("parent_span_id"),
        "level": row.get("level"),
        "logger": row.get("logger"),
        "message": row.get("message"),
        "errorType": row.get("error_type"),
        "errorStack": (row.get("error_stack") or "")[:2000] or None,
        "durationMs": row.get("duration_ms"),
        "eventType": row.get("event_type"),
        "tags": row.get("tags"),
    }


def _filtered(rows: list[dict[str, Any]], filters: dict[str, Any]) -> list[dict[str, Any]]:
    """在抓取的窗口上应用 Python 侧结构化过滤。"""
    result = rows
    level = filters.get("level")
    error_type = filters.get("error_type")
    logger_name = filters.get("logger")
    slow = filters.get("slow")
    if level:
        result = [r for r in result if r.get("level") == level]
    if error_type:
        needle = error_type.lower()
        result = [r for r in result if needle in (r.get("error_type") or "").lower()]
    if logger_name:
        needle = logger_name.lower()
        result = [r for r in result if needle in (r.get("logger") or "").lower()]
    if slow is not None:
        result = [r for r in result if (r.get("duration_ms") or 0) >= slow]
    return result


@router.get("/api/monitor/events")
async def monitor_events(request: Request) -> dict[str, Any]:
    """列出带结构化过滤的可观测性事件（已认证）。"""
    try:
        get_user_id(request)
    except Exception as e:
        logger.error("Monitor events auth failed: %s", e, exc_info=True)
        raise error_response(ErrorCode.AUTH_UNAUTHORIZED, detail="未登录") from e

    params = request.query_params
    trace_id = params.get("trace_id")
    q = params.get("q")
    seconds = _int_param(params, "seconds", 300)
    limit = min(max(_int_param(params, "limit", 50), 1), 200)
    offset = max(_int_param(params, "offset", 0), 0)

    store = get_store()
    try:
        if trace_id:
            rows = store.by_trace(trace_id, limit * 4 + offset)
        elif q:
            rows = store.search(q, limit * 4 + offset)
        else:
            rows = store.recent(seconds, limit * 4 + offset)
    except Exception as e:
        logger.error("Monitor events query failed: %s", e, exc_info=True)
        rows = []

    filters = {
        "level": params.get("level"),
        "error_type": params.get("error_type"),
        "logger": params.get("logger"),
        "slow": _float_param(params, "slow"),
    }
    filtered = _filtered(rows, filters)
    page = filtered[offset : offset + limit]
    return {"events": [_event_shape(r) for r in page], "total": len(filtered)}


@router.get("/api/monitor/traces/{trace_id}")
async def monitor_trace_detail(trace_id: str, request: Request) -> dict[str, Any]:
    """返回分析后的 trace（span 链 + 错误/慢 span + 建议）。"""
    try:
        get_user_id(request)
    except Exception as e:
        logger.error("Monitor trace auth failed: %s", e, exc_info=True)
        raise error_response(ErrorCode.AUTH_UNAUTHORIZED, detail="未登录") from e
    try:
        return analyze_trace(trace_id)
    except Exception as e:
        logger.error("Monitor trace detail failed: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.get("/api/monitor/errors/clusters")
async def monitor_error_clusters(request: Request) -> dict[str, Any]:
    """按（error_type, logger）聚类最近的错误；返回数量 + 样例。"""
    try:
        get_user_id(request)
    except Exception as e:
        logger.error("Monitor clusters auth failed: %s", e, exc_info=True)
        raise error_response(ErrorCode.AUTH_UNAUTHORIZED, detail="未登录") from e

    seconds = _int_param(request.query_params, "seconds", 300)
    limit = min(max(_int_param(request.query_params, "limit", 20), 1), 100)
    store = get_store()
    try:
        rows = store.recent_errors(seconds, limit * 20)
    except Exception as e:
        logger.error("Monitor clusters query failed: %s", e, exc_info=True)
        rows = []

    clusters: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for r in rows:
        key = (r.get("error_type") or "unknown", r.get("logger") or "unknown")
        clusters.setdefault(key, []).append(r)

    result = []
    for (error_type, logger_name), samples in sorted(
        clusters.items(), key=lambda kv: len(kv[1]), reverse=True
    )[:limit]:
        latest = max(samples, key=lambda s: s.get("timestamp") or 0)
        result.append(
            {
                "errorType": error_type,
                "logger": logger_name,
                "count": len(samples),
                "latestMessage": (latest.get("message") or "")[:300],
                "latestTraceId": latest.get("trace_id"),
                "latestTimestamp": latest.get("timestamp"),
            }
        )
    return {"clusters": result}


def _int_param(params: Any, key: str, default: int) -> int:
    try:
        return int(params.get(key, default))
    except (TypeError, ValueError):
        return default


def _float_param(params: Any, key: str) -> float | None:
    raw = params.get(key)
    if raw is None or raw == "":
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None
