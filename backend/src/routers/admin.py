"""Admin dashboard API: real stats from existing tables and command logs."""

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
    """Return aggregated dashboard statistics."""
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
    """Return paginated audit log entries with total count."""
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
    """Return the most recent audit activity entries."""
    return await _get_recent_activity(limit=limit)


@router.get("/api/admin/logs/verify")
async def verify_audit_logs() -> Any:
    """Verify the tamper-evident audit hash chain."""
    from repository.audit import verify_audit_chain

    return await verify_audit_chain()


@router.get("/api/admin/logs/export")
async def export_audit_logs() -> Any:
    """Export audit logs as CSV (bounded to recent 10k entries)."""
    from repository.audit import export_audit_logs as _export

    content, filename = await _export()
    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
