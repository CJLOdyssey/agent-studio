"""LLM trace 浏览器 API（粒度 B）。

读取按 run 分组的真实逐 LLM 调用 span（``llm_spans``），使前端能展示
Langfuse 风格的 trace 列表 + 每个 run 的 span 树（瀑布图），含模型 /
token / 成本 / 时长 / 状态 / 载荷。

认证遵循仓库模式：处理器注入 ``request`` 并调用 ``get_user_id(request)``。
非管理员用户只能看到自己拥有的 run。
"""


from __future__ import annotations

from datetime import date
from typing import Any

from cost.llm_trace import get_trace, list_traces
from fastapi import APIRouter, Request

from auth import get_user_id
from core.error_codes import ErrorCode, error_response
from core.infra.logging_config import get_logger
from repository import get_run

logger = get_logger(__name__)
router = APIRouter(tags=["traces"])

_ADMIN_IDS = ("admin", "superuser")


def _is_admin(user_id: str) -> bool:
    return user_id in _ADMIN_IDS


def _fmt_spans(spans: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """返回 camelCase span 字典；只保留有界、非敏感字段。"""
    out: list[dict[str, Any]] = []
    for s in spans:
        out.append(
            {
                "id": s["id"],
                "runId": s["run_id"],
                "sessionId": s.get("session_id"),
                "parentSpanId": s["parent_span_id"],
                "spanType": s["span_type"],
                "nodeId": s["node_id"],
                "model": s["model"],
                "teamId": s.get("team_id"),
                "userId": s.get("user_id"),
                "keyId": s.get("key_id"),
                "promptTokens": s["prompt_tokens"],
                "completionTokens": s["completion_tokens"],
                "totalTokens": s["total_tokens"],
                "costUsd": s["cost_usd"],
                "durationMs": s["duration_ms"],
                "status": s["status"],
                "error": s["error"],
                "inputSnapshot": s["input_snapshot"],
                "outputSnapshot": s["output_snapshot"],
                "createdAt": s["created_at"],
            }
        )
    return out


def _fmt_trace_list(traces: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """将聚合的 trace 行（snake_case）转换为前端 ``TraceSummary`` 期望的
    camelCase 契约（runId / spanCount / totalTokens / promptTokens /
    completionTokens / costUsd / durationMs / lastAt / errorSpans / hasError）。
    详情端点已通过 ``_fmt_spans`` 输出 camelCase；列表必须保持一致，
    使 trace 表能正常渲染。
    """
    out: list[dict[str, Any]] = []
    for r in traces:
        out.append(
            {
                "runId": r["run_id"],
                "title": r.get("title"),
                "spanCount": int(r.get("span_count") or 0),
                "totalTokens": int(r.get("total_tokens") or 0),
                "promptTokens": int(r.get("prompt_tokens") or 0),
                "completionTokens": int(r.get("completion_tokens") or 0),
                "costUsd": float(r.get("cost_usd") or 0.0),
                "durationMs": int(r.get("duration_ms") or 0),
                "lastAt": r.get("last_at"),
                "errorSpans": int(r.get("error_spans") or 0),
                "hasError": bool(r.get("has_error")),
            }
        )
    return out


@router.get("/api/traces")
async def api_list_traces(
    request: Request,
    start_date: str | None = None,
    end_date: str | None = None,
    run_id: str | None = None,
    team_id: str | None = None,
    user_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """列出带聚合 span 指标的 run（trace 列表）。"""
    request_user_id = get_user_id(request)
    try:
        sd = date.fromisoformat(start_date) if start_date else None
        ed = date.fromisoformat(end_date) if end_date else None
    except ValueError:
        raise error_response(ErrorCode.INVALID_REQUEST, "invalid start_date/end_date") from None
    is_admin = _is_admin(request_user_id)
    # 非管理员调用方被固定到自己的 user_id。
    eff_user = user_id if is_admin else request_user_id
    try:
        data = await list_traces(
            start_date=sd,
            end_date=ed,
            run_id=run_id,
            team_id=team_id if is_admin else None,
            user_id=eff_user,
            limit=min(limit, 200),
            offset=offset,
        )
    except Exception:  # noqa: BLE001
        logger.warning("list traces failed", exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, "failed to list traces") from None
    return {
        "traces": _fmt_trace_list(data.get("traces", [])),
        "total": data.get("total", 0),
        "limit": data.get("limit", 0),
        "offset": data.get("offset", 0),
    }


@router.get("/api/traces/{run_id}")
async def api_get_trace(
    run_id: str,
    request: Request,
    team_id: str | None = None,
) -> dict[str, Any]:
    """返回单个 run 的完整 span 集合（span 树）。"""
    request_user_id = get_user_id(request)
    is_admin = _is_admin(request_user_id)
    try:
        spans = await get_trace(
            run_id,
            team_id=team_id if is_admin else None,
            user_id=None if is_admin else request_user_id,
        )
        # 顶层 title = 该 run 的用户需求原文（大厂 trace 名）。根 agent span 的
        # node_id 是内部代码节点名（单 agent 对话即 "chat"），不适合当展示名；
        # 前端用它来显示"这次在聊什么"，避免每条 run 都像同一个固定 agent。
        run = await get_run(run_id)
        title = (run.requirement or "").strip() if run else ""
    except Exception:  # noqa: BLE001
        logger.warning("get trace failed run=%s", run_id, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, "failed to load trace") from None
    return {"runId": run_id, "title": title or None, "spans": _fmt_spans(spans)}
