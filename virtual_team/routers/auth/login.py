"""Login, refresh token, and logout endpoints."""

from datetime import UTC, datetime
from typing import Any

import bcrypt
from fastapi import APIRouter, Depends, Request

from virtual_team.auth import AUTH_SECRET, CurrentUser, create_token, get_current_user
from virtual_team.broker import get_redis
from virtual_team.core.error_codes import ErrorCode, error_response
from virtual_team.core.logging_config import get_logger
from virtual_team.repository.auth import (
    consume_refresh_token,
    create_refresh_token,
    get_user_by_email,
    increment_failed_logins,
    reset_failed_logins,
)

from .schemas import (
    AuthResponse,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    _build_user_response,
    _check_rate_limit,
    _client_ip,
    _create_auth_response,
    _mask_email,
)

logger = get_logger(__name__)

router = APIRouter(tags=["auth"])


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, request: Request) -> Any:
    email = body.email.lower().strip()
    password = body.password
    r = get_redis()

    ip = _client_ip(request)
    rate_key_ip = f"auth:login:ip:{ip}"
    rate_key_email = f"auth:login:email:{email}"
    if not await _check_rate_limit(r, rate_key_ip, 10, 60):
        raise error_response(ErrorCode.RATE_LIMITED, detail="操作过于频繁，请稍后重试")
    if not await _check_rate_limit(r, rate_key_email, 5, 60):
        raise error_response(ErrorCode.RATE_LIMITED, detail="操作过于频繁，请稍后重试")

    user = await get_user_by_email(email)
    if user is None:
        raise error_response(ErrorCode.AUTH_UNAUTHORIZED, detail="邮箱或密码错误")

    if user.locked_until and user.locked_until > datetime.now(UTC):
        remaining = int((user.locked_until - datetime.now(UTC)).total_seconds())
        raise error_response(
            ErrorCode.AUTH_ACCOUNT_LOCKED,
            detail=f"账户已被临时锁定，请 {max(remaining, 60)} 秒后再试",
        )

    if not user.is_verified:
        raise error_response(ErrorCode.AUTH_EMAIL_NOT_VERIFIED, detail="请先验证邮箱")

    if not user.is_active:
        raise error_response(ErrorCode.AUTH_ACCOUNT_DISABLED, detail="账户已被禁用")

    if not bcrypt.checkpw(password.encode(), user.password_hash.encode()):
        await increment_failed_logins(email)
        raise error_response(ErrorCode.AUTH_UNAUTHORIZED, detail="邮箱或密码错误")

    await reset_failed_logins(email)
    logger.info("User logged in: %s", _mask_email(email))

    return await _create_auth_response(user.id, user.email, user.username, body.remember_me)


@router.post("/refresh", response_model=AuthResponse)
async def refresh(body: RefreshRequest) -> Any:
    user, family_id = await consume_refresh_token(body.refresh_token)
    if user is None:
        raise error_response(ErrorCode.AUTH_TOKEN_EXPIRED, detail="登录已过期，请重新登录")

    new_refresh_token_raw, _ = await create_refresh_token(
        user.id, family_id=family_id, ttl_days=7
    )
    access_token = create_token(user.id, AUTH_SECRET)
    user_resp = await _build_user_response(user.id, user.email, user.username)

    return AuthResponse(
        access_token=access_token,
        refresh_token=new_refresh_token_raw,
        expires_in=900,
        user=user_resp,
    )


@router.post("/logout", status_code=204)
async def logout(body: LogoutRequest, _user: CurrentUser = Depends(get_current_user)) -> None:
    await consume_refresh_token(body.refresh_token)
