"""Admin dashboard API: real stats from existing tables and command logs."""

from typing import Any

from fastapi import APIRouter

from backend.repository.admin_stats import (
    get_command_logs as _get_command_logs,
)
from backend.repository.admin_stats import (
    get_dashboard_stats as _get_dashboard_stats,
)
from backend.repository.admin_stats import (
    get_recent_activity as _get_recent_activity,
)

router = APIRouter(tags=["admin"])


@router.get("/api/admin/stats")
async def get_dashboard_stats() -> Any:
    """Return aggregated dashboard statistics."""
    return await _get_dashboard_stats()


@router.get("/api/admin/logs")
async def get_command_logs(limit: int = 20, offset: int = 0) -> Any:
    """Return paginated command execution logs with total count."""
    return await _get_command_logs(limit=limit, offset=offset)


@router.get("/api/admin/activity")
async def get_recent_activity(limit: int = 10) -> Any:
    """Return the most recent audit activity entries."""
    return await _get_recent_activity(limit=limit)
