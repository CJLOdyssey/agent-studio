"""Unit tests for virtual_team/repository/auth.py — direct repo function tests."""

import os

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

os.environ.setdefault("KEY_VAULT_SECRET", "0123456789abcdef0123456789abcdef")
os.environ["AUTH_MODE"] = "legacy"
os.environ["AUTH_ENABLED"] = "0"
os.environ["RATE_LIMIT"] = "9999"
os.environ["CHECKPOINTER_BACKEND"] = "memory"
os.environ["DATABASE_POOL_SIZE"] = "0"

import virtual_team.core.infra.database as db_mod

from virtual_team.core.base import Base

_sqlite_engine = create_async_engine("sqlite+aiosqlite:///:memory:")


@pytest.fixture(autouse=True)
async def setup_db():
    db_mod._async_engine = _sqlite_engine
    db_mod._async_session_factory = async_sessionmaker(_sqlite_engine, expire_on_commit=False)
    async with _sqlite_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    from virtual_team.core.seed import seed_default_roles_and_admin
    await seed_default_roles_and_admin()
    yield
    async with _sqlite_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_get_user_by_email_found():
    from virtual_team.repository.auth import create_user, get_user_by_email

    user = await create_user("test@example.com", "hashed_pw", username="tester")
    found = await get_user_by_email("test@example.com")
    assert found is not None
    assert found.id == user.id


@pytest.mark.asyncio
async def test_get_user_by_email_not_found():
    from virtual_team.repository.auth import get_user_by_email

    found = await get_user_by_email("nobody@example.com")
    assert found is None


@pytest.mark.asyncio
async def test_get_user_by_id():
    from virtual_team.repository.auth import create_user, get_user_by_id

    user = await create_user("test@example.com", "hashed_pw", username="tester")
    found = await get_user_by_id(user.id)
    assert found is not None
    assert found.email == "test@example.com"


@pytest.mark.asyncio
async def test_get_user_by_id_not_found():
    from virtual_team.repository.auth import get_user_by_id

    assert await get_user_by_id("nonexistent") is None


@pytest.mark.asyncio
async def test_get_user_by_username():
    from virtual_team.repository.auth import create_user, get_user_by_username

    await create_user("test@example.com", "hashed_pw", username="tester")
    found = await get_user_by_username("tester")
    assert found is not None
    assert found.email == "test@example.com"


@pytest.mark.asyncio
async def test_get_user_by_username_not_found():
    from virtual_team.repository.auth import get_user_by_username

    assert await get_user_by_username("nobody") is None


@pytest.mark.asyncio
async def test_create_user_with_member_role():
    from virtual_team.repository.auth import create_user

    user = await create_user("new@example.com", "hashed_pw")
    assert user.email == "new@example.com"
    assert user.username == "new"
    assert user.is_active is True
    assert user.is_verified is False

    from virtual_team.repository.auth import get_user_roles
    roles = await get_user_roles(user.id)
    assert "member" in roles


@pytest.mark.asyncio
async def test_create_user_custom_username():
    from virtual_team.repository.auth import create_user

    user = await create_user("custom@example.com", "hashed_pw", username="custom_user")
    assert user.username == "custom_user"


@pytest.mark.asyncio
async def test_mark_user_verified():
    from virtual_team.repository.auth import create_user, mark_user_verified

    user = await create_user("test@example.com", "hashed_pw")
    assert user.is_verified is False
    await mark_user_verified(user.id)

    from virtual_team.repository.auth import get_user_by_id
    found = await get_user_by_id(user.id)
    assert found is not None
    assert found.is_verified is True


@pytest.mark.asyncio
async def test_mark_user_verified_not_found():
    from virtual_team.repository.auth import mark_user_verified

    await mark_user_verified("nonexistent")


@pytest.mark.asyncio
async def test_update_password():
    from virtual_team.repository.auth import create_user, update_password

    user = await create_user("test@example.com", "old_hash")
    await update_password(user.id, "new_hash")

    from virtual_team.repository.auth import get_user_by_id
    found = await get_user_by_id(user.id)
    assert found is not None
    assert found.password_hash == "new_hash"
    assert found.failed_login_attempts == 0
    assert found.locked_until is None


@pytest.mark.asyncio
async def test_increment_failed_logins():
    from virtual_team.repository.auth import create_user, increment_failed_logins

    await create_user("test@example.com", "hash")
    count = await increment_failed_logins("test@example.com")
    assert count == 1
    count = await increment_failed_logins("test@example.com")
    assert count == 2


@pytest.mark.asyncio
async def test_increment_failed_logins_no_user():
    from virtual_team.repository.auth import increment_failed_logins

    count = await increment_failed_logins("nonexistent@example.com")
    assert count == 0


@pytest.mark.asyncio
async def test_increment_failed_logins_locks():
    from virtual_team.repository.auth import create_user, increment_failed_logins

    await create_user("test@example.com", "hash")
    for _ in range(5):
        await increment_failed_logins("test@example.com")

    from virtual_team.repository.auth import get_user_by_email
    user = await get_user_by_email("test@example.com")
    assert user is not None
    assert user.locked_until is not None


