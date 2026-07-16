"""Shared Pydantic schemas and helpers for the auth sub-package."""

import secrets

from fastapi import Request
from pydantic import BaseModel, EmailStr

from virtual_team.auth import AUTH_SECRET, create_token
from virtual_team.repository.auth import create_refresh_token, get_user_by_id, get_user_roles

# ── Request schemas ─────────────────────────────────────────────────


class SendRegisterCodeRequest(BaseModel):
    email: EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    code: str
    password: str


class VerifyRequest(BaseModel):
    email: EmailStr
    code: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str


class LogoutRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class MergeRequest(BaseModel):
    guest_id: str


# ── Response schemas ────────────────────────────────────────────────


class UserResponse(BaseModel):
    id: str
    email: str
    username: str | None
    roles: list[str]
    is_verified: bool


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class AuthConfigResponse(BaseModel):
    enabled: bool
    mode: str


class MessageResponse(BaseModel):
    message: str


class EmailHintResponse(BaseModel):
    message: str
    email_hint: str


# ── Helpers ─────────────────────────────────────────────────────────


def _generate_code() -> str:
    return f"{secrets.randbelow(1000000):06d}"


def _mask_email(email: str) -> str:
    """Mask email for display: u***@example.com."""
    local, at, domain = email.partition("@")
    if len(local) <= 1:
        return f"{local}***{at}{domain}"
    return f"{local[0]}***{at}{domain}"


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _check_rate_limit(r, key: str, max_count: int, window: int = 60) -> bool:
    current = await r.incr(key)
    if current == 1:
        await r.expire(key, window)
    return current <= max_count


async def _store_code_in_redis(r, key: str, code: str, ttl: int) -> None:
    await r.set(key, code)
    await r.expire(key, ttl)


# ── Auth response builders (shared across sub-modules) ──────────────


async def _build_user_response(user_id: str, email: str, username: str | None) -> UserResponse:
    roles = await get_user_roles(user_id)
    user = await get_user_by_id(user_id)
    return UserResponse(
        id=user_id,
        email=email,
        username=username,
        roles=roles,
        is_verified=user.is_verified if user else False,
    )


async def _create_auth_response(
    user_id: str, email: str, username: str | None, remember_me: bool = False
) -> AuthResponse:
    access_token = create_token(user_id, AUTH_SECRET)
    ttl_days = 30 if remember_me else 7
    refresh_token_raw, _ = await create_refresh_token(user_id, ttl_days=ttl_days)
    user_resp = await _build_user_response(user_id, email, username)
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token_raw,
        expires_in=900,
        user=user_resp,
    )
