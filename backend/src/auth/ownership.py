"""Resource ownership helpers — owner scoping when RBAC auth is enabled.

legacy 模式（AUTH_ENABLED=0）下用户标识只是命名空间而非安全边界，
helper 一律放行以保持既有行为；RBAC 模式（AUTH_ENABLED=1）下强制归属校验，
越权统一回 404（不暴露资源存在性，避免 ID 探测）。
"""

import os
from collections.abc import Awaitable, Callable
from typing import Any

from auth.auth_rbac import get_user_id
from core.error_codes import ErrorCode, error_response

GetResource = Callable[[str], Awaitable[Any]]


def auth_enabled() -> bool:
    """RBAC 生效（AUTH_ENABLED=1）时返回 True。"""
    return os.environ.get("AUTH_ENABLED", "0") == "1"


async def require_owned(
    request: Any,
    resource_id: str,
    get_resource: GetResource,
    *,
    owner_key: str = "owner_id",
    not_found: ErrorCode = ErrorCode.INVALID_REQUEST,
    allow_unowned: bool = True,
) -> Any:
    """Fetch ``get_resource(resource_id)`` and enforce ownership when RBAC is on.

    - 资源不存在 → 404（not_found）
    - legacy 模式 → 直接放行
    - RBAC 模式：匿名 / 非 owner → 404；owner 为空（共享/系统/历史资源）
      读放行，写操作（allow_unowned=False）→ 404
    """
    resource = await get_resource(resource_id)
    if resource is None:
        raise error_response(not_found, detail="资源不存在")
    if not auth_enabled():
        return resource
    user_id = get_user_id(request)
    if user_id == "anonymous":
        raise error_response(not_found, detail="资源不存在")
    owner = resource.get(owner_key) if isinstance(resource, dict) else getattr(resource, owner_key, None)
    if owner in (None, ""):
        if allow_unowned:
            return resource
        raise error_response(not_found, detail="资源不存在")
    if str(owner) != user_id:
        raise error_response(not_found, detail="资源不存在")
    return resource


async def require_run_owner(request: Any, run_id: str) -> Any:
    """Enforce that the caller owns the run's session (RBAC only).

    legacy 模式下不查询直接返回 None —— 调用方均有自己的存在性检查
    （如 run_service.get_run / get_run 返回 None 时 404）。
    RBAC 模式下返回 detached ProjectRun ORM row（仅列访问）。
    """
    if not auth_enabled():
        return None
    from repository import get_run, get_session

    run = await get_run(run_id)
    if run is None:
        raise error_response(ErrorCode.RUN_NOT_FOUND, detail="运行不存在")
    user_id = get_user_id(request)
    if user_id == "anonymous":
        raise error_response(ErrorCode.RUN_NOT_FOUND, detail="运行不存在")
    owner = None
    if run.session_id:
        sess = await get_session(run.session_id)
        owner = sess.user_id if sess else None
    if owner != user_id:
        raise error_response(ErrorCode.RUN_NOT_FOUND, detail="运行不存在")
    return run


async def ws_run_owner(websocket: Any, run_id: str) -> bool:
    """RBAC 模式下校验 WebSocket 订阅者对该 run 的归属。

    WebSocket 无法抛 HTTPException，返回 False 由调用方关闭连接（1008）。
    """
    if not auth_enabled():
        return True
    from auth.auth_jwt import AUTH_SECRET, decode_jwt

    token = websocket.cookies.get("access_token")
    user_id: str | None = None
    if token:
        payload = decode_jwt(token, AUTH_SECRET)
        if payload:
            user_id = str(payload.get("sub") or "") or None
    if not user_id:
        return False

    from repository import get_run, get_session

    run = await get_run(run_id)
    if run is None:
        return False
    owner = None
    if run.session_id:
        sess = await get_session(run.session_id)
        owner = str(sess.user_id) if sess and sess.user_id else None
    return owner == user_id