@pytest.mark.asyncio
async def test_reset_failed_logins():
    from virtual_team.repository.auth import create_user, increment_failed_logins, reset_failed_logins

    await create_user("test@example.com", "hash")
    await increment_failed_logins("test@example.com")
    await reset_failed_logins("test@example.com")

    from virtual_team.repository.auth import get_user_by_email
    user = await get_user_by_email("test@example.com")
    assert user is not None
    assert user.failed_login_attempts == 0


@pytest.mark.asyncio
async def test_get_user_roles():
    from virtual_team.repository.auth import create_user, get_user_roles

    user = await create_user("test@example.com", "hash")
    roles = await get_user_roles(user.id)
    assert "member" in roles


@pytest.mark.asyncio
async def test_get_user_roles_empty():
    from virtual_team.repository.auth import get_user_roles

    roles = await get_user_roles("nonexistent")
    assert roles == []


@pytest.mark.asyncio
async def test_create_refresh_token():
    from virtual_team.repository.auth import create_refresh_token, create_user

    user = await create_user("test@example.com", "hash")
    token, token_hash = await create_refresh_token(user.id)
    assert token is not None
    assert token_hash is not None
    assert len(token) > 0


@pytest.mark.asyncio
async def test_consume_refresh_token():
    from virtual_team.repository.auth import consume_refresh_token, create_refresh_token, create_user

    user = await create_user("test@example.com", "hash")
    token, _ = await create_refresh_token(user.id)
    found_user, family_id = await consume_refresh_token(token)
    assert found_user is not None
    assert found_user.id == user.id
    assert family_id is not None


@pytest.mark.asyncio
async def test_consume_refresh_token_invalid():
    from virtual_team.repository.auth import consume_refresh_token

    found_user, family_id = await consume_refresh_token("invalid-token")
    assert found_user is None
    assert family_id is None


@pytest.mark.asyncio
async def test_consume_refresh_token_expired():
    from datetime import UTC, datetime, timedelta

    from virtual_team.core.infra.database import RefreshTokenDB
    from virtual_team.repository.auth import consume_refresh_token, create_refresh_token, create_user

    user = await create_user("test@example.com", "hash")
    token, token_hash = await create_refresh_token(user.id)

    factory = db_mod.get_session_factory()
    async with factory() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(RefreshTokenDB).where(RefreshTokenDB.token_hash == token_hash)
        )
        rt = result.scalar_one_or_none()
        assert rt is not None
        rt.expires_at = datetime.now(UTC) - timedelta(hours=1)
        await session.commit()

    found_user, family_id = await consume_refresh_token(token)
    assert found_user is None
    assert family_id is None


@pytest.mark.asyncio
async def test_revoke_all_user_tokens():
    from virtual_team.repository.auth import (
        create_refresh_token,
        create_user,
        revoke_all_user_tokens,
    )

    user = await create_user("test@example.com", "hash")
    await create_refresh_token(user.id)
    await revoke_all_user_tokens(user.id)

    from virtual_team.repository.auth import create_refresh_token
    token, _ = await create_refresh_token(user.id)
    from virtual_team.repository.auth import consume_refresh_token
    found_user, _ = await consume_refresh_token(token)
    assert found_user is not None


@pytest.mark.asyncio
async def test_revoke_token_family():
    from virtual_team.repository.auth import (
        create_refresh_token,
        create_user,
    )

    user = await create_user("test@example.com", "hash")
    token, _ = await create_refresh_token(user.id)
    from virtual_team.repository.auth import (
        consume_refresh_token,
    )

    first_user, _ = await consume_refresh_token(token)
    assert first_user is not None

    from virtual_team.repository.auth import (
        consume_refresh_token as crt,
    )
    from virtual_team.repository.auth import (
        create_refresh_token as crt2,
    )

    token2, _ = await crt2(user.id)
    second_user, _ = await crt(token2)
    assert second_user is not None


@pytest.mark.asyncio
async def test_merge_guest_data():
    from virtual_team.repository.auth import create_user, merge_guest_data

    real_user = await create_user("real@example.com", "hash")
    await create_user("guest1@example.com", "hash", username="u_guest1")
    await create_user("guest2@example.com", "hash", username="u_guest2")

    from uuid import uuid4

    from virtual_team.orm import SessionDB

    factory = db_mod.get_session_factory()
    async with factory() as session:
        s1 = SessionDB(id=str(uuid4()), user_id="u_guest1")
        s2 = SessionDB(id=str(uuid4()), user_id="u_guest2")
        session.add_all([s1, s2])
        await session.commit()

    await merge_guest_data({"u_guest1", "u_guest2"}, real_user.id)

    async with factory() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(SessionDB).where(SessionDB.user_id == real_user.id)
        )
        sessions = result.scalars().all()
        assert len(sessions) >= 2
