"""管理后台 API：来自现有表与命令日志的真实统计。"""

from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from repository.admin_stats import (
    get_command_logs as _get_command_logs,
)
from repository.admin_stats import (
    get_dashboard_stats as _get_dashboard_stats,
)
from repository.admin_stats import (
    get_recent_activity as _get_recent_activity,
)

router = APIRouter(tags=["admin"])


@router.get("/api/admin/stats")
async def get_dashboard_stats() -> Any:
    """返回聚合的仪表盘统计。"""
    return await _get_dashboard_stats()


@router.get("/api/admin/logs")
async def get_command_logs(
    limit: int = 20,
    offset: int = 0,
    search: str = "",
    action: str = "",
    entity_type: str = "",
    level: str = "",
    start: str = "",
    end: str = "",
) -> Any:
    """返回带总数的分页审计日志条目。"""
    return await _get_command_logs(
        limit=limit,
        offset=offset,
        search=search,
        action=action,
        entity_type=entity_type,
        level=level,
        start=start,
        end=end,
    )


@router.get("/api/admin/activity")
async def get_recent_activity(limit: int = 10) -> Any:
    """返回最近的审计活动条目。"""
    return await _get_recent_activity(limit=limit)


@router.get("/api/admin/logs/verify")
async def verify_audit_logs() -> Any:
    """验证防篡改的审计哈希链。"""
    from repository.audit import verify_audit_chain

    return await verify_audit_chain()


@router.get("/api/admin/logs/export")
async def export_audit_logs() -> Any:
    """将审计日志导出为 CSV（限定最近 1 万条）。"""
    from repository.audit import export_audit_logs as _export

    content, filename = await _export()
    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
