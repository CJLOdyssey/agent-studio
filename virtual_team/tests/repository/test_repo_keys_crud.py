"""Unit tests for virtual_team/repository/keys_crud.py — direct repo function tests."""

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
    yield
    async with _sqlite_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_create_api_key_default_clears_others():
    from virtual_team.repository.keys_crud import create_api_key

    key1 = await create_api_key("user1", "openai", plaintext_key="sk-key-1", is_default=True)
    assert key1.is_default is True

    key2 = await create_api_key("user1", "deepseek", plaintext_key="sk-key-2", is_default=True)
    assert key2.is_default is True

    factory = db_mod.get_session_factory()
    async with factory() as session:
        from sqlalchemy import select

        from virtual_team.core.infra.database import UserApiKey

        result = await session.execute(
            select(UserApiKey).where(UserApiKey.user_id == "user1", UserApiKey.is_default)
        )
        rows = result.scalars().all()
        assert len(rows) == 1
        assert rows[0].id == key2.id


@pytest.mark.asyncio
async def test_get_api_keys_with_fallback():
    from virtual_team.repository.keys_crud import create_api_key, get_api_keys

    await create_api_key("anonymous", "openai", plaintext_key="sk-anon-key-12345")
    keys = await get_api_keys("someuser")
    assert len(keys) > 0
    assert keys[0]["provider"] == "openai"
    assert "..." in keys[0]["key_masked"]

    keys_direct = await get_api_keys("anonymous")
    assert len(keys_direct) == 1


@pytest.mark.asyncio
async def test_get_api_keys_no_fallback_for_anonymous():
    from virtual_team.repository.keys_crud import get_api_keys

    keys = await get_api_keys("anonymous")
    assert keys == []


@pytest.mark.asyncio
async def test_get_api_keys_decrypt_failure_graceful():
    import virtual_team.core.infra.database as db

    from virtual_team.repository.keys_crud import get_api_keys

    factory = db.get_session_factory()
    async with factory() as session:
        from virtual_team.orm.key import UserApiKey

        obj = UserApiKey(
            id="bad-key-id-1234",
            user_id="user1",
            provider="openai",
            usage_type="llm",
            label="bad",
            encrypted_key="not-valid-fernet",
            models="",
            is_active=True,
        )
        session.add(obj)
        await session.commit()

    keys = await get_api_keys("user1")
    assert len(keys) == 1
    assert "解密失败" in keys[0]["key_masked"]


@pytest.mark.asyncio
async def test_get_api_key_for_use_found():
    from virtual_team.repository.keys_crud import create_api_key, get_api_key_for_use

    k = await create_api_key("user1", "openai", plaintext_key="sk-real-key-xyz")
    result = await get_api_key_for_use(k.id, "user1")
    assert result is not None
    assert result["api_key"] == "sk-real-key-xyz"
    assert result["provider"] == "openai"


@pytest.mark.asyncio
async def test_get_api_key_for_use_not_found():
    from virtual_team.repository.keys_crud import get_api_key_for_use

    result = await get_api_key_for_use("nonexistent", "user1")
    assert result is None


@pytest.mark.asyncio
async def test_get_api_key_for_use_anonymous_fallback():
    from virtual_team.repository.keys_crud import create_api_key, get_api_key_for_use

    k = await create_api_key("anonymous", "openai", plaintext_key="sk-anon-key")
    result = await get_api_key_for_use(k.id, "someuser")
    assert result is not None
    assert result["api_key"] == "sk-anon-key"


@pytest.mark.asyncio
async def test_get_api_key_for_use_inactive_returns_none():
    from virtual_team.repository.keys_crud import create_api_key, get_api_key_for_use, update_api_key

    k = await create_api_key("user1", "openai", plaintext_key="sk-test")
    await update_api_key(k.id, "user1", is_active=False)
    result = await get_api_key_for_use(k.id, "user1")
    assert result is None


@pytest.mark.asyncio
async def test_update_api_key_partial():
    from virtual_team.repository.keys_crud import create_api_key, update_api_key

    k = await create_api_key("user1", "openai", plaintext_key="sk-original", label="old")
    result = await update_api_key(k.id, "user1", label="new-label")
    assert result is not None
    assert result["label"] == "new-label"


@pytest.mark.asyncio
async def test_update_api_key_not_found():
    from virtual_team.repository.keys_crud import update_api_key

    result = await update_api_key("nonexistent", "user1", label="test")
    assert result is None


@pytest.mark.asyncio
async def test_update_api_key_wrong_owner():
    from virtual_team.repository.keys_crud import create_api_key, update_api_key

    k = await create_api_key("user1", "openai", plaintext_key="sk-test")
    result = await update_api_key(k.id, "otheruser", label="hacked")
    assert result is None


@pytest.mark.asyncio
async def test_update_api_key_anonymous_fallback():
    from virtual_team.repository.keys_crud import create_api_key, update_api_key

    k = await create_api_key("anonymous", "openai", plaintext_key="sk-anon")
    result = await update_api_key(k.id, "realuser", label="adopted")
    assert result is not None
    assert result["label"] == "adopted"


@pytest.mark.asyncio
async def test_update_api_key_reencrypt():
    from virtual_team.repository.keys_crud import create_api_key, update_api_key

    k = await create_api_key("user1", "openai", plaintext_key="sk-original")
    result = await update_api_key(k.id, "user1", plaintext_key="sk-new-value")
    assert result is not None


