"""Authentication router — register, login, user info."""

import secrets
from datetime import UTC, datetime

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from virtual_team.auth import AUTH_SECRET, CurrentUser, create_token, get_current_user
from virtual_team.broker import get_redis
from virtual_team.email_service import (
    build_password_changed_email,
    build_reset_email,
    build_verification_email,
    send_email,
)
from virtual_team.logging_config import get_logger
from virtual_team.password_policy import validate_password
from virtual_team.repository.auth import (
    consume_refresh_token,
    create_refresh_token,
    create_user,
    get_user_by_email,
    get_user_by_id,
    get_user_roles,
    increment_failed_logins,
    mark_user_verified,
    reset_failed_logins,
    revoke_all_user_tokens,
    update_password,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Redis key helpers ─────────────────────────────────────────────────────


def _verify_key(email: str) -> str:
    return f"auth:verify:{email.lower()}"


def _reset_key(email: str) -> str:
    return f"auth:reset:{email.lower()}"


def _fail_key(email: str) -> str:
    return f"auth:fail:{email.lower()}"


# ── Schemas ────────────────────────────────────────────────────────────────


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


# ── Helpers ────────────────────────────────────────────────────────────────


def _generate_code() -> str:
    return f"{secrets.randbelow(1000000):06d}"


def _mask_email(email: str) -> str:
    """Mask email for display: u***@example.com"""
    local, at, domain = email.partition("@")
    if len(local) <= 1:
        return f"{local}***{at}{domain}"
    return f"{local[0]}***{at}{domain}"


async def _store_code_in_redis(r, key: str, code: str, ttl: int) -> None:
    await r.set(key, code)
    await r.expire(key, ttl)


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


async def _build_user_response(user_id: str, email: str, username: str | None) -> UserResponse:
    roles = await get_user_roles(user_id)
    from virtual_team.repository.auth import get_user_by_id

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


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/config", response_model=AuthConfigResponse)
async def auth_config():
    from virtual_team.auth import AUTH_ENABLED, AUTH_MODE

    return AuthConfigResponse(enabled=AUTH_ENABLED, mode=AUTH_MODE)


@router.post("/send-register-code", status_code=200, response_model=EmailHintResponse)
async def send_register_code(body: SendRegisterCodeRequest, request: Request):
    email = body.email.lower().strip()
    r = get_redis()

    ip = _client_ip(request)
    rate_key = f"auth:send-register-code:ip:{ip}"
    if not await _check_rate_limit(r, rate_key, 3, 60):
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后重试")

    existing = await get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=409, detail="该邮箱已注册")

    code = _generate_code()
    verify_key = _verify_key(email)
    await _store_code_in_redis(r, verify_key, code, 300)

    subject, html = build_verification_email(code)
    await send_email(email, subject, html)

    email_hint = _mask_email(email)
    logger.info("Register code sent: %s", email_hint)
    return EmailHintResponse(
        message=f"验证码已发送到邮箱 {email_hint}",
        email_hint=email_hint,
    )


@router.post("/register", status_code=201, response_model=AuthResponse)
async def register(body: RegisterRequest, request: Request):
    email = body.email.lower().strip()
    code = body.code.strip()
    password = body.password
    r = get_redis()

    ip = _client_ip(request)
    rate_key = f"auth:register:ip:{ip}"
    if not await _check_rate_limit(r, rate_key, 3, 60):
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后重试")

    stored = await r.get(_verify_key(email))
    if stored is None:
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取验证码")

    attempts_key = f"auth:register:attempts:{email}"
    attempts = await r.incr(attempts_key)
    if attempts == 1:
        await r.expire(attempts_key, 300)
    if attempts > 3:
        await r.delete(_verify_key(email))
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取验证码")

    stored_code = stored.decode() if isinstance(stored, bytes) else stored
    if stored_code != code:
        raise HTTPException(status_code=400, detail="验证码错误")

    pwd_error = validate_password(password)
    if pwd_error:
        raise HTTPException(status_code=400, detail=pwd_error)

    existing = await get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=409, detail="该邮箱已注册")

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
    user = await create_user(email=email, password_hash=password_hash, is_verified=True)

    await r.delete(_verify_key(email))
    await r.delete(attempts_key)

    logger.info("User registered and verified: %s", _mask_email(email))
    return await _create_auth_response(user.id, user.email, user.username)


