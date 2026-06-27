from datetime import UTC, datetime
from uuid import uuid4
from sqlalchemy import desc, select
from virtual_team.database import RegisteredToolDB, get_session_factory
from virtual_team.logging_config import get_logger

logger = get_logger(__name__)


async def get_tools() -> list[dict]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(RegisteredToolDB).order_by(desc(RegisteredToolDB.updated_at))
        result = await session.execute(stmt)
        return [{ "id": t.id, "name": t.name, "category": t.category, "description": t.description, "model": t.model, "status": t.status, "version": t.version, "endpoint": t.endpoint, "parameters": t.parameters, "created_at": t.created_at.isoformat() if t.created_at else None, } for t in result.scalars().all()]


async def create_tool(data: dict) -> RegisteredToolDB:
    factory = get_session_factory()
    async with factory() as session:
        obj = RegisteredToolDB(**data)
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj


async def update_tool(tool_id: str, data: dict) -> RegisteredToolDB | None:
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(RegisteredToolDB, tool_id)
        if not obj: return None
        for k, v in data.items():
            if v is not None and hasattr(obj, k): setattr(obj, k, v)
        obj.updated_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(obj)
        return obj


async def delete_tool(tool_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(RegisteredToolDB, tool_id)
        if not obj: return False
        await session.delete(obj)
        await session.commit()
        return True
