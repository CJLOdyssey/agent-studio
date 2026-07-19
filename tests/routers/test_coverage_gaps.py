"""Targeted tests to close remaining coverage gaps in backend/routers/.

Focuses on exception handler paths, error branches, and edge cases
that the integration tests don't reach.
"""

import os
import asyncio
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import bcrypt
import pytest
from starlette.testclient import TestClient

os.environ["AUTH_MODE"] = "legacy"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["KEY_VAULT_SECRET"] = "0123456789abcdef0123456789abcdef"
os.environ["AUTH_ENABLED"] = "0"
os.environ["RATE_LIMIT"] = "9999"
os.environ["CHECKPOINTER_BACKEND"] = "memory"

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import backend.core.infra.database as db_mod

_sqlite_engine = create_async_engine("sqlite+aiosqlite:///:memory:")
db_mod._async_engine = _sqlite_engine
db_mod._async_session_factory = async_sessionmaker(_sqlite_engine, expire_on_commit=False)
db_mod.DATABASE_URL = "sqlite+aiosqlite:///:memory:"

from backend.core.app import app
from backend.core.base import Base


@pytest.fixture
def client():
    import backend.core.app_lifespan as lifespan_mod

    async def _safe_init_db():
        engine = db_mod.get_async_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        from backend.core.seed import seed_default_roles_and_admin
        await seed_default_roles_and_admin()

    lifespan_mod.init_db = _safe_init_db

    store: dict[str, str] = {}

    async def _redis_get(key: str) -> str | None:
        return store.get(key)

    async def _redis_set(key: str, value: str, *args: object, **kwargs: object) -> bool:
        store[key] = value
        return True

    async def _redis_delete(key: str) -> bool:
        store.pop(key, None)
        return True

    mock_redis = AsyncMock()
    mock_redis.incr.return_value = 1
    mock_redis.expire.return_value = True
    mock_redis.ping.return_value = True
    mock_redis.publish.return_value = 1
    mock_redis.get.side_effect = _redis_get
    mock_redis.set.side_effect = _redis_set
    mock_redis.delete.side_effect = _redis_delete

    with patch("backend.broker.get_redis", return_value=mock_redis), \
         patch("backend.core.app_lifespan.get_redis", return_value=mock_redis), \
         patch("backend.routers.auth.login.get_redis", return_value=mock_redis), \
         patch("backend.routers.auth.register.get_redis", return_value=mock_redis), \
         patch("backend.routers.auth.password.get_redis", return_value=mock_redis):
        with TestClient(app) as c:
            yield c


# ═══════════════════════════════════════════════════════════════════════════
# RUNS: exception handler paths (lines 50, 71, 85-89, 97-99)
# ═══════════════════════════════════════════════════════════════════════════

class TestRunsGaps:

    @patch("backend.routers.runs.run_service", new_callable=MagicMock)
    def test_create_run_max_length(self, mock_service, client):
        """Line 50: requirement > max_requirement_length."""
        resp = client.post("/api/runs", json={
            "requirement": "x" * 20000
        }, headers={"X-User-ID": "admin"})
        # Pydantic rejects at max_length=2000 before hitting the route
        assert resp.status_code == 422

    @patch("backend.routers.runs.run_service", new_callable=MagicMock)
    def test_create_run_http_exception_reraise(self, mock_service, client):
        """Line 71: HTTPException re-raised."""
        from fastapi import HTTPException
        mock_service.create_run = AsyncMock(side_effect=HTTPException(status_code=400, detail="bad"))
        resp = client.post("/api/runs", json={
            "requirement": "test"
        }, headers={"X-User-ID": "admin"})
        assert resp.status_code == 400

    @patch("backend.routers.runs.run_service", new_callable=MagicMock)
    def test_get_run_detail_http_exception(self, mock_service, client):
        """Line 85-86: HTTPException re-raised in get_run_detail."""
        from fastapi import HTTPException
        mock_service.get_run = AsyncMock(side_effect=HTTPException(status_code=404, detail="not found"))
        resp = client.get("/api/runs/notfound")
        assert resp.status_code == 404

    @patch("backend.routers.runs.run_service", new_callable=MagicMock)
    def test_list_runs_exception(self, mock_service, client):
        """Lines 97-99: exception handler in list_runs."""
        mock_service.list_runs = AsyncMock(side_effect=RuntimeError("db error"))
        resp = client.get("/api/runs?limit=10")
        assert resp.status_code == 500


