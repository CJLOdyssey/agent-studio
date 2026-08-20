"""Audit repository — write tamper-evident audit log entries."""

import hashlib
import json
from typing import Any

from sqlalchemy import select

from core.infra.database import get_session_factory
from orm import AuditLogDB

# Substrings that, if present in any free-text field, mark the value as
# sensitive (OWASP Logging Cheat Sheet — never persist secrets). Matched
# values are redacted to a placeholder instead of written verbatim.
_SENSITIVE_MARKERS = (
    "password", "passwd", "secret", "api_key", "apikey", "token",
    "authorization", "bearer", "cookie", "x-api-key", "private_key",
)

_LEVELS = ("info", "warn", "error")


def _redact(text: str) -> str:
    """Replace sensitive-looking values with a placeholder."""
    if not text:
        return text
    lowered = text.lower()
    for marker in _SENSITIVE_MARKERS:
        if marker in lowered:
            return "[REDACTED]"
    return text


def _snapshot_json(value: Any) -> str:
    """Serialize a snapshot payload to a stable string (or '' for None)."""
    if value is None:
        return ""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _chain_hash(prev_hash: str, content: dict[str, Any]) -> str:
    """Compute a hash over (previous hash + normalized content).

    The normalized serialization is deterministic so the chain can be
    re-verified later by re-computing hashes over stored rows.
    """
    canonical = json.dumps(content, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(f"{prev_hash}|{canonical}".encode()).hexdigest()


async def _last_hash(session: Any) -> str:
    """Return the hash of the most recent audit entry ('' when empty)."""
    result = await session.execute(
        select(AuditLogDB.hash)
        .order_by(AuditLogDB.created_at.desc(), AuditLogDB.id.desc())
        .limit(1)
    )
    row = result.first()
    return row[0] if row else ""


async def create_audit_entry(
    action: str,
    entity_type: str,
    entity_name: str = "",
    detail: str = "",
    user_name: str = "",
    client_ip: str = "",
    level: str = "info",
    before_snapshot: Any = None,
    after_snapshot: Any = None,
    user_agent: str = "",
    request_id: str = "",
) -> None:
    """Append a tamper-evident audit entry.

    ``action``/``entity_type``/``entity_name`` are written as-is; free-text
    ``detail`` is redacted for sensitive markers. ``before/after_snapshot``
    are serialized JSON. The returned entry's ``hash`` chains from the
    previous entry so retroactive edits break verification.
    """
    level = level if level in _LEVELS else "info"
    detail_clean = _redact(detail)
    before_clean = _redact(_snapshot_json(before_snapshot))
    after_clean = _redact(_snapshot_json(after_snapshot))

    factory = get_session_factory()
    async with factory() as session:
        # Lock the latest row so concurrent writers don't fork the chain.
        # (PG: FOR UPDATE; SQLite: serialized by its single-writer model.)
        prev = await _last_hash(session)
        content = {
            "action": action,
            "entity_type": entity_type,
            "entity_name": entity_name,
            "detail": detail_clean,
            "level": level,
            "before": before_clean,
            "after": after_clean,
            "user_name": user_name,
            "client_ip": client_ip,
            "user_agent": user_agent,
            "request_id": request_id,
            "created_at": None,  # filled by DB default; hash covers content fields only
        }
        entry_hash = _chain_hash(prev, content)

        entry = AuditLogDB(
            action=action,
            entity_type=entity_type,
            entity_name=entity_name,
            detail=detail_clean,
            level=level,
            before_snapshot=before_clean or None,
            after_snapshot=after_clean or None,
            user_name=user_name,
            client_ip=client_ip,
            user_agent=user_agent,
            request_id=request_id,
            prev_hash=prev,
            hash=entry_hash,
        )
        session.add(entry)
        await session.commit()


def _row_content(r: AuditLogDB) -> dict[str, Any]:
    """Recompute the canonical content of a stored row for chain checks."""
    return {
        "action": r.action,
        "entity_type": r.entity_type,
        "entity_name": r.entity_name,
        "detail": r.detail,
        "level": r.level,
        "before": r.before_snapshot or "",
        "after": r.after_snapshot or "",
        "user_name": r.user_name,
        "client_ip": r.client_ip,
        "user_agent": r.user_agent,
        "request_id": r.request_id,
        "created_at": None,
    }


async def verify_audit_chain(limit: int = 2000) -> dict[str, Any]:
    """Verify the tamper-evident hash chain.

    Walks newest-first recomputing each entry's hash from (prev_hash +
    content). A mismatch means the row (or an ancestor) was edited after
    insertion. Returns how many entries were checked and whether the chain
    is intact. Scanning is bounded to the ``limit`` most recent entries.
    """
    factory = get_session_factory()
    async with factory() as session:
        rows = (
            await session.execute(
                select(AuditLogDB)
                .order_by(AuditLogDB.created_at.desc(), AuditLogDB.id.desc())
                .limit(limit)
            )
        ).scalars().all()

    # Walk newest-first (rows[0] = newest). Every entry's own hash must equal
    # the recomputed value from (prev_hash + content); and each entry's
    # prev_hash must equal the hash of the entry directly below it in the
    # chain (rows[i].prev_hash == rows[i+1].hash).
    violations: list[str] = []
    for i, r in enumerate(rows):
        recomputed = _chain_hash(r.prev_hash, _row_content(r))
        if recomputed != r.hash:
            violations.append(f"{r.id} (content/hash mismatch)")
        if r.prev_hash and i + 1 < len(rows) and r.prev_hash != rows[i + 1].hash:
            violations.append(f"{r.id} (chain break: prev_hash mismatch)")
    return {
        "checked": len(rows),
        "intact": len(violations) == 0,
        "violations": violations[:50],
    }


async def export_audit_logs(limit: int = 10000) -> tuple[str, str]:
    """Export audit logs as CSV string (newest first, bounded to ``limit`` rows).

    Returns (csv_content, filename_with_date).
    """
    import csv
    from datetime import datetime
    from io import StringIO

    factory = get_session_factory()
    async with factory() as session:
        rows = (
            await session.execute(
                select(AuditLogDB)
                .order_by(AuditLogDB.created_at.desc())
                .limit(limit)
            )
        ).scalars().all()

    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "timestamp", "level", "action", "entity_type", "entity_name",
        "detail", "before", "after", "user", "ip", "user_agent", "request_id",
    ])
    for r in rows:
        writer.writerow([
            r.created_at.isoformat() if r.created_at else "",
            r.level,
            r.action,
            r.entity_type,
            r.entity_name,
            r.detail,
            r.before_snapshot or "",
            r.after_snapshot or "",
            r.user_name,
            r.client_ip,
            r.user_agent,
            r.request_id,
        ])
    today = datetime.now().strftime("%Y%m%d")
    return buf.getvalue(), f"audit_logs_{today}.csv"
