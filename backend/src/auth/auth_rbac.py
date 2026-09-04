"""RBAC 用户类型、依赖与公开路由配置。

提供 ``CurrentUser``、``get_current_user``、``require_role``、``get_user_id``
以及常量 ``PUBLIC_PATHS`` / ``PUBLIC_PREFIXES``。
"""

import os
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from fastapi import Depends, HTTPException, Request, status

if TYPE_CHECKING:
    # 仅供类型检查器使用 —— 运行时采用延迟导入以避免循环依赖
    from orm.auth import RoleDB, UserDB, UserRoleDB

from auth.auth_jwt import AUTH_SECRET, decode_jwt
from core.infra.logging_config import get_logger

logger = get_logger(__name__)

AUTH_ENABLED = os.environ.get("AUTH_ENABLED", "0") == "1"
AUTH_MODE = os.environ.get("AUTH_MODE", "legacy")
AUTH_REQUIRE_LOGIN = os.environ.get("AUTH_REQUIRE_LOGIN", "0") == "1"

# RBAC 模式下在导入时校验 AUTH_SECRET
if AUTH_MODE == "rbac" and AUTH_ENABLED and AUTH_SECRET == "":
    raise RuntimeError(
        "AUTH_MODE=rbac and AUTH_ENABLED=1 requires AUTH_SECRET to be set "
        "(minimum 32 characters). Set it via environment variable."
    )
if AUTH_MODE == "rbac" and AUTH_ENABLED and len(AUTH_SECRET) < 32:
    raise RuntimeError(
        "AUTH_SECRET must be at least 32 characters for RBAC mode. "
        f"Current length: {len(AUTH_SECRET)}"
    )


# ── RBAC 数据类型 ──────────────────────────────────────────────────────────


@dataclass
class CurrentUser:
    """通过 FastAPI 依赖传递的已认证用户上下文。"""

    id: str = "admin"
    username: str = "admin"
    email: str = "admin@example.com"
    roles: list[str] = field(default_factory=lambda: ["admin"])


# ── RBAC 依赖 ────────────────────────────────────────────────────────


async def get_current_user(request: Request) -> CurrentUser:
    """FastAPI 依赖 —— 解析当前用户。

    ``legacy`` 模式下不做任何数据库查询，返回固定 admin 用户。
    ``rbac`` 模式使用 JWT 解码出的 user_id（来自中间件或自行解码）。
    无有效 JWT token 时抛出 401。
    """
    # 调用时读取而非导入时：测试夹具在本模块可能已被导入之后、请求之前设置 AUTH_MODE。
    if os.environ.get("AUTH_MODE", "legacy") == "legacy":
        return CurrentUser()

    # 优先使用中间件解码的 user_id（由 AuthMiddleware 为非 auth 路由设置）
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        # AuthMiddleware 跳过 /api/auth/* 路由，因此在此解码 JWT。
        # 优先级：Authorization Bearer 响应头（legacy）→ access_token httpOnly cookie。
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            payload = decode_jwt(auth_header[7:], AUTH_SECRET)
            if payload:
                user_id = payload.get("sub", "")
    if not user_id:
        # 回退到 httpOnly cookie（由登录/注册/验证/刷新端点设置）
        token = request.cookies.get("access_token")
        if token:
            payload = decode_jwt(token, AUTH_SECRET)
            if payload:
                user_id = payload.get("sub", "")
    if not user_id:
        logger.warning(
            "Auth missing token | client=%s",
            request.client.host if request.client else "?",
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未提供认证令牌")

    try:
        from repository.auth import get_user_by_id, get_user_roles

        user = await get_user_by_id(user_id)
        if user is not None:
            roles = await get_user_roles(user.id)
            logger.info(
                "Auth login success | user=%s | roles=%s | client=%s",
                user.username, roles,
                request.client.host if request.client else "?",
            )
            return CurrentUser(
                id=user.id,
                username=user.username,
                email=user.email,
                roles=roles or ["member"],
            )
        logger.warning(
            "Auth user not found | user_id=%s", user_id,
        )
    except Exception:
        logger.warning("RBAC user lookup failed", exc_info=True)

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或令牌无效")


def require_role(*names: str) -> Any:
    """要求当前用户至少拥有所列角色之一。

    依赖工厂 —— 无一匹配则返回 403。

    Usage::

        @router.post("/agents")
        async def create(
            req: AgentCreateRequest,
            user: CurrentUser = Depends(require_role("admin", "manager")),
        ): ...
    """

    def _role_checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:  # noqa: B008
        if os.environ.get("AUTH_MODE", "legacy") == "legacy":
            return current_user
        if not any(r in current_user.roles for r in names):
            logger.warning(
                "Auth role denied | user=%s | roles=%s | required=%s",
                current_user.username, current_user.roles, list(names),
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return current_user

    return _role_checker


# 豁免认证的路由
PUBLIC_PATHS = {
    "/api/health",
    "/api/metrics",
    "/docs",
    "/openapi.json",
    "/redoc",
}
PUBLIC_PREFIXES = ("/api/ws/", "/api/auth/")


def get_user_id(request: Any) -> str:
    """从已认证请求提取用户身份。

    优先级：auth 中间件（request.state.user_id）→ JWT cookie → 'anonymous'。
    ``X-User-ID`` 响应头仅在 legacy/guest 模式（认证禁用）下可信，此时它是
    guest 数据命名空间，而非安全边界。认证启用时，未认证请求解析为 ``anonymous``。
    """
    user_id: str | None = getattr(request.state, "user_id", None)
    if user_id:
        return user_id

    # JWT 有效但 sub 指向已删除/合并的用户（AuthMiddleware 已标记）——
    # 不信任该身份，回退 anonymous，避免误导性 400（key/附件按 user 归属）。
    if getattr(request.state, "user_invalid_token", False) and AUTH_ENABLED:
        return "anonymous"

    # 检查 httpOnly access_token cookie（由登录/注册/验证/刷新端点设置）
    token = request.cookies.get("access_token")
    if token:
        payload = decode_jwt(token, AUTH_SECRET)
        if payload:
            uid = payload.get("sub")
            if isinstance(uid, str) and uid:
                return uid

    if AUTH_ENABLED:
        logger.warning("Unauthenticated ownership access | path=%s", request.url.path)
        return "anonymous"

    return str(request.headers.get("X-User-ID", "anonymous"))