# ═══════════════════════════════════════════════════════════════════════════
# SESSIONS: exception handler paths
# ═══════════════════════════════════════════════════════════════════════════

class TestSessionsGaps:

    def test_list_sessions_exception(self, client):
        """Lines 61-63: exception handler in list_sessions."""
        with patch("backend.routers.sessions.get_sessions", new_callable=AsyncMock, side_effect=RuntimeError("db error")):
            resp = client.get("/api/sessions", headers={"X-User-ID": "admin"})
            assert resp.status_code == 500

    def test_get_session_forbidden(self, client):
        """Line 96: session belongs to different user."""
        resp = client.post("/api/sessions", json={"title": "owner-session"}, headers={"X-User-ID": "admin"})
        session_id = resp.json()["id"]
        resp = client.get(f"/api/sessions/{session_id}", headers={"X-User-ID": "other-user"})
        assert resp.status_code == 403

    def test_get_session_exception(self, client):
        """Lines 134-136: exception handler in get_session_detail."""
        with patch("backend.routers.sessions.get_session", new_callable=AsyncMock, side_effect=RuntimeError("error")):
            resp = client.get("/api/sessions/some-id", headers={"X-User-ID": "admin"})
            assert resp.status_code == 500

    def test_rename_session_forbidden(self, client):
        """Line 148: rename forbidden."""
        resp = client.post("/api/sessions", json={"title": "own"}, headers={"X-User-ID": "admin"})
        session_id = resp.json()["id"]
        resp = client.put(f"/api/sessions/{session_id}", json={"title": "new"},
                          headers={"X-User-ID": "other"})
        assert resp.status_code == 403

    def test_rename_session_update_returns_none(self, client):
        """Line 151: update_session_title returns None."""
        resp = client.post("/api/sessions", json={"title": "x"}, headers={"X-User-ID": "admin"})
        session_id = resp.json()["id"]
        with patch("backend.routers.sessions.update_session_title", new_callable=AsyncMock, return_value=None):
            resp = client.put(f"/api/sessions/{session_id}", json={"title": "new"},
                              headers={"X-User-ID": "admin"})
            assert resp.status_code == 404

    def test_rename_session_exception(self, client):
        """Lines 155-157: exception handler in rename."""
        resp = client.post("/api/sessions", json={"title": "x"}, headers={"X-User-ID": "admin"})
        session_id = resp.json()["id"]
        with patch("backend.routers.sessions.update_session_title", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.put(f"/api/sessions/{session_id}", json={"title": "new"},
                              headers={"X-User-ID": "admin"})
            assert resp.status_code == 500

    def test_delete_session_forbidden(self, client):
        """Line 169: delete forbidden."""
        resp = client.post("/api/sessions", json={"title": "own-del"}, headers={"X-User-ID": "admin"})
        session_id = resp.json()["id"]
        resp = client.delete(f"/api/sessions/{session_id}", headers={"X-User-ID": "other"})
        assert resp.status_code == 403

    def test_delete_session_returns_false(self, client):
        """Line 172: delete_session returns False."""
        resp = client.post("/api/sessions", json={"title": "x"}, headers={"X-User-ID": "admin"})
        session_id = resp.json()["id"]
        with patch("backend.routers.sessions.delete_session", new_callable=AsyncMock, return_value=False):
            resp = client.delete(f"/api/sessions/{session_id}", headers={"X-User-ID": "admin"})
            assert resp.status_code == 404

    def test_delete_session_exception(self, client):
        """Lines 176-178: exception handler in delete."""
        resp = client.post("/api/sessions", json={"title": "x"}, headers={"X-User-ID": "admin"})
        session_id = resp.json()["id"]
        with patch("backend.routers.sessions.delete_session", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.delete(f"/api/sessions/{session_id}", headers={"X-User-ID": "admin"})
            assert resp.status_code == 500

    def test_list_memories_forbidden(self, client):
        """Line 190: memories forbidden."""
        resp = client.post("/api/sessions", json={"title": "mem-own"}, headers={"X-User-ID": "admin"})
        session_id = resp.json()["id"]
        resp = client.get(f"/api/sessions/{session_id}/memories", headers={"X-User-ID": "other"})
        assert resp.status_code == 403

    def test_list_memories_exception(self, client):
        """Lines 205-207: exception in list memories."""
        with patch("backend.routers.sessions.get_session", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.get("/api/sessions/id/memories", headers={"X-User-ID": "admin"})
            assert resp.status_code == 500

    def test_delete_memory_exception(self, client):
        """Lines 220-222: exception in delete memory."""
        with patch("backend.routers.sessions.delete_memory_entry", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.delete("/api/memories/mem-1", headers={"X-User-ID": "admin"})
            assert resp.status_code == 500

    def test_export_memories_forbidden(self, client):
        """Line 237: export forbidden."""
        resp = client.post("/api/sessions", json={"title": "exp-own"}, headers={"X-User-ID": "admin"})
        session_id = resp.json()["id"]
        resp = client.get(f"/api/sessions/{session_id}/memories/export?format=json",
                          headers={"X-User-ID": "other"})
        assert resp.status_code == 403

    def test_export_memories_markdown_with_memory(self, client):
        """Lines 262-276: markdown export with actual memories."""
        resp = client.post("/api/sessions", json={"title": "md-export"}, headers={"X-User-ID": "admin"})
        session_id = resp.json()["id"]
        # Create a memory entry first
        with patch("backend.routers.sessions.get_session_memories", new_callable=AsyncMock) as mock_mems:
            m = MagicMock()
            m.id = "m1"
            m.agent_role = "pm"
            m.content_type = "pm_document"
            m.summary = "Test summary"
            m.details = "Test details"
            m.created_at = datetime.now(UTC)
            mock_mems.return_value = [m]
            resp = client.get(f"/api/sessions/{session_id}/memories/export?format=md",
                              headers={"X-User-ID": "admin"})
            assert resp.status_code == 200
            assert "markdown" in resp.headers["content-type"]

    def test_export_memories_exception(self, client):
        """Lines 284-286: exception in export."""
        with patch("backend.routers.sessions.get_session", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.get("/api/sessions/id/memories/export?format=json",
                              headers={"X-User-ID": "admin"})
            assert resp.status_code == 500

    def test_create_session_exception(self, client):
        """Lines 82-84: exception handler in create session."""
        with patch("backend.routers.sessions.create_session", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/sessions", json={"title": "x"}, headers={"X-User-ID": "admin"})
            assert resp.status_code == 500


# ═══════════════════════════════════════════════════════════════════════════
# TEAMS: exception handler paths + snapshot
# ═══════════════════════════════════════════════════════════════════════════

class TestTeamsGaps:

    def test_list_teams_exception(self, client):
        """Lines 72-74: exception handler."""
        with patch("backend.routers.teams.get_teams", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.get("/api/teams", headers={"X-User-ID": "admin"})
            assert resp.status_code == 500

    def test_create_team_exception(self, client):
        """Lines 119-121: exception handler."""
        with patch("backend.routers.teams.create_team", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/teams", json={"name": "err-team"})
            assert resp.status_code == 500

    def test_delete_team_not_found_return(self, client):
        """Lines 177-179: delete returns False."""
        resp = client.post("/api/teams", json={"name": "dnf-team"})
        team_id = resp.json()["id"]
        with patch("backend.routers.teams.delete_team", new_callable=AsyncMock, return_value=False):
            resp = client.delete(f"/api/teams/{team_id}")
            assert resp.status_code == 404

    def test_remove_member_not_found(self, client):
        """Lines 212-214: remove member exception."""
        with patch("backend.routers.teams.remove_team_member", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.delete("/api/teams/t/members/m")
            assert resp.status_code == 500

    def test_reorder_exception(self, client):
        """Lines 223-225: reorder exception."""
        with patch("backend.routers.teams.reorder_team_members", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.put("/api/teams/t/members/reorder", json={"member_ids": []})
            assert resp.status_code == 500

    def test_link_agent_exception(self, client):
        """Lines 242-244: link agent exception."""
        with patch("backend.routers.teams.link_agent_config", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.put("/api/teams/t/members/m/link-agent", json={"agent_config_id": "a"})
            assert resp.status_code == 500

    def test_update_team_exception(self, client):
        """Lines 158-160: update exception."""
        with patch("backend.routers.teams.update_team", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.put("/api/teams/t", json={"name": "x"})
            assert resp.status_code == 500

    def test_delete_team_exception(self, client):
        """Lines 177-179: delete exception."""
        with patch("backend.routers.teams.delete_team", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.delete("/api/teams/t")
            assert resp.status_code == 500

    def test_add_member_exception(self, client):
        """Lines 197-199: add member exception."""
        with patch("backend.routers.teams.add_team_member", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/teams/t/members", json={"name": "m"})
            assert resp.status_code == 500


# ═══════════════════════════════════════════════════════════════════════════
# MCPS: exception handler paths
# ═══════════════════════════════════════════════════════════════════════════

class TestMCPSGaps:

    def test_list_mcps_exception(self, client):
        """Lines 39-41."""
        with patch("backend.routers.mcps.get_mcps_as_dicts", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.get("/api/mcps")
            assert resp.status_code == 500

    def test_create_mcp_exception(self, client):
        """Lines 95-97."""
        with patch("backend.routers.mcps.create_mcp", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/mcps", json={"name": "x"})
            assert resp.status_code == 500

    def test_update_mcp_exception(self, client):
        """Lines 120-122."""
        with patch("backend.routers.mcps.update_mcp", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.put("/api/mcps/t", json={"name": "x"})
            assert resp.status_code == 500

    def test_delete_mcp_exception(self, client):
        """Lines 138-140."""
        with patch("backend.routers.mcps.get_mcps", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.delete("/api/mcps/t")
            assert resp.status_code == 500


# ═══════════════════════════════════════════════════════════════════════════
# PROMPTS: exception handler paths
# ═══════════════════════════════════════════════════════════════════════════

class TestPromptsGaps:

    def test_list_prompts_exception(self, client):
        """Lines 41-43."""
        with patch("backend.routers.prompts.get_prompts_as_dicts", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.get("/api/prompts")
            assert resp.status_code == 500

    def test_create_prompt_exception(self, client):
        """Lines 85-87."""
        with patch("backend.routers.prompts.create_prompt", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/prompts", json={"name": "x", "category": "c", "content": "y"})
            assert resp.status_code == 500

    def test_update_prompt_exception(self, client):
        """Lines 107-109."""
        with patch("backend.routers.prompts.update_prompt", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.put("/api/prompts/t", json={"name": "x"})
            assert resp.status_code == 500

    def test_delete_prompt_exception(self, client):
        """Lines 126-128."""
        with patch("backend.repository.get_prompts", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.delete("/api/prompts/t")
            assert resp.status_code == 500


# ═══════════════════════════════════════════════════════════════════════════
# SKILLS: exception handler paths
# ═══════════════════════════════════════════════════════════════════════════

class TestSkillsGaps:

    def test_list_skills_exception(self, client):
        """Lines 52-53."""
        with patch("backend.routers.skills.repo_get_skills_as_dicts", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.get("/api/skills")
            assert resp.status_code == 500

    def test_create_skill_exception(self, client):
        """Lines 115-116."""
        with patch("backend.routers.skills.repo_create_skill", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/skills", json={"name": "x", "category": "c"})
            assert resp.status_code == 500

    def test_update_skill_exception(self, client):
        """Lines 142-143."""
        with patch("backend.routers.skills.update_skill", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.put("/api/skills/t", json={"name": "x"})
            assert resp.status_code == 500

    def test_delete_skill_exception(self, client):
        """Lines 160-161."""
        with patch("backend.repository.skills.get_skills", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.delete("/api/skills/t")
            assert resp.status_code == 500


# ═══════════════════════════════════════════════════════════════════════════
# TOOLS: remaining error paths
# ═══════════════════════════════════════════════════════════════════════════

class TestToolsGaps:

    def test_list_tools_exception(self, client):
        """Lines 106-107."""
        with patch("backend.routers.tools.repo_get_tools_as_dicts", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.get("/api/tools")
            assert resp.status_code == 500

    def test_create_tool_exception(self, client):
        """Lines 186-187."""
        with patch("backend.routers.tools.repo_create_tool", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/tools", json={"name": "x", "category": "c"})
            assert resp.status_code == 500

    def test_delete_tool_exception(self, client):
        """Lines 219-220."""
        with patch("backend.routers.tools.get_tool", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.delete("/api/tools/t")
            assert resp.status_code == 500

    def test_test_tool_internal_exception(self, client):
        """Lines 169-170: non-HTTP/non-httpx exception in test_tool."""
        resp = client.post("/api/tools", json={
            "name": "int-tool", "category": "api", "endpoint": "http://test.com"
        })
        tool_id = resp.json()["id"]
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(side_effect=RuntimeError("internal"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client
            resp = client.post(f"/api/tools/{tool_id}/test")
            assert resp.status_code == 500


# ═══════════════════════════════════════════════════════════════════════════
# VERSIONS: version not found path
# ═══════════════════════════════════════════════════════════════════════════

class TestVersionsGaps:

    @pytest.mark.skip(reason="Depends(get_session) makes this hard to mock properly")
    def test_get_version_not_found(self, client):
        """Lines 49-52."""
        pass


# ═══════════════════════════════════════════════════════════════════════════
# AGENTS: remaining gaps
# ═══════════════════════════════════════════════════════════════════════════

class TestAgentsGaps:

    def test_list_agents_exception(self, client):
        """Lines 82-84."""
        with patch("backend.routers.agents.get_agent_configs", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.get("/api/agents")
            assert resp.status_code == 500

    def test_create_agent_exception(self, client):
        """Lines 149-151."""
        with patch("backend.routers.agents.create_agent_config", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/agents", json={
                "name": "err-agent", "role_identifier": "err_role", "system_prompt": "err"
            })
            assert resp.status_code == 500

    def test_get_agent_tools_string(self, client):
        """Lines 95-101: _parse_json with invalid string."""
        resp = client.post("/api/agents", json={
            "name": "bad-json", "role_identifier": "bad_json_role", "system_prompt": "test",
        })
        agent_id = resp.json()["id"]
        # Manually set tools to an invalid JSON string via update
        with patch("backend.routers.agents.get_agent_configs", new_callable=AsyncMock) as mock_configs:
            c = MagicMock()
            c.id = agent_id
            c.name = "bad-json"
            c.role_identifier = "bad_json_role"
            c.system_prompt = "test"
            c.output_constraints = None
            c.tools = "not json {{{"
            c.mcp = "not json {{{"
            c.skills = None
            c.model = None
            c.temperature = None
            c.order = 0
            c.is_active = True
            c.is_approver = False
            c.icon = "test"
            c.created_at = datetime.now(UTC)
            mock_configs.return_value = [c]
            resp = client.get(f"/api/agents/{agent_id}")
            assert resp.status_code == 200
            assert resp.json()["tools"] == []

    def test_delete_agent_non_approver_delete_fails(self, client):
        """Lines 220-221: delete_agent_config returns False."""
        resp = client.post("/api/agents", json={
            "name": "fail-del", "role_identifier": "fail_del_role", "system_prompt": "x"
        })
        agent_id = resp.json()["id"]
        with patch("backend.routers.agents.delete_agent_config", new_callable=AsyncMock, return_value=False):
            resp = client.delete(f"/api/agents/{agent_id}")
            assert resp.status_code == 404

    def test_toggle_agent_update_fails(self, client):
        """Lines 240-241: update_agent_config returns None."""
        resp = client.post("/api/agents", json={
            "name": "fail-toggle", "role_identifier": "fail_toggle_role", "system_prompt": "x"
        })
        agent_id = resp.json()["id"]
        with patch("backend.routers.agents.update_agent_config", new_callable=AsyncMock, return_value=None):
            resp = client.put(f"/api/agents/{agent_id}/toggle")
            assert resp.status_code == 404

    def test_delete_has_other_approvers(self, client):
        """Lines 214-217: delete approver when other approvers exist."""
        resp = client.post("/api/agents", json={
            "name": "app1", "role_identifier": "app1_role", "system_prompt": "x", "is_approver": True
        })
        agent_id = resp.json()["id"]
        resp = client.post("/api/agents", json={
            "name": "app2", "role_identifier": "app2_role", "system_prompt": "x", "is_approver": True
        })
        resp = client.delete(f"/api/agents/{agent_id}")
        assert resp.status_code == 200

    def test_toggle_has_other_active_approvers(self, client):
        """Lines 234-238: toggle off when other active approvers exist."""
        resp = client.post("/api/agents", json={
            "name": "ta1", "role_identifier": "ta1_role", "system_prompt": "x", "is_approver": True
        })
        agent_id = resp.json()["id"]
        resp = client.post("/api/agents", json={
            "name": "ta2", "role_identifier": "ta2_role", "system_prompt": "x", "is_approver": True
        })
        resp = client.put(f"/api/agents/{agent_id}/toggle")
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False


# ═══════════════════════════════════════════════════════════════════════════
# AUTH/REGISTER: remaining gaps
# ═══════════════════════════════════════════════════════════════════════════

class TestAuthRegisterGaps:

    def test_register_rate_limited(self, client):
        """Line 80: rate limit on register."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.incr = AsyncMock(return_value=4)
        mock_redis.expire = AsyncMock(return_value=True)
        with patch("backend.routers.auth.register.get_redis", return_value=mock_redis):
            resp = client.post("/api/auth/register", json={
                "email": "rl@test.com", "code": "123456", "password": "Strong@1abc"
            })
            assert resp.status_code == 429

    def test_verify_rate_limited(self, client):
        """Line 126: rate limit on verify."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.incr = AsyncMock(return_value=6)
        mock_redis.expire = AsyncMock(return_value=True)
        with patch("backend.routers.auth.register.get_redis", return_value=mock_redis):
            resp = client.post("/api/auth/verify", json={
                "email": "rl-verify@test.com", "code": "123456"
            })
            assert resp.status_code == 429

    def test_register_existing_email(self, client):
        """Line 104: register with existing email."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=b"123456")
        mock_redis.incr = AsyncMock(return_value=1)
        mock_redis.expire = AsyncMock(return_value=True)
        with patch("backend.routers.auth.register.get_redis", return_value=mock_redis), \
             patch("backend.routers.auth.register.get_user_by_email", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = MagicMock(id="existing")
            resp = client.post("/api/auth/register", json={
                "email": "exists2@test.com", "code": "123456", "password": "Strong@1abc"
            })
            assert resp.status_code == 409

    def test_verify_user_not_found(self, client):
        """Line 149: verify user not found."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=b"111111")
        mock_redis.incr = AsyncMock(return_value=1)
        mock_redis.expire = AsyncMock(return_value=True)
        mock_redis.delete = AsyncMock(return_value=True)
        with patch("backend.routers.auth.register.get_redis", return_value=mock_redis), \
             patch("backend.routers.auth.register.get_user_by_email", new_callable=AsyncMock, return_value=None):
            resp = client.post("/api/auth/verify", json={
                "email": "nouser-verify@test.com", "code": "111111"
            })
            assert resp.status_code == 400


# ═══════════════════════════════════════════════════════════════════════════
# AUTH/PASSWORD: change_password success paths (lines 130-148)
# ═══════════════════════════════════════════════════════════════════════════

class TestAuthPasswordGaps:

    def test_change_password_success(self, client):
        """Lines 130-148: full change_password flow."""
        new_hash = bcrypt.hashpw(b"NewStr0ng@Pass", bcrypt.gensalt()).decode()
        mock_user = MagicMock()
        mock_user.id = "u-change"
        mock_user.password_hash = bcrypt.hashpw(b"OldStr0ng@Pass", bcrypt.gensalt()).decode()
        mock_user.email = "change@test.com"
        with patch("backend.routers.auth.password.get_user_by_id", new_callable=AsyncMock, return_value=mock_user), \
             patch("backend.routers.auth.password.update_password", new_callable=AsyncMock), \
             patch("backend.routers.auth.password.revoke_all_user_tokens", new_callable=AsyncMock), \
             patch("backend.routers.auth.password.send_email", new_callable=AsyncMock):
            resp = client.post("/api/auth/change-password", json={
                "old_password": "OldStr0ng@Pass",
                "new_password": "NewStr0ng@Pass",
            })
            assert resp.status_code == 200
            assert "密码已修改" in resp.json()["message"]


# ═══════════════════════════════════════════════════════════════════════════
# AUTH/LOGIN: remaining gaps (locked account with aware datetime)
# ═══════════════════════════════════════════════════════════════════════════

class TestAuthLoginGaps:

    def test_login_locked_account_expired(self, client):
        """Lines 57-64: locked account with expired lock."""
        from backend.routers.auth.schemas import AuthResponse, UserResponse
        mock_user = MagicMock()
        mock_user.email = "locked-exp@test.com"
        mock_user.password_hash = bcrypt.hashpw(b"pass", bcrypt.gensalt()).decode()
        mock_user.is_verified = True
        mock_user.is_active = True
        mock_user.locked_until = datetime.now(UTC) - timedelta(hours=1)
        mock_user.username = "locked"
        user_resp = UserResponse(id="u1", email="locked-exp@test.com", username="locked", roles=[], is_verified=True)
        auth_resp = AuthResponse(access_token="tok", refresh_token="ref", expires_in=900, user=user_resp)
        with patch("backend.routers.auth.login.get_user_by_email", new_callable=AsyncMock, return_value=mock_user), \
             patch("backend.routers.auth.login.reset_failed_logins", new_callable=AsyncMock), \
             patch("backend.routers.auth.login._create_auth_response", new_callable=AsyncMock, return_value=auth_resp):
            resp = client.post("/api/auth/login", json={
                "email": "locked-exp@test.com", "password": "pass"
            })
            assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════
# RUN_CONTINUE: remaining gaps
# ═══════════════════════════════════════════════════════════════════════════

class TestRunContinueGaps:

    @patch("backend.routers.run_continue.run_service", new_callable=MagicMock)
    def test_continue_run_http_exception(self, mock_service, client):
        """Lines 45-46: HTTPException re-raised."""
        from fastapi import HTTPException
        mock_service.continue_run = AsyncMock(side_effect=HTTPException(status_code=400, detail="bad"))
        resp = client.post("/api/runs/complete", json={"content": "x"}, headers={"X-User-ID": "admin"})
        assert resp.status_code == 400
