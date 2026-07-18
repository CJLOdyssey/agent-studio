"""Audit log helper — write audit entries for management CRUD operations.

Extracted from backend.database to eliminate three-layer violations
(routers were importing from database.py directly for log_audit).

Usage:
    from backend.core.audit import log_audit
    await log_audit("create", "agent", "my-agent", "创建成功")
"""

from backend.core.infra.database import get_session_factory
from backend.orm import AuditLogDB


async def log_audit(
    action: str,
    entity_type: str,
    entity_name: str = "",
    detail: str = "",
) -> None:
    entry = AuditLogDB(
        action=action,
        entity_type=entity_type,
        entity_name=entity_name,
        detail=detail,
    )
    factory = get_session_factory()
    async with factory() as session:
        session.add(entry)
        await session.commit()
