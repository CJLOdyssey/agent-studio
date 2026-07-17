"""Admin dashboard API: real stats from existing tables and command logs."""

from typing import Any

from fastapi import APIRouter

from virtual_team.repository.admin_stats import (
    get_command_logs as _get_command_logs,
)
from virtual_team.repository.admin_stats import (
    get_dashboard_stats as _get_dashboard_stats,
)
from virtual_team.repository.admin_stats import (
    get_recent_activity as _get_recent_activity,
)

router = APIRouter(tags=["admin"])


@router.get("/api/admin/stats")
async def get_dashboard_stats() -> Any:
    return await _get_dashboard_stats()


@router.get("/api/admin/logs")
async def get_command_logs(limit: int = 50, offset: int = 0) -> Any:
    return await _get_command_logs(limit=limit, offset=offset)


@router.get("/api/admin/activity")
async def get_recent_activity(limit: int = 10) -> Any:
    return await _get_recent_activity(limit=limit)
