"""Tests for admin router and dashboard utilities."""

import pytest


@pytest.mark.asyncio
async def test_admin_router_importable():
    """Verify admin router exposes expected endpoint paths."""
    from virtual_team.routers.admin import router

    paths = [getattr(r, "path", "") for r in router.routes]
    assert "/api/admin/stats" in paths
    assert "/api/admin/logs" in paths


@pytest.mark.asyncio
async def test_dashboard_stats_query():
    """Verify dashboard stats function is importable."""
    from virtual_team.routers.admin import get_dashboard_stats

    assert get_dashboard_stats is not None


@pytest.mark.asyncio
async def test_command_logs_query():
    """Verify command logs function is importable."""
    from virtual_team.routers.admin import get_command_logs

    assert get_command_logs is not None
