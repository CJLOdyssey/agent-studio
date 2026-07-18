"""Targeted tests for router exception handlers — uses mocks to trigger catch blocks."""

import os

os.environ["AUTH_MODE"] = "legacy"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["KEY_VAULT_SECRET"] = "0123456789abcdef0123456789abcdef"
os.environ["RATE_LIMIT"] = "9999"

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from virtual_team.app import app
from virtual_team.base import Base


@pytest.fixture
def client():
    import virtual_team.app_lifespan as lm
    import virtual_team.database as db_mod

    async def init():
        e = db_mod.get_async_engine()
        async with e.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        from virtual_team.seed import seed_default_roles_and_admin
        await seed_default_roles_and_admin()

    lm.init_db = init

    mr = AsyncMock()
    mr.incr.return_value = 1
    mr.expire.return_value = True
    mr.ping.return_value = True
    mr.publish.return_value = 1

    with patch("virtual_team.rate_limit.get_redis", return_value=mr):
        with patch("virtual_team.app_lifespan.get_redis", return_value=mr):
            with TestClient(app) as c:
                yield c


class TestListErrorHandlers:
    """Mock repository list functions to raise exceptions."""

    def test_teams_list_error(self, client):
        with patch("virtual_team.routers.teams.get_teams", side_effect=Exception("boom")):
            assert client.get("/api/teams").status_code == 500

    def test_tools_list_error(self, client):
        with patch("virtual_team.routers.tools.repo_get_tools_as_dicts", side_effect=Exception("boom")):
            assert client.get("/api/tools").status_code == 500

    def test_mcps_list_error(self, client):
        with patch("virtual_team.routers.mcps.get_mcps_as_dicts", side_effect=Exception("boom")):
            assert client.get("/api/mcps").status_code == 500

    def test_skills_list_error(self, client):
        with patch("virtual_team.routers.skills.repo_get_skills_as_dicts", side_effect=Exception("boom")):
            assert client.get("/api/skills").status_code == 500

    def test_sessions_list_error(self, client):
        with patch("virtual_team.routers.sessions.get_sessions", side_effect=Exception("boom")):
            assert client.get("/api/sessions").status_code == 500

    def test_prompts_list_error(self, client):
        with patch("virtual_team.routers.prompts.get_prompts_as_dicts", side_effect=Exception("boom")):
            assert client.get("/api/prompts").status_code == 500


    def test_keys_list_error(self, client):
        with patch("virtual_team.routers.keys.get_api_keys", side_effect=Exception("boom")):
            assert client.get("/api/keys").status_code == 500


class TestCreateErrors:
    def test_team_create(self, client):
        with patch("virtual_team.routers.teams.create_team", side_effect=Exception("e")): assert c.post("/api/teams", json={"name":"x","agents":[]}).status_code == 500
    def test_tool_create(self, client):
        with patch("virtual_team.routers.tools.repo_create_tool", side_effect=Exception("e")): assert c.post("/api/tools", json={"name":"x","code":"def f():pass","language":"python"}).status_code == 500
    def test_mcp_create(self, client):
        with patch("virtual_team.routers.mcps.create_mcp", side_effect=Exception("e")): assert c.post("/api/mcps", json={"name":"x","server_type":"stdio","command":"echo"}).status_code == 500
    def test_skill_create(self, client):
        with patch("virtual_team.routers.skills.repo_create_skill", side_effect=Exception("e")): assert c.post("/api/skills", json={"name":"x","category":"test"}).status_code == 500
    def test_session_create(self, client):
        with patch("virtual_team.routers.sessions.create_session", side_effect=Exception("e")): assert c.post("/api/sessions", json={"name":"x"}).status_code == 500
    def test_agent_create(self, client):
        with patch("virtual_team.routers.agents.create_agent_config", side_effect=Exception("e")): assert c.post("/api/agents", json={"name":"x","role_identifier":"err_xx"}).status_code == 500
