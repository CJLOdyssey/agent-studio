"""TDD tests for API Key routes (crud + encryption)."""

import pytest


class TestKeysRoutes:
    @pytest.mark.asyncio
    async def test_list_keys_endpoint_exists(self):
        from virtual_team.routers.keys import router

        paths = [r.path for r in router.routes]
        assert "/api/keys" in paths

    @pytest.mark.asyncio
    async def test_create_key_request_valid(self):
        from virtual_team.routers.keys import KeyCreateRequest

        req = KeyCreateRequest(
            provider="openai",
            label="test-key",
            api_key="sk-test123",
        )
        assert req.label == "test-key"

    @pytest.mark.asyncio
    async def test_key_model_has_encrypted_field(self):
        from virtual_team.database import UserApiKey

        cols = [c.name for c in UserApiKey.__table__.columns]
        assert "encrypted_key" in cols


class TestSessionsRoutes:
    @pytest.mark.asyncio
    async def test_list_sessions_importable(self):
        from virtual_team.routers.sessions import router

        paths = [r.path for r in router.routes]
        assert "/api/sessions" in paths

    @pytest.mark.asyncio
    async def test_session_model_exists(self):
        from virtual_team.database import SessionDB

        cols = [c.name for c in SessionDB.__table__.columns]
        assert "title" in cols
