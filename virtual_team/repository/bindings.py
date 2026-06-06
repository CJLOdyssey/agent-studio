from uuid import uuid4

from sqlalchemy import delete, select

from virtual_team.database import (
    AgentMcpBindingDB,
    AgentSkillBindingDB,
    AgentToolBindingDB,
    get_session_factory,
)

# ── Tool Bindings ──────────────────────────────────────────────

async def bind_tool(agent_id: str, tool_id: str, config_override: str | None = None) -> AgentToolBindingDB:
    factory = get_session_factory()
    async with factory() as session:
        binding = AgentToolBindingDB(
            id=str(uuid4()),
            agent_id=agent_id,
            tool_id=tool_id,
            config_override=config_override,
        )
        session.add(binding)
        await session.commit()
        await session.refresh(binding)
    return binding


async def unbind_tool(agent_id: str, tool_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            delete(AgentToolBindingDB).where(
                AgentToolBindingDB.agent_id == agent_id,
                AgentToolBindingDB.tool_id == tool_id,
            )
        )
        await session.commit()
        return result.rowcount > 0  # type: ignore[attr-defined]


async def get_agent_tools(agent_id: str) -> list[AgentToolBindingDB]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentToolBindingDB).where(AgentToolBindingDB.agent_id == agent_id)
        result = await session.execute(stmt)
        return list(result.scalars().all())


# ── MCP Bindings ───────────────────────────────────────────────

async def bind_mcp(agent_id: str, mcp_id: str, tool_filter: str | None = None) -> AgentMcpBindingDB:
    factory = get_session_factory()
    async with factory() as session:
        binding = AgentMcpBindingDB(
            id=str(uuid4()),
            agent_id=agent_id,
            mcp_id=mcp_id,
            tool_filter=tool_filter,
        )
        session.add(binding)
        await session.commit()
        await session.refresh(binding)
    return binding


async def unbind_mcp(agent_id: str, mcp_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            delete(AgentMcpBindingDB).where(
                AgentMcpBindingDB.agent_id == agent_id,
                AgentMcpBindingDB.mcp_id == mcp_id,
            )
        )
        await session.commit()
        return result.rowcount > 0  # type: ignore[attr-defined]


async def get_agent_mcp(agent_id: str) -> list[AgentMcpBindingDB]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentMcpBindingDB).where(AgentMcpBindingDB.agent_id == agent_id)
        result = await session.execute(stmt)
        return list(result.scalars().all())


# ── Skill Bindings ─────────────────────────────────────────────

async def bind_skill(agent_id: str, skill_id: str) -> AgentSkillBindingDB:
    factory = get_session_factory()
    async with factory() as session:
        binding = AgentSkillBindingDB(
            id=str(uuid4()),
            agent_id=agent_id,
            skill_id=skill_id,
        )
        session.add(binding)
        await session.commit()
        await session.refresh(binding)
    return binding


async def unbind_skill(agent_id: str, skill_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            delete(AgentSkillBindingDB).where(
                AgentSkillBindingDB.agent_id == agent_id,
                AgentSkillBindingDB.skill_id == skill_id,
            )
        )
        await session.commit()
        return result.rowcount > 0  # type: ignore[attr-defined]


async def get_agent_skills(agent_id: str) -> list[AgentSkillBindingDB]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentSkillBindingDB).where(AgentSkillBindingDB.agent_id == agent_id)
        result = await session.execute(stmt)
        return list(result.scalars().all())
