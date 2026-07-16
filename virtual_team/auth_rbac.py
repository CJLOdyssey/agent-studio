"""RBAC user types, dependencies, and public-route configuration.

Provides ``CurrentUser``, ``get_current_user``, ``require_role``, ``get_user_id``,
and constants ``PUBLIC_PATHS`` / ``PUBLIC_PREFIXES``.
"""

import os
from dataclasses import dataclass, field

from fastapi import Depends, HTTPException, Request, status

from virtual_team.auth_jwt import AUTH_SECRET, decode_jwt
from virtual_team.logging_config import get_logger

logger = get_logger(__name__)

AUTH_ENABLED = os.environ.get("AUTH_ENABLED", "0") == "1"
AUTH_MODE = os.environ.get("AUTH_MODE", "legacy")


# ── RBAC Data Types ──────────────────────────────────────────────────────────


@dataclass
class CurrentUser:
    """Authenticated user context passed through FastAPI dependencies."""

    id: str = "admin"
    username: str = "admin"
    email: str = "admin@legacy.local"
    roles: list[str] = field(default_factory=lambda: ["admin"])


# ── RBAC Dependencies ────────────────────────────────────────────────────────


async def get_current_user(request: Request) -> CurrentUser:
    """FastAPI dependency — resolves the current user.

    In ``legacy`` mode returns a fixed admin user without any DB query.
    In ``rbac`` mode uses the JWT-decoded user_id (from middleware or self-decoded).
    Raises 401 when no valid JWT token is present.
    """
    if AUTH_MODE == "legacy":
        return CurrentUser()

    # Try middleware-decoded user_id first (set by AuthMiddleware for non-auth routes)
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        # AuthMiddleware skips /api/auth/* routes, so decode the JWT here
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            payload = decode_jwt(auth_header[7:], AUTH_SECRET)
            if payload:
                user_id = payload.get("sub", "")
    if not user_id:
        logger.warning(
            "Auth missing token | client=%s",
            request.client.host if request.client else "?",
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未提供认证令牌")

    try:
        from sqlalchemy import select

        from virtual_team.database import RoleDB, UserDB, UserRoleDB, get_session_factory

        factory = get_session_factory()
        async with factory() as session:
            stmt = select(UserDB).where(UserDB.id == user_id)
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()
            if user is not None:
                role_stmt = (
                    select(RoleDB.name)
                    .join(UserRoleDB, RoleDB.id == UserRoleDB.role_id)
                    .where(UserRoleDB.user_id == user.id)
                )
                role_result = await session.execute(role_stmt)
                roles = [row[0] for row in role_result.all()]
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


async def require_role(*names: str):
    """Require the current user to have at least one of the named roles.

    Dependency factory — returns a 403 if none match.

    Usage::

        @router.post("/agents")
        async def create(
            req: AgentCreateRequest,
            user: CurrentUser = Depends(require_role("admin", "manager")),
        ): ...
    """

    async def _role_checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:  # noqa: B008
        if AUTH_MODE == "legacy":
            return current_user
        if not any(r in current_user.roles for r in names):
            logger.warning(
                "Auth role denied | user=%s | roles=%s | required=%s",
                current_user.username, current_user.roles, list(names),
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return current_user

    return _role_checker


# Routes exempt from authentication
PUBLIC_PATHS = {
    "/api/health",
    "/api/metrics",
    "/docs",
    "/openapi.json",
    "/redoc",
}
PUBLIC_PREFIXES = ("/ws/", "/api/auth/")


def get_user_id(request) -> str:
    """Extract user identity from the authenticated request.

    Priority: auth middleware (request.state.user_id) → X-User-ID header (dev) → 'anonymous'
    """
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return user_id
    return request.headers.get("X-User-ID", "anonymous")
