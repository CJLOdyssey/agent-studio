from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from virtual_team.database import AgentPromptDB, get_session_factory


async def create_prompt(
    agent_id: str,
    content: str,
    change_reason: str | None = None,
) -> AgentPromptDB:
    factory = get_session_factory()
    async with factory() as session:
        # get current max version
        result = await session.execute(
            select(AgentPromptDB.version)
            .where(AgentPromptDB.agent_id == agent_id)
            .order_by(AgentPromptDB.version.desc())
            .limit(1)
        )
        max_version = result.scalar_one_or_none() or 0
        new_version = max_version + 1

        prompt = AgentPromptDB(
            id=str(uuid4()),
            agent_id=agent_id,
            version=new_version,
            content=content,
            change_reason=change_reason,
            is_active=(new_version == 1),  # first version auto-activated
        )
        session.add(prompt)
        await session.commit()
        await session.refresh(prompt)
    return prompt


async def get_prompts(agent_id: str) -> list[AgentPromptDB]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(AgentPromptDB)
            .where(AgentPromptDB.agent_id == agent_id)
            .order_by(AgentPromptDB.version.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def activate_prompt(agent_id: str, prompt_id: str) -> AgentPromptDB | None:
    factory = get_session_factory()
    async with factory() as session:
        # deactivate all prompts for this agent
        await session.execute(
            update(AgentPromptDB)
            .where(AgentPromptDB.agent_id == agent_id)
            .values(is_active=False)
        )
        # activate the target prompt
        result = await session.execute(
            select(AgentPromptDB).where(AgentPromptDB.id == prompt_id, AgentPromptDB.agent_id == agent_id)
        )
        prompt = result.scalar_one_or_none()
        if not prompt:
            return None
        prompt.is_active = True
        prompt.updated_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(prompt)
    return prompt
