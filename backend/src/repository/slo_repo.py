"""SLO definitions repository — CRUD over sli_definitions.

Pure SQLAlchemy functions following the repository convention (see
``repository/alert_repo.py``): no HTTP concerns, one session per call.
"""

from typing import Any, cast
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.engine import CursorResult

from core.infra.database import get_session_factory
from orm.slo import SLIDefinitionDB


async def list_definitions(
    *, limit: int = 100, offset: int = 0, enabled: bool | None = None
) -> list[SLIDefinitionDB]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(SLIDefinitionDB).order_by(SLIDefinitionDB.updated_at.desc())
        if enabled is not None:
            stmt = stmt.where(SLIDefinitionDB.enabled.is_(enabled))
        result = await session.execute(stmt.limit(limit).offset(offset))
        return list(result.scalars().all())


async def get_definition(sli_id: str) -> SLIDefinitionDB | None:
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(SLIDefinitionDB).where(SLIDefinitionDB.id == sli_id)
        )
        return result.scalar_one_or_none()


async def create_definition(data: dict[str, Any], created_by: str) -> SLIDefinitionDB:
    factory = get_session_factory()
    async with factory() as session:
        obj = SLIDefinitionDB(
            id=str(uuid4()),
            name=data["name"],
            metric_type=data["metric_type"],
            target_percent=data["target_percent"],
            window_days=data.get("window_days", 30),
            team_id=data.get("team_id"),
            enabled=data.get("enabled", True),
            created_by=created_by,
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj


async def update_definition(sli_id: str, data: dict[str, Any]) -> SLIDefinitionDB | None:
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(SLIDefinitionDB).where(SLIDefinitionDB.id == sli_id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return None
        for field, value in data.items():
            if value is not None:
                setattr(obj, field, value)
        await session.commit()
        await session.refresh(obj)
        return obj


async def delete_definition(sli_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            delete(SLIDefinitionDB).where(SLIDefinitionDB.id == sli_id)
        )
        await session.commit()
        return cast(CursorResult[Any], result).rowcount > 0
