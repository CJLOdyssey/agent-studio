"""User preference persistence — K-V store over user_preferences."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from core.infra.database import UserPreferenceDB, get_session_factory


async def get_all_preferences(user_id: str) -> dict[str, Any]:
    """Return all preferences for a user as a plain dict."""
    factory = get_session_factory()
    async with factory() as session:
        rows = await session.execute(
            select(UserPreferenceDB).where(UserPreferenceDB.user_id == user_id)
        )
        return {r.key: r.value for r in rows.scalars().all()}


async def set_preference(user_id: str, key: str, value: Any) -> None:
    """Upsert a single preference (last-write-wins, atomic).

    ``postgresql.insert().on_conflict_do_update()`` compiles to a valid
    ``ON CONFLICT ... DO UPDATE`` on SQLite (>=3.24) as well, keeping the
    sqlite unit-test suite green while matching production postgres semantics.
    """
    factory = get_session_factory()
    async with factory() as session:
        stmt = pg_insert(UserPreferenceDB).values(user_id=user_id, key=key, value=value)
        stmt = stmt.on_conflict_do_update(
            index_elements=[UserPreferenceDB.user_id, UserPreferenceDB.key],
            set_={"value": stmt.excluded.value, "updated_at": datetime.now(UTC)},
        )
        await session.execute(stmt)
        await session.commit()
