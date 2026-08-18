"""Authentication repository — user lookup, credential management, and token rotation."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from sqlalchemy import or_, select, update

from core.infra.database import (
    KeyUsageLog,
    RefreshTokenDB,
    RoleDB,
    SessionDB,
    UserApiKey,
    UserDB,
    UserPreferenceDB,
    UserRoleDB,
    get_session_factory,
)


async def get_user_by_email(email: str) -> UserDB | None:
    """Look up a user by their email address."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(UserDB).where(UserDB.email == email))
        return result.scalar_one_or_none()


async def get_user_by_id(user_id: str) -> UserDB | None:
    """Look up a user by their primary key ID."""
    factory = get_session_factory()
    async with factory() as session:
        return await session.get(UserDB, user_id)


async def get_user_by_username(username: str) -> UserDB | None:
    """Look up a user by their username."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(UserDB).where(UserDB.username == username))
        return result.scalar_one_or_none()


async def create_user(
    email: str,
    password_hash: str,
    username: str | None = None,
    is_verified: bool = False,
) -> UserDB:
    """Create a new user with an optional "member" role assignment.

    Args:
        email: User's email address.
        password_hash: Pre-hashed password string.
        username: Display name (defaults to email prefix).
        is_verified: Whether the email has been verified.

    Returns:
        The newly created UserDB instance.

    """
    factory = get_session_factory()
    async with factory() as session:
        user = UserDB(
            id=str(uuid4()),
            email=email,
            username=username or email.split("@")[0],
            password_hash=password_hash,
            is_active=True,
            is_verified=is_verified,
            auth_provider="email",
        )
        session.add(user)
        await session.flush()

        role_result = await session.execute(select(RoleDB).where(RoleDB.name == "member"))
        member_role = role_result.scalar_one_or_none()
        if member_role:
            session.add(UserRoleDB(user_id=user.id, role_id=member_role.id))

        await session.commit()
        await session.refresh(user)
        return user


async def mark_user_verified(user_id: str) -> None:
    """Set a user's verified flag to True."""
    factory = get_session_factory()
    async with factory() as session:
        user = await session.get(UserDB, user_id)
        if user:
            user.is_verified = True
            await session.commit()


async def update_password(user_id: str, new_hash: str) -> None:
    """Update a user's password hash and reset login counters."""
    factory = get_session_factory()
    async with factory() as session:
        user = await session.get(UserDB, user_id)
        if user:
            user.password_hash = new_hash
            user.failed_login_attempts = 0
            user.locked_until = None
            await session.commit()


async def increment_failed_logins(email: str) -> int:
    """Increment failed login counter for an email; lock after 5 failures.

    Returns:
        The new failed-attempt count.

    """
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(UserDB).where(UserDB.email == email))
        user = result.scalar_one_or_none()
        if not user:
            return 0
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        count = user.failed_login_attempts
        if count >= 5:
            user.locked_until = datetime.now(UTC) + timedelta(minutes=15)
        await session.commit()
        return count


async def reset_failed_logins(email: str) -> None:
    """Reset failed login counter and unlock a user account."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(UserDB).where(UserDB.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.failed_login_attempts = 0
            user.locked_until = None
            await session.commit()


async def get_user_roles(user_id: str) -> list[str]:
    """Return the list of role names assigned to a user."""
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(RoleDB.name)
            .join(UserRoleDB, RoleDB.id == UserRoleDB.role_id)
            .where(UserRoleDB.user_id == user_id)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


# ── Refresh Token operations ─────────────────────────────────────────────


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _generate_refresh_token() -> str:
    return secrets.token_urlsafe(32)


async def create_refresh_token(user_id: str, family_id: str | None = None, ttl_days: int = 7) -> tuple[str, str]:
    """Generate and store a new refresh token for a user.

    Args:
        user_id: The user to associate the token with.
        family_id: Token family for rotation (auto-generated if None).
        ttl_days: Number of days until the token expires.

    Returns:
        A tuple of (plain_token, token_hash).

    """
    token = _generate_refresh_token()
    token_hash = _hash_token(token)
    family_id = family_id or str(uuid4())

    factory = get_session_factory()
    async with factory() as session:
        obj = RefreshTokenDB(
            id=str(uuid4()),
            user_id=user_id,
            token_hash=token_hash,
            family_id=family_id,
            expires_at=datetime.now(UTC) + timedelta(days=ttl_days),
        )
        session.add(obj)
        await session.commit()
    return token, token_hash


async def consume_refresh_token(token: str) -> tuple[UserDB | None, str | None]:
    """Validate and consume a refresh token (rotation).

    Returns (user, new_family_id) on success, or (None, None) on failure.
    New family_id is None for normal rotation, or a new uuid4 for replay attacks.
    """
    token_hash = _hash_token(token)
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(RefreshTokenDB).where(RefreshTokenDB.token_hash == token_hash)
        )
        rt = result.scalar_one_or_none()

        if rt is None:
            return None, None

        if rt.revoked_at is not None:
            # Replay attack — revoke entire family
            await session.execute(
                select(RefreshTokenDB).where(RefreshTokenDB.family_id == rt.family_id)
            )
            family_result = await session.execute(
                select(RefreshTokenDB).where(RefreshTokenDB.family_id == rt.family_id)
            )
            for row in family_result.scalars().all():
                row.revoked_at = datetime.now(UTC)
            await session.commit()
            return None, None

        expires = rt.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        if expires < datetime.now(UTC):
            return None, None

        # Rotate: revoke current, check global revocation
        rt.revoked_at = datetime.now(UTC)

        user = await session.get(UserDB, rt.user_id)
        if user is None:
            await session.commit()
            return None, None

        await session.commit()
        return user, rt.family_id


async def revoke_all_user_tokens(user_id: str) -> None:
    """Revoke all active refresh tokens for a user."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(RefreshTokenDB).where(
                RefreshTokenDB.user_id == user_id,
                RefreshTokenDB.revoked_at.is_(None),
            )
        )
        now = datetime.now(UTC)
        for row in result.scalars().all():
            row.revoked_at = now
        await session.commit()


