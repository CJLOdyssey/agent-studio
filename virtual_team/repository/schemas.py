from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select

from virtual_team.database import AgentOutputSchemaDB, get_session_factory


async def create_output_schema(
    agent_id: str,
    name: str,
    format_type: str,
    schema_def: str,
    example: str | None = None,
) -> AgentOutputSchemaDB:
    factory = get_session_factory()
    async with factory() as session:
        schema = AgentOutputSchemaDB(
            id=str(uuid4()),
            agent_id=agent_id,
            name=name,
            format_type=format_type,
            schema_def=schema_def,
            example=example,
        )
        session.add(schema)
        await session.commit()
        await session.refresh(schema)
    return schema


async def get_output_schemas(agent_id: str) -> list[AgentOutputSchemaDB]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(AgentOutputSchemaDB)
            .where(AgentOutputSchemaDB.agent_id == agent_id)
            .order_by(AgentOutputSchemaDB.created_at)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def get_output_schema(schema_id: str) -> AgentOutputSchemaDB | None:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentOutputSchemaDB).where(AgentOutputSchemaDB.id == schema_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


async def update_output_schema(
    schema_id: str,
    name: str | None = None,
    format_type: str | None = None,
    schema_def: str | None = None,
    example: str | None = None,
) -> AgentOutputSchemaDB | None:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentOutputSchemaDB).where(AgentOutputSchemaDB.id == schema_id)
        result = await session.execute(stmt)
        schema = result.scalar_one_or_none()
        if not schema:
            return None
        if name is not None:
            schema.name = name
        if format_type is not None:
            schema.format_type = format_type
        if schema_def is not None:
            schema.schema_def = schema_def
        if example is not None:
            schema.example = example
        schema.updated_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(schema)
    return schema


async def delete_output_schema(schema_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentOutputSchemaDB).where(AgentOutputSchemaDB.id == schema_id)
        result = await session.execute(stmt)
        schema = result.scalar_one_or_none()
        if not schema:
            return False
        await session.delete(schema)
        await session.commit()
        return True
