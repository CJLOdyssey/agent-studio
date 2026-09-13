"""auth 子包的共享 Pydantic 模式与辅助函数。"""

import logging
import os
import secrets
from typing import TYPE_CHECKING, Any

from fastapi import Request
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr
from redis.asyncio import Redis as _AsyncRedis

if TYPE_CHECKING:
    AsyncRedis = _AsyncRedis[Any]
else:
    AsyncRedis = _AsyncRedis

from auth import AUTH_SECRET, create_token
from repository.auth import create_refresh_token, get_user_by_id, get_user_roles

logger = logging.getLogger(__name__)

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
    """刷新令牌经 httpOnly cookie 传递 —— 请求体有意留空。"""


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str


class LogoutRequest(BaseModel):
    """登出读取 httpOnly cookie 中的刷新令牌 —— 请求体有意留空。"""


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
    """为展示脱敏邮箱：u***@example.com。"""
    local, at, domain = email.partition("@")
    if len(local) <= 1:
        return f"{local}***{at}{domain}"
    return f"{local[0]}***{at}{domain}"


def _client_ip(request: Request) -> str:
    """解析客户端 IP 用于限流键。

    仅当部署在可信反向代理之后（``TRUST_PROXY_HEADERS=1``）才信任
    ``X-Forwarded-For``；直接暴露时必须使用对端地址，否则攻击者可伪造
    该头绕过 IP 限流。
    """
    if os.environ.get("TRUST_PROXY_HEADERS", "0") in ("1", "true", "yes"):
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _check_rate_limit(r: AsyncRedis, key: str, max_count: int, window: int = 60) -> bool:
    """递增并检查限流计数；Redis 故障时降级放行（可用性优先）。"""
    try:
        current = await r.incr(key)
        if current == 1:
            await r.expire(key, window)
        return bool(current <= max_count)
    except Exception:
        logger.warning("Rate limit Redis check failed — allowing request")
        return True


async def _store_code_in_redis(r: AsyncRedis, key: str, code: str, ttl: int) -> None:
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


ACCESS_TOKEN_TTL = 900  # 15 分钟 —— 短生命周期访问令牌（业界最佳实践）


def _cookie_secure(request: Request) -> bool:
    """access/refresh cookie 是否需要 Secure 标志。

    开发（``DEV_MODE=1``）在纯 http 上运行 —— Secure cookie 会被浏览器
    静默丢弃（幽灵登录），因此显式关闭。生产按请求协议判定，并信任反向
    代理转发的 ``X-Forwarded-Proto``，否则 TLS 终止于代理时 cookie 会
    静默失去 Secure，令牌以明文发送。
    """
    if os.environ.get("DEV_MODE", "") == "1":
        return False
    if request.url.scheme == "https":
        return True
    forwarded = request.headers.get("X-Forwarded-Proto")
    return "https" in (forwarded or "").lower().split(",")


def _set_access_token_cookie(response: Response, access_token: str, *, secure: bool) -> None:
    """将访问令牌设为 httpOnly cookie（防 XSS 窃取）。

    cookie 为 httpOnly（JS 不可访问）、SameSite=Lax（对顶层导航 CSRF 安全）。
    ``secure`` 跟随请求 scheme（https → Secure；http 开发 → 无 Secure 标志，
    否则 http 客户端会静默丢弃 cookie，前端陷入「幽灵登录」：请求以匿名运行
    而 UI 仍显示用户）。路径限定到 ``/api``，使令牌只发给 API 端点，
    而非静态资源或不相关路由。
    """
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=secure,
        max_age=ACCESS_TOKEN_TTL,
        path="/api",
    )


def _clear_access_token_cookie(response: Response) -> None:
    """登出时清除 access_token httpOnly cookie。"""
    response.set_cookie(
        key="access_token",
        value="",
        httponly=True,
        samesite="lax",
        max_age=0,
        path="/api",
    )


REFRESH_TOKEN_TTL = 7 * 86400  # 7 天 —— 与 create_refresh_token 默认 ttl_days=7 一致


def _refresh_ttl_seconds(remember_me: bool) -> int:
    """刷新令牌有效期（秒）：remember_me 30 天，否则 7 天。"""
    return 30 * 86400 if remember_me else REFRESH_TOKEN_TTL


def _set_refresh_token_cookie(
    response: Response,
    refresh_token: str,
    *,
    secure: bool,
    max_age: int = REFRESH_TOKEN_TTL,
) -> None:
    """将刷新令牌设为 httpOnly cookie（防 XSS 窃取）。

    httpOnly（JS 不可访问）+ SameSite=Lax（对顶层导航 CSRF 安全）。
    路径限定到 ``/api``，仅由 refresh/logout 端点服务端读取。
    """
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=secure,
        max_age=max_age,
        path="/api",
    )


def _clear_refresh_token_cookie(response: Response) -> None:
    """登出时清除 refresh_token httpOnly cookie。"""
    response.set_cookie(
        key="refresh_token",
        value="",
        httponly=True,
        samesite="lax",
        max_age=0,
        path="/api",
    )


async def _create_auth_response(
    user_id: str, email: str, username: str | None, remember_me: bool = False
) -> AuthResponse:
    access_token = create_token(user_id, AUTH_SECRET, ttl=ACCESS_TOKEN_TTL)
    ttl_days = 30 if remember_me else 7
    refresh_token_raw, _ = await create_refresh_token(user_id, ttl_days=ttl_days)
    user_resp = await _build_user_response(user_id, email, username)
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token_raw,
        expires_in=ACCESS_TOKEN_TTL,
        user=user_resp,
    )
