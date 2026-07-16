"""Generic CRUD base for simple entity repositories.

Usage
-----
Create a subclass, set ``model`` and ``to_dict``::

    class ToolRepository(BaseRepository):
        model = RegisteredToolDB

        @staticmethod
        def to_dict(obj) -> dict:
            return {"id": obj.id, "name": obj.name, ...}

Then expose module-level aliases::

    get_tools = ToolRepository.get_all  # bound classmethod, no (cls) needed
    get_tool = ToolRepository.get_one
    create_tool = ToolRepository.create_one
    update_tool = ToolRepository.update_one
    delete_tool = ToolRepository.delete_one
"""

from datetime import UTC, datetime
from typing import TYPE_CHECKING, ClassVar

from sqlalchemy import select
from sqlalchemy.orm import DeclarativeBase

from virtual_team.database import get_session_factory

if TYPE_CHECKING:
    _Model = type[DeclarativeBase]
else:
    _Model = None  # noqa: E701


class BaseRepository:
    """Shared CRUD infrastructure for entities with a single table.

    Subclasses **must** define:

    * ``model`` — the SQLAlchemy ORM model class
    * ``to_dict(obj)`` — static method returning a serialisable dict

    Subclasses **may** set ``default_order`` to a SQLAlchemy column expression
    (e.g. ``desc(ModelClass.updated_at)``) that will be applied by default in
    ``get_all()`` when called without explicit ordering.
    """

    model: ClassVar[_Model] = None  # type: ignore[valid-type]

    # Subclasses can override this to provide a default ORDER BY clause.
    default_order: ClassVar = None

    # Dependency injection: set a different session factory per subclass/tests.
    session_factory = staticmethod(get_session_factory)

    # ── session helpers ────────────────────────────────────────────────────

    @classmethod
    def _session_cm(cls):
        """Return an async context manager for a fresh session."""
        return cls.session_factory()()

    # ── CRUD operations (all classmethods) ─────────────────────────────────

    @classmethod
    async def get_one(cls, entity_id: str):
        """Fetch a single entity by primary-key ``id``, or return ``None``."""
        async with cls._session_cm() as session:
            return await session.get(cls.model, entity_id)

    @classmethod
    async def get_all(cls):
        """Fetch all entities, ordered by ``cls.default_order`` if set."""
        async with cls._session_cm() as session:
            stmt = select(cls.model)
            if cls.default_order is not None:
                stmt = stmt.order_by(cls.default_order)
            result = await session.execute(stmt)
            return [cls.to_dict(m) for m in result.scalars().all()]

    @classmethod
    async def create_one(cls, data: dict):
        """Insert a new row from ``data``, commit, refresh, and return."""
        async with cls._session_cm() as session:
            obj = cls.model(**data)
            session.add(obj)
            await session.commit()
            await session.refresh(obj)
            return obj

    @classmethod
    async def update_one(cls, entity_id: str, data: dict):
        """Partial-update an entity, or return ``None`` if not found."""
        async with cls._session_cm() as session:
            obj = await session.get(cls.model, entity_id)
            if not obj:
                return None
            for k, v in data.items():
                if v is not None and hasattr(obj, k):
                    setattr(obj, k, v)
            obj.updated_at = datetime.now(UTC)  # type: ignore[attr-defined]
            await session.commit()
            await session.refresh(obj)
            return obj

    @classmethod
    async def delete_one(cls, entity_id: str) -> bool:
        """Delete an entity by id.  Returns ``True`` if deleted."""
        async with cls._session_cm() as session:
            obj = await session.get(cls.model, entity_id)
            if not obj:
                return False
            await session.delete(obj)
            await session.commit()
            return True

    # ── serialisation hook ─────────────────────────────────────────────────

    @staticmethod
    def to_dict(obj) -> dict:
        """Override in each subclass."""
        raise NotImplementedError
