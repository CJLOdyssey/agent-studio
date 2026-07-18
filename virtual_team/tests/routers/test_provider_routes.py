import os
from unittest.mock import AsyncMock, patch

import pytest
from starlette.testclient import TestClient

os.environ['AUTH_MODE'] = 'legacy'
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///:memory:'
os.environ['REDIS_URL'] = 'redis://localhost:6379/0'
os.environ['KEY_VAULT_SECRET'] = '0123456789abcdef0123456789abcdef'
os.environ['AUTH_ENABLED'] = '0'
os.environ['RATE_LIMIT'] = '9999'
os.environ['CHECKPOINTER_BACKEND'] = 'memory'
os.environ['DATABASE_POOL_SIZE'] = '0'

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import virtual_team.database as db_mod

_sqlite_engine = create_async_engine('sqlite+aiosqlite:///:memory:')
db_mod._async_engine = _sqlite_engine
db_mod._async_session_factory = async_sessionmaker(_sqlite_engine, expire_on_commit=False)
db_mod.DATABASE_URL = 'sqlite+aiosqlite:///:memory:'

from virtual_team.core.app import app
from virtual_team.core.base import Base


@pytest.fixture
def client():
    from virtual_team import app_lifespan as lifespan_mod

    async def _safe_init_db():
        engine = db_mod.get_async_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        from virtual_team.core.seed import seed_default_roles_and_admin
        await seed_default_roles_and_admin()

    lifespan_mod.init_db = _safe_init_db

    mock_redis = AsyncMock()
    mock_redis.incr.return_value = 1
    mock_redis.expire.return_value = True
    mock_redis.ping.return_value = True
    mock_redis.publish.return_value = 1

    with patch('virtual_team.rate_limit.get_redis', return_value=mock_redis):
        with patch('virtual_team.app_lifespan.get_redis', return_value=mock_redis):
            with TestClient(app) as c:
                yield c


class TestProviderRoutes:

    def test_list_providers(self, client):
        resp = client.get("/api/providers")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)
        assert "openai" in data
        assert "deepseek" in data
        assert "anthropic" in data
        assert "dashscope" in data
        assert "custom" in data

    def test_list_providers_has_capabilities(self, client):
        resp = client.get("/api/providers")
        data = resp.json()
        for provider_name, provider_info in data.items():
            assert "name" in provider_info
            assert "capabilities" in provider_info
            assert isinstance(provider_info["capabilities"], list)

    def test_openai_has_llm_and_embedding(self, client):
        resp = client.get("/api/providers")
        data = resp.json()
        caps = data["openai"]["capabilities"]
        assert "llm" in caps
        assert "embedding" in caps

    def test_deepseek_only_llm(self, client):
        resp = client.get("/api/providers")
        data = resp.json()
        caps = data["deepseek"]["capabilities"]
        assert "llm" in caps
        assert "embedding" not in caps

    def test_provider_has_base_url(self, client):
        resp = client.get("/api/providers")
        data = resp.json()
        assert data["openai"]["base_url"] == "https://api.openai.com/v1"
        assert data["deepseek"]["base_url"] == "https://api.deepseek.com"
