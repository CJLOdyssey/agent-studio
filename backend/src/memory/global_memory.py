"""Global memory management — cross-session persistent memory with decay and conflict resolution."""

import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import Any, cast
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.engine import CursorResult

from core.infra.database import get_session_factory
from core.infra.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class GlobalMemoryEntry:
    """A global memory entry that persists across sessions."""

    id: str = ""
    user_id: str = ""
    key: str = ""  # Unique key for this memory (e.g., "preference:language", "fact:occupation")
    value: Any = None
    confidence: float = 1.0  # 0.0-1.0, decays over time
    source_sessions: list[str] = field(default_factory=list)  # Session IDs that contributed
    created_at: float = 0.0
    last_accessed: float = 0.0
    access_count: int = 0
    decay_rate: float = 0.01  # Per-day decay rate
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "key": self.key,
            "value": self.value,
            "confidence": self.confidence,
            "source_sessions": self.source_sessions,
            "created_at": self.created_at,
            "last_accessed": self.last_accessed,
            "access_count": self.access_count,
            "decay_rate": self.decay_rate,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "GlobalMemoryEntry":
        return cls(**data)


class GlobalMemoryStore:
    """Manages global memory entries with decay, conflict resolution, and automatic extraction."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()

    async def store(
        self,
        user_id: str,
        key: str,
        value: Any,
        session_id: str,
        confidence: float = 1.0,
        decay_rate: float = 0.01,
        metadata: dict[str, Any] | None = None,
    ) -> GlobalMemoryEntry:
        """Store or update a global memory entry."""
        async with self._lock:
            factory = get_session_factory()
            async with factory() as session:
                # Check if entry exists
                stmt = select(GlobalMemoryDB).where(
                    GlobalMemoryDB.user_id == user_id,
                    GlobalMemoryDB.key == key,
                )
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()

                now = time.time()

                if existing:
                    # Update existing entry
                    existing.value = json.dumps(value, ensure_ascii=False)
                    existing.confidence = max(existing.confidence, confidence)
                    if session_id not in (existing.source_sessions or []):
                        existing.source_sessions = (existing.source_sessions or []) + [session_id]
                    existing.last_accessed = now
                    existing.access_count += 1
                    if metadata:
                        existing.metadata_json = {**(existing.metadata_json or {}), **metadata}
                    await session.commit()
                    await session.refresh(existing)
                    return self._db_to_entry(existing)
                else:
                    # Create new entry
                    entry = GlobalMemoryDB(
                        id=str(uuid4()),
                        user_id=user_id,
                        key=key,
                        value=json.dumps(value, ensure_ascii=False),
                        confidence=confidence,
                        source_sessions=[session_id],
                        created_at=now,
                        last_accessed=now,
                        access_count=1,
                        decay_rate=decay_rate,
                        metadata=metadata or {},
                    )
                    session.add(entry)
                    await session.commit()
                    await session.refresh(entry)
                    return self._db_to_entry(entry)

    async def retrieve(
        self,
        user_id: str,
        key: str | None = None,
        min_confidence: float = 0.1,
        limit: int = 100,
    ) -> list[GlobalMemoryEntry]:
        """Retrieve global memory entries, applying decay and filtering."""
        factory = get_session_factory()
        async with factory() as session:
            stmt = select(GlobalMemoryDB).where(GlobalMemoryDB.user_id == user_id)
            if key:
                stmt = stmt.where(GlobalMemoryDB.key == key)

            result = await session.execute(stmt)
            entries = [self._db_to_entry(row) for row in result.scalars().all()]

        # Apply decay
        now = time.time()
        for entry in entries:
            days_old = (now - entry.created_at) / 86400
            entry.confidence *= (1 - entry.decay_rate) ** days_old

        # Filter by confidence
        entries = [e for e in entries if e.confidence >= min_confidence]

        # Sort by confidence * access_count (relevance score)
        entries.sort(key=lambda e: e.confidence * (1 + e.access_count * 0.1), reverse=True)

        return entries[:limit]

    async def delete(self, user_id: str, key: str) -> bool:
        """Delete a global memory entry."""
        factory = get_session_factory()
        async with factory() as session:
            stmt = delete(GlobalMemoryDB).where(
                GlobalMemoryDB.user_id == user_id,
                GlobalMemoryDB.key == key,
            )
            result = cast(CursorResult[Any], await session.execute(stmt))
            await session.commit()
            return result.rowcount > 0

    async def resolve_conflicts(
        self,
        user_id: str,
        key: str,
        strategy: str = "latest",  # "latest", "highest_confidence", "merge"
    ) -> GlobalMemoryEntry | None:
        """Resolve conflicts when multiple sessions contribute to the same key."""
        entries = await self.retrieve(user_id, key=key, min_confidence=0.0)
        if not entries:
            return None

        if strategy == "latest":
            winner = max(entries, key=lambda e: e.last_accessed)
        elif strategy == "highest_confidence":
            winner = max(entries, key=lambda e: e.confidence)
        elif strategy == "merge":
            # Merge values (assumes dict values)
            merged_value = {}
            for entry in entries:
                if isinstance(entry.value, dict):
                    merged_value.update(entry.value)
            winner = entries[0]
            winner.value = merged_value
            winner.confidence = sum(e.confidence for e in entries) / len(entries)
        else:
            winner = entries[0]

        # Delete losers
        for entry in entries:
            if entry.id != winner.id:
                await self.delete(user_id, entry.key)

        return winner

    async def cleanup_expired(self, max_age_days: int = 90) -> int:
        """Remove entries older than max_age_days."""
        cutoff = time.time() - (max_age_days * 86400)
        factory = get_session_factory()
        async with factory() as session:
            stmt = delete(GlobalMemoryDB).where(GlobalMemoryDB.created_at < cutoff)
            result = cast(CursorResult[Any], await session.execute(stmt))
            await session.commit()
            return result.rowcount

    def _db_to_entry(self, db_obj: Any) -> GlobalMemoryEntry:
        """Convert DB object to GlobalMemoryEntry."""
        return GlobalMemoryEntry(
            id=db_obj.id,
            user_id=db_obj.user_id,
            key=db_obj.key,
            value=json.loads(db_obj.value) if db_obj.value else None,
            confidence=db_obj.confidence,
            source_sessions=db_obj.source_sessions or [],
            created_at=db_obj.created_at,
            last_accessed=db_obj.last_accessed,
            access_count=db_obj.access_count,
            decay_rate=db_obj.decay_rate,
            metadata=db_obj.metadata_json or {},
        )


# Singleton instance
_global_memory_store: GlobalMemoryStore | None = None


def get_global_memory_store() -> GlobalMemoryStore:
    """Get the global memory store singleton."""
    global _global_memory_store
    if _global_memory_store is None:
        _global_memory_store = GlobalMemoryStore()
    return _global_memory_store


from orm.global_memory import GlobalMemoryDB  # noqa: E402