@router.post("/verify", response_model=AuthResponse)
async def verify(body: VerifyRequest, request: Request):
    email = body.email.lower().strip()
    code = body.code.strip()
    r = get_redis()

    ip = _client_ip(request)
    rate_key = f"auth:verify:ip:{ip}"
    if not await _check_rate_limit(r, rate_key, 5, 60):
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后重试")

    stored = await r.get(_verify_key(email))
    if stored is None:
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")

    attempts_key = f"auth:verify:attempts:{email}"
    attempts = await r.incr(attempts_key)
    if attempts == 1:
        await r.expire(attempts_key, 300)
    if attempts > 3:
        await r.delete(_verify_key(email))
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")

    stored_code = stored.decode() if isinstance(stored, bytes) else stored
    if stored_code != code:
        raise HTTPException(status_code=400, detail="验证码错误")

    await r.delete(_verify_key(email))
    await r.delete(attempts_key)

    user = await get_user_by_email(email)
    if user is None:
        raise HTTPException(status_code=400, detail="用户不存在")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="该邮箱已验证，请直接登录")

    await mark_user_verified(user.id)
    logger.info("Email verified: %s", _mask_email(email))

    return await _create_auth_response(user.id, user.email, user.username)


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, request: Request):
    email = body.email.lower().strip()
    password = body.password
    r = get_redis()

    ip = _client_ip(request)
    rate_key_ip = f"auth:login:ip:{ip}"
    rate_key_email = f"auth:login:email:{email}"
    if not await _check_rate_limit(r, rate_key_ip, 10, 60):
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后重试")
    if not await _check_rate_limit(r, rate_key_email, 5, 60):
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后重试")

    user = await get_user_by_email(email)
    if user is None:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    if user.locked_until and user.locked_until > datetime.now(UTC):
        remaining = int((user.locked_until - datetime.now(UTC)).total_seconds())
        raise HTTPException(
            status_code=423,
            detail=f"账户已被临时锁定，请 {max(remaining, 60)} 秒后再试",
        )

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="请先验证邮箱")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="账户已被禁用")

    if not bcrypt.checkpw(password.encode(), user.password_hash.encode()):
        await increment_failed_logins(email)
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    await reset_failed_logins(email)
    logger.info("User logged in: %s", _mask_email(email))

    return await _create_auth_response(user.id, user.email, user.username, body.remember_me)


@router.post("/refresh", response_model=AuthResponse)
async def refresh(body: RefreshRequest):
    user, family_id = await consume_refresh_token(body.refresh_token)
    if user is None:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")

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


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: ForgotPasswordRequest):
    email = body.email.lower().strip()
    r = get_redis()

    rate_key = f"auth:forgot:{email}"
    if not await _check_rate_limit(r, rate_key, 3, 60):
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后重试")

    user = await get_user_by_email(email)
    if user:
        code = _generate_code()
        await _store_code_in_redis(r, _reset_key(email), code, 900)
        subject, html = build_reset_email(code)
        await send_email(email, subject, html)
        logger.info("Reset code sent: %s", _mask_email(email))

    return MessageResponse(message="如果该邮箱已注册，将收到重置验证码")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest):
    email = body.email.lower().strip()
    code = body.code.strip()
    new_password = body.new_password
    r = get_redis()

    stored = await r.get(_reset_key(email))
    if stored is None:
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")

    attempts_key = f"auth:reset:attempts:{email}"
    attempts = await r.incr(attempts_key)
    if attempts == 1:
        await r.expire(attempts_key, 900)
    if attempts > 3:
        await r.delete(_reset_key(email))
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")

    stored_code = stored.decode() if isinstance(stored, bytes) else stored
    if stored_code != code:
        raise HTTPException(status_code=400, detail="验证码错误")

    pwd_error = validate_password(new_password)
    if pwd_error:
        raise HTTPException(status_code=400, detail=pwd_error)

    user = await get_user_by_email(email)
    if user is None:
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")

    if bcrypt.checkpw(new_password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=400, detail="新密码不能与旧密码相同")

    new_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt(rounds=12)).decode()
    await update_password(user.id, new_hash)
    await revoke_all_user_tokens(user.id)

    await r.delete(_reset_key(email))
    await r.delete(attempts_key)
    await r.delete(_fail_key(email))

    subject, html = build_password_changed_email()
    await send_email(email, subject, html)

    logger.info("Password reset: %s", _mask_email(email))
    return MessageResponse(message="密码已重置，请重新登录")