@pytest.mark.asyncio
async def test_update_api_key_default_clears_others():
    from virtual_team.repository.keys_crud import create_api_key, update_api_key

    await create_api_key("user1", "openai", plaintext_key="sk-1", is_default=True)
    k2 = await create_api_key("user1", "deepseek", plaintext_key="sk-2")

    await update_api_key(k2.id, "user1", is_default=True)

    factory = db_mod.get_session_factory()
    async with factory() as session:
        from sqlalchemy import select

        from virtual_team.core.infra.database import UserApiKey

        result = await session.execute(
            select(UserApiKey).where(UserApiKey.user_id == "user1", UserApiKey.is_default)
        )
        defaults = result.scalars().all()
        assert len(defaults) == 1
        assert defaults[0].id == k2.id


@pytest.mark.asyncio
async def test_delete_api_key():
    from virtual_team.repository.keys_crud import create_api_key, delete_api_key

    k = await create_api_key("user1", "openai", plaintext_key="sk-del")
    assert await delete_api_key(k.id, "user1") is True
    assert await delete_api_key(k.id, "user1") is False


@pytest.mark.asyncio
async def test_delete_api_key_not_found():
    from virtual_team.repository.keys_crud import delete_api_key

    assert await delete_api_key("nonexistent", "user1") is False


@pytest.mark.asyncio
async def test_delete_api_key_wrong_owner():
    from virtual_team.repository.keys_crud import create_api_key, delete_api_key

    k = await create_api_key("user1", "openai", plaintext_key="sk-del")
    assert await delete_api_key(k.id, "otheruser") is False


@pytest.mark.asyncio
async def test_delete_api_key_anonymous_fallback():
    from virtual_team.repository.keys_crud import create_api_key, delete_api_key

    k = await create_api_key("anonymous", "openai", plaintext_key="sk-del")
    assert await delete_api_key(k.id, "realuser") is True


@pytest.mark.asyncio
async def test_get_default_api_key():
    from virtual_team.repository.keys_crud import create_api_key, get_default_api_key

    await create_api_key("user1", "openai", plaintext_key="sk-def", is_default=True)
    result = await get_default_api_key("user1")
    assert result is not None
    assert result["api_key"] == "sk-def"


@pytest.mark.asyncio
async def test_get_default_api_key_fallback_anonymous():
    from virtual_team.repository.keys_crud import create_api_key, get_default_api_key

    await create_api_key("anonymous", "openai", plaintext_key="sk-anon-def", is_default=True)
    result = await get_default_api_key("someuser")
    assert result is not None
    assert result["api_key"] == "sk-anon-def"


@pytest.mark.asyncio
async def test_get_default_api_key_none():
    from virtual_team.repository.keys_crud import get_default_api_key

    result = await get_default_api_key("someuser")
    assert result is None


@pytest.mark.asyncio
async def test_get_default_api_key_guest_fallback():
    from virtual_team.repository.keys_crud import create_api_key, get_default_api_key

    await create_api_key("u_guest1", "openai", plaintext_key="sk-guest-def", is_default=True)
    result = await get_default_api_key("u_guest1")
    assert result is not None
    assert result["api_key"] == "sk-guest-def"


@pytest.mark.asyncio
async def test_get_default_api_key_system_wide_fallback():
    from virtual_team.repository.keys_crud import create_api_key, get_default_api_key

    await create_api_key("otheruser", "openai", plaintext_key="sk-other", is_default=True)
    result = await get_default_api_key("u_newguest_xyz")
    assert result is not None


@pytest.mark.asyncio
async def test_get_embedding_api_key():
    from virtual_team.repository.keys_crud import create_api_key, get_embedding_api_key

    await create_api_key("user1", "openai", usage_type="embedding", plaintext_key="sk-emb")
    result = await get_embedding_api_key()
    assert result == "sk-emb"


@pytest.mark.asyncio
async def test_get_embedding_api_key_none():
    from virtual_team.repository.keys_crud import get_embedding_api_key

    result = await get_embedding_api_key()
    assert result is None


@pytest.mark.asyncio
async def test_log_key_usage():
    from virtual_team.repository.keys_crud import create_api_key, log_key_usage

    k = await create_api_key("user1", "openai", plaintext_key="sk-log")
    await log_key_usage(k.id, "user1", "run-1", "openai", "gpt-4", tokens_prompt=10, tokens_completion=20)

    factory = db_mod.get_session_factory()
    async with factory() as session:
        from sqlalchemy import select

        from virtual_team.core.infra.database import KeyUsageLog

        result = await session.execute(select(KeyUsageLog))
        logs = result.scalars().all()
        assert len(logs) == 1
        assert logs[0].tokens_total == 30


@pytest.mark.asyncio
async def test_get_key_usage_stats():
    from virtual_team.repository.keys_crud import create_api_key, get_key_usage_stats

    k = await create_api_key("user1", "openai", plaintext_key="sk-stat")

    factory = db_mod.get_session_factory()
    async with factory() as session:
        from uuid import uuid4

        from virtual_team.core.infra.database import KeyUsageLog

        log = KeyUsageLog(
            id=str(uuid4()),
            key_id=k.id,
            user_id="user1",
            run_id="r1",
            provider="openai",
            model="gpt-4",
            tokens_prompt=50,
            tokens_completion=50,
            tokens_total=100,
            status="success",
        )
        session.add(log)
        await session.commit()

    stats = await get_key_usage_stats("user1")
    assert stats["today_requests"] >= 1
    assert stats["today_tokens"] >= 100


@pytest.mark.asyncio
async def test_get_key_usage_stats_all_users():
    from virtual_team.repository.keys_crud import get_key_usage_stats

    stats = await get_key_usage_stats()
    assert "today_requests" in stats
    assert "month_tokens" in stats
