"""FastAPI dependency providers — re-exported from infrastructure layer.

This module provides dependency injection functions for FastAPI routers,
keeping the ``database.py`` infrastructure detail behind the repository
boundary.

Usage::

    from virtual_team.repository.deps import get_session
    from sqlalchemy.ext.asyncio import AsyncSession

    @router.get("/items")
    async def list_items(session: AsyncSession = Depends(get_session)):
        ...
"""

from virtual_team.core.infra.database import get_session

__all__ = ["get_session"]
