from datetime import UTC, datetime

from sqlalchemy import desc, select

from virtual_team.database import PromptDB, get_session_factory
from virtual_team.logging_config import get_logger

logger = get_logger(__name__)


async def get_prompts() -> list[dict]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(PromptDB).order_by(desc(PromptDB.updated_at))
        result = await session.execute(stmt)
        return [
            {
                "id": p.id,
                "name": p.name,
                "category": p.category,
                "content": p.content,
                "model": p.model,
                "status": p.status,
                "version": p.version,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            }
            for p in result.scalars().all()
        ]


async def get_prompt(prompt_id: str) -> PromptDB | None:
    factory = get_session_factory()
    async with factory() as session:
        return await session.get(PromptDB, prompt_id)


async def create_prompt(data: dict) -> PromptDB:
    factory = get_session_factory()
    async with factory() as session:
        obj = PromptDB(**data)
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj


async def update_prompt(prompt_id: str, data: dict) -> PromptDB | None:
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(PromptDB, prompt_id)
        if not obj:
            return None
        for k, v in data.items():
            if v is not None and hasattr(obj, k):
                setattr(obj, k, v)
        obj.updated_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(obj)
        return obj


async def delete_prompt(prompt_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(PromptDB, prompt_id)
        if not obj:
            return False
        await session.delete(obj)
        await session.commit()
        return True
