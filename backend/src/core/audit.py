"""Audit log helper — write audit entries for management CRUD operations.

Extracted from database to eliminate three-layer violations
(routers were importing from database.py directly for log_audit).

Usage:
    from core.audit import log_audit
    await log_audit("create", "agent", "my-agent", "创建成功")

User/ip are captured automatically from the request context: the auth
middleware calls ``set_audit_context`` per request, so call sites do not
need to thread current_user/request through every router.
"""

from contextvars import ContextVar

from repository.audit import create_audit_entry

_audit_ctx: ContextVar[dict[str, str]] = ContextVar("audit_ctx", default={})


def set_audit_context(user_name: str = "", client_ip: str = "") -> None:
    """Set the current request's audit identity (called by auth middleware)."""
    _audit_ctx.set({"user_name": user_name, "client_ip": client_ip})


async def log_audit(
    action: str,
    entity_type: str,
    entity_name: str = "",
    detail: str = "",
    user_name: str = "",
    client_ip: str = "",
) -> None:
    ctx = _audit_ctx.get()
    await create_audit_entry(
        action=action,
        entity_type=entity_type,
        entity_name=entity_name,
        detail=detail,
        user_name=user_name or ctx.get("user_name", ""),
        client_ip=client_ip or ctx.get("client_ip", ""),
    )
