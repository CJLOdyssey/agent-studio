from datetime import UTC, datetime

from sqlalchemy import desc, select

from virtual_team.database import RegisteredSkillDB, get_session_factory
from virtual_team.logging_config import get_logger

logger = get_logger(__name__)


async def get_skills() -> list[dict]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(RegisteredSkillDB).order_by(desc(RegisteredSkillDB.updated_at))
        result = await session.execute(stmt)
        return [
            {
                "id": s.id,
                "name": s.name,
                "category": s.category,
                "description": s.content,
                "version": s.version,
                "status": s.status,
                "author": s.author,
                "instructions": s.instructions,
                "prompt_id": s.prompt_id,
                "tool_names": s.tool_names or [],
                "output_constraint": s.output_constraint,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in result.scalars().all()
        ]


async def create_skill(data: dict) -> RegisteredSkillDB:
    factory = get_session_factory()
    async with factory() as session:
        obj = RegisteredSkillDB(**data)
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj


async def update_skill(skill_id: str, data: dict) -> RegisteredSkillDB | None:
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(RegisteredSkillDB, skill_id)
        if not obj:
            return None
        for k, v in data.items():
            if v is not None and hasattr(obj, k):
                setattr(obj, k, v)
        obj.updated_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(obj)
        return obj


async def delete_skill(skill_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(RegisteredSkillDB, skill_id)
        if not obj:
            return False
        await session.delete(obj)
        await session.commit()
        return True
