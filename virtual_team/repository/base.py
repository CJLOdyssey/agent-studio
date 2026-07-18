"""Generic CRUD base for simple entity repositories."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, ClassVar, Generic, TypeVar, cast

from sqlalchemy import select
from sqlalchemy.orm import DeclarativeBase

from virtual_team.core.infra.database import get_session_factory

ModelT = TypeVar("ModelT", bound=DeclarativeBase)


class BaseRepository(Generic[ModelT]):

    model: ClassVar[type[DeclarativeBase]]
    default_order: ClassVar[Any] = None
    session_factory = staticmethod(get_session_factory)

    @classmethod
    def _session_cm(cls) -> Any:
        return cls.session_factory()()

    @classmethod
    async def get_one(cls, entity_id: str) -> ModelT | None:
        async with cls._session_cm() as session:
            return cast(ModelT | None, await session.get(cls.model, entity_id))

    @classmethod
    async def get_all(cls) -> list[ModelT]:
        async with cls._session_cm() as session:
            stmt = select(cls.model)
            if cls.default_order is not None:
                stmt = stmt.order_by(cls.default_order)
            result = await session.execute(stmt)
            return list(result.scalars().all())

    @classmethod
    async def get_all_as_dicts(cls) -> list[dict[str, Any]]:
        async with cls._session_cm() as session:
            stmt = select(cls.model)
            if cls.default_order is not None:
                stmt = stmt.order_by(cls.default_order)
            result = await session.execute(stmt)
            return [cls.to_dict(obj) for obj in result.scalars().all()]

    @classmethod
    async def create_one(cls, data: dict[str, Any]) -> ModelT:
        async with cls._session_cm() as session:
            obj = cast(ModelT, cls.model(**data))
            session.add(obj)
            await session.commit()
            await session.refresh(obj)
            return obj

    @classmethod
    async def update_one(cls, entity_id: str, data: dict[str, Any]) -> ModelT | None:
        async with cls._session_cm() as session:
            obj = await session.get(cls.model, entity_id)
            if not obj:
                return None
            for k, v in data.items():
                if v is not None and hasattr(obj, k):
                    setattr(obj, k, v)
            obj.updated_at = datetime.now(UTC)
            await session.commit()
            await session.refresh(obj)
            return cast(ModelT | None, obj)

    @classmethod
    async def delete_one(cls, entity_id: str) -> bool:
        async with cls._session_cm() as session:
            obj = await session.get(cls.model, entity_id)
            if not obj:
                return False
            await session.delete(obj)
            await session.commit()
            return True

    @staticmethod
    def to_dict(obj: ModelT) -> dict[str, Any]:
        raise NotImplementedError
