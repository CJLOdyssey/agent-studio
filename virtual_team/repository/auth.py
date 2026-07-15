import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select

from virtual_team.database import (
    RefreshTokenDB,
    RoleDB,
    UserDB,
    UserRoleDB,
    get_session_factory,
)


async def get_user_by_email(email: str) -> UserDB | None:
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(UserDB).where(UserDB.email == email))
        return result.scalar_one_or_none()


async def get_user_by_id(user_id: str) -> UserDB | None:
    factory = get_session_factory()
    async with factory() as session:
        return await session.get(UserDB, user_id)


async def get_user_by_username(username: str) -> UserDB | None:
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
    factory = get_session_factory()
    async with factory() as session:
        user = await session.get(UserDB, user_id)
        if user:
            user.is_verified = True
            await session.commit()


async def update_password(user_id: str, new_hash: str) -> None:
    factory = get_session_factory()
    async with factory() as session:
        user = await session.get(UserDB, user_id)
        if user:
            user.password_hash = new_hash
            user.failed_login_attempts = 0
            user.locked_until = None
            await session.commit()


async def increment_failed_logins(email: str) -> int:
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
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(UserDB).where(UserDB.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.failed_login_attempts = 0
            user.locked_until = None
            await session.commit()


async def get_user_roles(user_id: str) -> list[str]:
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

        if rt.expires_at < datetime.now(UTC):
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
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(RefreshTokenDB).where(RefreshTokenDB.family_id == family_id)
        )
        now = datetime.now(UTC)
        for row in result.scalars().all():
            row.revoked_at = now
        await session.commit()
