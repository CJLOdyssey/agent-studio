"""
JWT authentication middleware for FastAPI.

Validates Bearer tokens on protected routes. Tokens are expected to be
signed with HS256 using a server-side secret (AUTH_SECRET env var).

Public routes (health, WebSocket upgrade) are exempt from authentication.

RBAC integration
----------------
- ``get_current_user`` is a FastAPI ``Depends`` callable that returns a
  ``CurrentUser`` dataclass (id, username, roles).
- ``require_role(*names)`` is a dependency factory that asserts the
  current user has at least one of the named roles.
- ``AUTH_MODE=legacy`` (default): returns a fixed admin user without DB lookup.
- ``AUTH_MODE=rbac``: decodes JWT → looks up ``UserDB`` → checks roles.
"""

import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass, field

from fastapi import Depends, HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware

from virtual_team.logging_config import get_logger

logger = get_logger(__name__)

AUTH_SECRET = os.environ.get("AUTH_SECRET", "")
AUTH_ENABLED = os.environ.get("AUTH_ENABLED", "0") == "1"
AUTH_MODE = os.environ.get("AUTH_MODE", "legacy")


# ── RBAC Data Types ──────────────────────────────────────────────────────────


@dataclass
class CurrentUser:
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
                return CurrentUser(
                    id=user.id,
                    username=user.username,
                    email=user.email,
                    roles=roles or ["member"],
                )
    except Exception:
        logger.warning("RBAC user lookup failed", exc_info=True)

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或令牌无效")


async def require_role(*names: str):
    """Dependency factory — requires the current user to have at least one
    of the named roles. Returns a 403 if none match.

    Usage::

        @router.post("/agents")
        async def create(
            req: AgentCreateRequest,
            user: CurrentUser = Depends(require_role("admin", "manager")),
        ): ...
    """

    async def _role_checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:  # noqa: B008  # noqa: B008
        if AUTH_MODE == "legacy":
            return current_user
        if not any(r in current_user.roles for r in names):
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


def _base64url_decode(data: str) -> bytes:
    """Decode base64url-encoded string with padding fix."""
    rem = len(data) % 4
    if rem:
        data += "=" * (4 - rem)
    return base64.urlsafe_b64decode(data)


def decode_jwt(token: str, secret: str) -> dict | None:
    """Decode and verify a JWT token.

    Returns the payload dict if valid, None otherwise.
    Handles both HS256 and a simplified HMAC format.
    """
    if not secret:
        return None

    try:
        # Standard JWT: header.payload.signature
        parts = token.split(".")
        if len(parts) == 3:
            header_b64, payload_b64, sig_b64 = parts
            signed_data = f"{header_b64}.{payload_b64}"

            expected_sig = hmac.new(
                secret.encode(),
                signed_data.encode(),
                hashlib.sha256,
            ).digest()
            expected_sig_b64 = base64.urlsafe_b64encode(expected_sig).rstrip(b"=").decode()

            if not hmac.compare_digest(sig_b64, expected_sig_b64):
                return None

            payload = json.loads(_base64url_decode(payload_b64))

            # Check expiration
            exp = payload.get("exp", 0)
            if exp and int(time.time()) > exp:
                return None

            return payload

        # Simplified token: HMAC-SHA256 of user_id:timestamp
        if len(parts) == 1:
            try:
                raw = _base64url_decode(token).decode()
                user_id, ts_str, provided_sig = raw.rsplit(":", 2)
                expected = hmac.new(
                    secret.encode(),
                    f"{user_id}:{ts_str}".encode(),
                    hashlib.sha256,
                ).hexdigest()[:16]
                if not hmac.compare_digest(provided_sig, expected):
                    return None
                if int(ts_str) < int(time.time()) - 86400:
                    return None
                return {"sub": user_id, "iat": int(ts_str)}
            except (ValueError, UnicodeDecodeError):
                return None

    except Exception:
        logger.warning("JWT decode error", exc_info=True)

    return None


def get_user_id(request) -> str:
    """Extract user identity from the authenticated request.

    Priority: auth middleware (request.state.user_id) → X-User-ID header (dev) → 'anonymous'
    """
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return user_id
    return request.headers.get("X-User-ID", "anonymous")


def create_token(user_id: str, secret: str, ttl: int = 86400) -> str:
    """Create a simple JWT token for the given user_id."""
    now = int(time.time())
    header = (
        base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        .rstrip(b"=")
        .decode()
    )
    payload = (
        base64.urlsafe_b64encode(
            json.dumps({"sub": user_id, "iat": now, "exp": now + ttl}).encode()
        )
        .rstrip(b"=")
        .decode()
    )

    signed_data = f"{header}.{payload}"
    signature = (
        base64.urlsafe_b64encode(
            hmac.new(secret.encode(), signed_data.encode(), hashlib.sha256).digest()
        )
        .rstrip(b"=")
        .decode()
    )

    return f"{signed_data}.{signature}"


class AuthMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware that validates JWT tokens on protected routes."""

    async def dispatch(self, request: Request, call_next):
        # Skip auth for public paths
        path = request.url.path
        if path in PUBLIC_PATHS or path.startswith(PUBLIC_PREFIXES):
            return await call_next(request)

        # Skip if auth is not enabled
        if not AUTH_ENABLED:
            return await call_next(request)

        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization", "")
        token = ""
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        elif "?" in str(request.url) and "token=" in str(request.url):
            # Also support query param for WebSocket
            from urllib.parse import parse_qs

            token = parse_qs(str(request.url.query)).get("token", [""])[0]

        # ── Guest mode: no token → pass through as unauthenticated ────
        if not token:
            request.state.is_authenticated = False
            return await call_next(request)

        payload = decode_jwt(token, AUTH_SECRET)
        if payload is None:
            request.state.is_authenticated = False
            return await call_next(request)

        # Attach user info to request state
        request.state.user_id = payload.get("sub", "unknown")
        request.state.is_authenticated = True

        return await call_next(request)