async def revoke_token_family(family_id: str) -> None:
    """Revoke every token belonging to a token family (rotating refresh)."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(RefreshTokenDB).where(RefreshTokenDB.family_id == family_id)
        )
        now = datetime.now(UTC)
        for row in result.scalars().all():
            row.revoked_at = now
        await session.commit()


async def merge_guest_data(guest_ids: set[str], real_user_id: str) -> None:
    """Reassign all guest data rows to the authenticated user.

    For each table (SessionDB, UserApiKey, KeyUsageLog, UserPreferenceDB),
    updates rows where ``user_id`` matches any ``guest_id`` or starts with
    ``u_`` (client-generated anonymous prefix), setting ``user_id =
    real_user_id``. SessionDB also merges the literal ``anonymous`` fallback
    (shared legacy namespace for chat history). UserApiKey and
    UserPreferenceDB skip ``anonymous`` — it is a shared fallback for clients
    that send no ``X-User-ID`` (curl/scripts), not a unique guest identity;
    merging it would import another client's keys/preferences into the real
    user's account. Preferences use an upsert because their PK is
    ``(user_id, key)`` — a plain UPDATE could collide with the real user's
    existing key and roll the whole merge back.

    Args:
        guest_ids: Set of candidate guest identifiers (already filtered to exclude
                   the real user's ID and empty strings).
        real_user_id: The authenticated user's ID to reassign data to.
    """
    factory = get_session_factory()
    async with factory() as session:
        for table in (SessionDB, UserApiKey, KeyUsageLog):
            conditions: list[Any] = []

            if guest_ids:
                # For UserApiKey, skip "anonymous" — it's a shared fallback
                ids_for_table = (
                    [aid for aid in guest_ids if aid != "anonymous"]
                    if table is UserApiKey
                    else list(guest_ids)
                )
                if ids_for_table:
                    conditions.extend(table.user_id == aid for aid in ids_for_table)

            conditions.append(table.user_id.startswith("u_"))

            await session.execute(
                update(table)
                .where(
                    or_(*conditions),
                    table.user_id != real_user_id,
                )
                .values(user_id=real_user_id)
            )

        # user_preferences 主键是 (user_id, key)：直接把 user_id 改成正式用户
        # 会撞唯一约束（guest 与正式用户已有同一 key），整笔事务回滚。改为逐行
        # upsert——正式用户已有该 key 则覆盖为 guest 最新值（与偏好 last-write-
        # wins 语义一致），否则新建，保证 guest 合并永不失败。
        # user_preferences 与 UserApiKey 同理：跳过共享兜底命名空间 "anonymous"。
        # 前端真实 guest 会话由 axios 拦截器生成唯一 u_<timestamp>_<random> id
        # （经 get_user_id 的 X-User-ID 解析）；"anonymous" 仅是未带 X-User-ID
        # 的客户端（curl/脚本/旧客户端）共享兜底——并入它会把其他浏览器的偏好
        # 导入正式用户账户（跨用户泄漏）。下方 startswith("u_") 已覆盖所有真实
        # guest 偏好行。
        guest_ids_for_pref = [g for g in guest_ids if g != "anonymous"]
        pref_conditions: list[Any] = []
        if guest_ids_for_pref:
            pref_conditions.extend(UserPreferenceDB.user_id == g for g in guest_ids_for_pref)
        pref_conditions.append(UserPreferenceDB.user_id.startswith("u_"))
        pref_rows = await session.execute(
            select(UserPreferenceDB).where(
                or_(*pref_conditions),
                UserPreferenceDB.user_id != real_user_id,
            )
        )
        for pref in pref_rows.scalars().all():
            target = await session.get(UserPreferenceDB, (real_user_id, pref.key))
            if target is None:
                session.add(UserPreferenceDB(user_id=real_user_id, key=pref.key, value=pref.value))
            else:
                target.value = pref.value
        await session.commit()
