from datetime import UTC, datetime
from uuid import uuid4
from sqlalchemy import desc, select
from virtual_team.database import MCPServerDB, get_session_factory
from virtual_team.logging_config import get_logger

logger = get_logger(__name__)


async def get_mcps() -> list[dict]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(MCPServerDB).order_by(desc(MCPServerDB.updated_at))
        result = await session.execute(stmt)
        return [{ "id": m.id, "name": m.name, "type": m.type, "endpoint": m.endpoint, "config": m.config, "status": m.status, "created_at": m.created_at.isoformat() if m.created_at else None, } for m in result.scalars().all()]


async def create_mcp(data: dict) -> MCPServerDB:
    factory = get_session_factory()
    async with factory() as session:
        obj = MCPServerDB(**data)
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj


async def update_mcp(mcp_id: str, data: dict) -> MCPServerDB | None:
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(MCPServerDB, mcp_id)
        if not obj: return None
        for k, v in data.items():
            if v is not None and hasattr(obj, k): setattr(obj, k, v)
        obj.updated_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(obj)
        return obj


async def delete_mcp(mcp_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(MCPServerDB, mcp_id)
        if not obj: return False
        await session.delete(obj)
        await session.commit()
        return True