@router.post("/logout", status_code=204)
async def logout(body: LogoutRequest, _user: CurrentUser = Depends(get_current_user)):
    await consume_refresh_token(body.refresh_token)


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(body: ForgotPasswordRequest):
    email = body.email.lower().strip()
    r = get_redis()

    rate_key = f"auth:resend:{email}"
    if not await _check_rate_limit(r, rate_key, 1, 60):
        remaining = 60
        raise HTTPException(
            status_code=429,
            detail=f"请 {remaining} 秒后再试",
        )

    user = await get_user_by_email(email)
    if user and not user.is_verified:
        code = _generate_code()
        await _store_code_in_redis(r, _verify_key(email), code, 300)
        subject, html = build_verification_email(code)
        await send_email(email, subject, html)
        logger.info("Verification resent: %s", _mask_email(email))

    return MessageResponse(message=f"验证码已发送到邮箱 {_mask_email(email)}")


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser = Depends(get_current_user)):
    user = await get_user_by_email(current_user.email)
    if user is None:
        user = await get_user_by_id(current_user.id)
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    roles = await get_user_roles(user.id)
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        roles=roles,
        is_verified=user.is_verified,
    )


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    from virtual_team.repository.auth import get_user_by_id as get_user

    user = await get_user(current_user.id)
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")

    if not bcrypt.checkpw(body.old_password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="原密码错误")

    if bcrypt.checkpw(body.new_password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=400, detail="新密码不能与旧密码相同")

    pwd_error = validate_password(body.new_password)
    if pwd_error:
        raise HTTPException(status_code=400, detail=pwd_error)

    new_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt(rounds=12)).decode()
    await update_password(user.id, new_hash)
    await revoke_all_user_tokens(user.id)

    subject, html = build_password_changed_email()
    await send_email(user.email, subject, html)

    logger.info("Password changed: user=%s", current_user.id)
    return MessageResponse(message="密码已修改，请重新登录")


class MergeRequest(BaseModel):
    guest_id: str


@router.post("/merge")
async def merge_guest_data(
    body: MergeRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Merge ALL anonymous guest data into the authenticated user's account.

    Strategy: scan every row in the affected tables whose ``user_id``
    matches any of these patterns, then reassign it to the real user:
      1. The explicit ``guest_id`` sent by the frontend (browser's localStorage)
      2. The current ``X-User-ID`` header (may differ from #1, e.g. behind a proxy)
      3. The literal string ``anonymous`` (fallback in legacy clients)
      4. Any value starting with ``u_`` – the client-generated anonymous prefix
         (catches stale guest_ids from other browsers / localStorage resets)
    """
    from sqlalchemy import or_, update

    from virtual_team.database import (
        KeyUsageLog,
        SessionDB,
        UserApiKey,
        get_session_factory,
    )

    x_user_id = request.headers.get("X-User-ID", "")
    explicit_ids = {body.guest_id, x_user_id, "anonymous"}
    explicit_ids.discard(current_user.id)
    explicit_ids.discard("")

    factory = get_session_factory()
    async with factory() as session:
        for table in (SessionDB, UserApiKey, KeyUsageLog):
            conditions = []
            # For UserApiKey, skip "anonymous" — it's a shared fallback for guests
            if explicit_ids:
                ids_for_table = (
                    [aid for aid in explicit_ids if aid != "anonymous"]
                    if table is UserApiKey
                    else explicit_ids
                )
                if ids_for_table:
                    conditions.extend(table.user_id == aid for aid in ids_for_table)
            conditions.append(table.user_id.startswith("u_"))

            await session.execute(
                update(table)
                .where(
                    or_(*conditions),
                    table.user_id != current_user.id,
                )
                .values(user_id=current_user.id)
            )
        await session.commit()

    logger.info(
        "Guest data merged: explicit=%s u_prefix=yes → user=%s",
        sorted(explicit_ids),
        current_user.id,
    )
    return {"status": "merged"}
