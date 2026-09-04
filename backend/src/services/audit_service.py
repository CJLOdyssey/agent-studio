"""审计日志服务 —— 为管理类 CRUD 操作写入审计记录。

用法：
    from services.audit_service import log_audit
    await log_audit("create", "agent", "my-agent", "创建成功")

用户 / IP 从请求上下文自动获取：auth 中间件每个请求调用 ``set_audit_context``，
因此调用点无需在每个路由间传递 current_user/request。
"""

from contextvars import ContextVar
from typing import Any

from repository.audit import create_audit_entry

_audit_ctx: ContextVar[dict[str, str] | None] = ContextVar("audit_ctx", default=None)


def set_audit_context(
    user_name: str = "",
    client_ip: str = "",
    user_agent: str = "",
    request_id: str = "",
) -> None:
    """设置当前请求的审计身份（由 auth 中间件调用）。"""
    _audit_ctx.set(
        {
            "user_name": user_name,
            "client_ip": client_ip,
            "user_agent": user_agent,
            "request_id": request_id,
        }
    )


async def log_audit(
    action: str,
    entity_type: str,
    entity_name: str = "",
    detail: str = "",
    user_name: str = "",
    client_ip: str = "",
    level: str = "info",
    before_snapshot: Any = None,
    after_snapshot: Any = None,
) -> None:
    """写入一条审计记录，用户/IP 缺省时从请求上下文补全。"""
    ctx = _audit_ctx.get() or {}
    await create_audit_entry(
        action=action,
        entity_type=entity_type,
        entity_name=entity_name,
        detail=detail,
        user_name=user_name or ctx.get("user_name", ""),
        client_ip=client_ip or ctx.get("client_ip", ""),
        level=level,
        before_snapshot=before_snapshot,
        after_snapshot=after_snapshot,
        user_agent=ctx.get("user_agent", ""),
        request_id=ctx.get("request_id", ""),
    )
