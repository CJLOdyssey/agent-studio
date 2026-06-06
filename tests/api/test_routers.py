"""接口路由测试：TestClient 验证 HTTP 端点。"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _mock_async_session_factory():
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_scalar = MagicMock()
    mock_scalar.all.return_value = []
    mock_result.scalars.return_value = mock_scalar
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result
    mock_session.get.return_value = None
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.delete = AsyncMock()

    class _AsyncCtx:
        def __call__(self):
            return self
        async def __aenter__(self):
            return mock_session
        async def __aexit__(self, *args):
            pass

    return MagicMock(return_value=_AsyncCtx())


@pytest.fixture
def client():
    mock_redis = MagicMock()
    mock_redis.ping = AsyncMock(return_value=True)
    mock_redis.incr = AsyncMock(return_value=1)
    mock_redis.expire = AsyncMock(return_value=True)
    _mock_factory = _mock_async_session_factory()

    with (
        patch("virtual_team.broker.get_redis", return_value=mock_redis),
        patch("virtual_team.database.get_async_engine", return_value=MagicMock()),
        patch("virtual_team.database.get_session_factory", _mock_factory),
        patch("virtual_team.repository.agents.get_session_factory", _mock_factory),
        patch("virtual_team.repository.prompts.get_session_factory", _mock_factory),
        patch("virtual_team.repository.schemas.get_session_factory", _mock_factory),
        patch("virtual_team.repository.bindings.get_session_factory", _mock_factory),
        patch("virtual_team.database.init_db", new_callable=AsyncMock),
        patch("virtual_team.repository.seed_default_agents", new_callable=AsyncMock),
        patch("virtual_team.rate_limit.get_redis", return_value=mock_redis),
    ):
        from fastapi.testclient import TestClient
        from virtual_team.app import app
        yield TestClient(app)


# ============================================================
# agents.py — 接口路由测试
# ============================================================

class TestAgentsAPI:

    def test_list_agents_empty(self, client):
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock, return_value=[]):
            resp = client.get("/api/agents")
            assert resp.status_code == 200
            assert resp.json() == []

    def test_list_agents_with_data(self, client):
        a = MagicMock()
        a.id = "agent-1"
        a.name = "Agent"
        a.role_identifier = "agent"
        a.system_prompt = "prompt"
        a.output_constraints = None
        a.tools = None
        a.mcp = None
        a.skills = None
        a.model = None
        a.temperature = None
        a.order = 0
        a.is_active = True
        a.is_approver = False
        a.icon = "icon"
        a.created_at = None
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock, return_value=[a]):
            resp = client.get("/api/agents")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 1
            assert data[0]["id"] == "agent-1"

    def test_get_agent_success(self, client):
        a = MagicMock()
        a.id = "agent-1"
        a.name = "Agent"
        a.role_identifier = "agent"
        a.system_prompt = "prompt"
        a.output_constraints = None
        a.tools = None
        a.mcp = None
        a.skills = None
        a.model = None
        a.temperature = None
        a.order = 0
        a.is_active = True
        a.is_approver = False
        a.icon = "icon"
        a.created_at = None
        with patch("virtual_team.routers.agents.get_agent_config", new_callable=AsyncMock, return_value=a):
            resp = client.get("/api/agents/agent-1")
            assert resp.status_code == 200
            assert resp.json()["id"] == "agent-1"

    def test_get_agent_404(self, client):
        with patch("virtual_team.routers.agents.get_agent_config", new_callable=AsyncMock, return_value=None):
            resp = client.get("/api/agents/nonexistent")
            assert resp.status_code == 404

    def test_create_agent_success(self, client):
        created = MagicMock()
        created.id = "agent-1"
        with (
            patch("virtual_team.routers.agents.get_agent_config_by_role", new_callable=AsyncMock, return_value=None),
            patch("virtual_team.routers.agents.create_agent_config", new_callable=AsyncMock, return_value=created),
        ):
            resp = client.post("/api/agents", json={
                "name": "Agent", "role_identifier": "agent", "system_prompt": "prompt",
            })
            assert resp.status_code == 201
            assert resp.json()["status"] == "created"

    def test_create_agent_409(self, client):
        existing = MagicMock()
        existing.role_identifier = "agent"
        with patch("virtual_team.routers.agents.get_agent_config_by_role", new_callable=AsyncMock, return_value=existing):
            resp = client.post("/api/agents", json={
                "name": "Agent", "role_identifier": "agent", "system_prompt": "prompt",
            })
            assert resp.status_code == 409

    def test_edit_agent_success(self, client):
        updated = MagicMock()
        updated.id = "agent-1"
        with patch("virtual_team.routers.agents.update_agent_config", new_callable=AsyncMock, return_value=updated):
            resp = client.put("/api/agents/agent-1", json={"name": "New"})
            assert resp.status_code == 200
            assert resp.json()["status"] == "updated"

    def test_edit_agent_404(self, client):
        with patch("virtual_team.routers.agents.update_agent_config", new_callable=AsyncMock, return_value=None):
            resp = client.put("/api/agents/agent-1", json={"name": "New"})
            assert resp.status_code == 404

    def test_delete_agent_success(self, client):
        a = MagicMock()
        a.id = "agent-1"
        a.is_approver = False
        with (
            patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock, return_value=[a]),
            patch("virtual_team.routers.agents.delete_agent_config", new_callable=AsyncMock, return_value=True),
        ):
            resp = client.delete("/api/agents/agent-1")
            assert resp.status_code == 200
            assert resp.json() == {"status": "deleted"}

    def test_delete_agent_404(self, client):
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock, return_value=[]):
            resp = client.delete("/api/agents/nonexistent")
            assert resp.status_code == 404

    def test_delete_agent_last_approver_400(self, client):
        a = MagicMock()
        a.id = "agent-1"
        a.is_approver = True
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock, return_value=[a]):
            resp = client.delete("/api/agents/agent-1")
            assert resp.status_code == 400

    def test_toggle_agent_success(self, client):
        a = MagicMock()
        a.id = "agent-1"
        a.is_approver = False
        a.is_active = True
        updated = MagicMock()
        updated.id = "agent-1"
        updated.is_active = False
        with (
            patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock, return_value=[a]),
            patch("virtual_team.routers.agents.update_agent_config", new_callable=AsyncMock, return_value=updated),
        ):
            resp = client.put("/api/agents/agent-1/toggle")
            assert resp.status_code == 200
            assert resp.json()["is_active"] is False

    def test_toggle_agent_404(self, client):
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock, return_value=[]):
            resp = client.put("/api/agents/nonexistent/toggle")
            assert resp.status_code == 404

    def test_toggle_agent_last_active_approver_400(self, client):
        a = MagicMock()
        a.id = "agent-1"
        a.is_approver = True
        a.is_active = True
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock, return_value=[a]):
            resp = client.put("/api/agents/agent-1/toggle")
            assert resp.status_code == 400


# ============================================================
# prompts.py — 接口路由测试
# ============================================================

class TestPromptsAPI:

    def test_create_prompt_201(self, client):
        p = MagicMock()
        p.id = "p-1"
        p.agent_id = "agent-1"
        p.version = 1
        p.content = "test"
        p.change_reason = None
        p.is_active = True
        p.created_at = None
        with patch("virtual_team.routers.prompts.create_prompt", new_callable=AsyncMock, return_value=p):
            resp = client.post("/api/agents/agent-1/prompts", json={"content": "test"})
            assert resp.status_code == 201
            assert resp.json()["id"] == "p-1"

    def test_list_prompts_200(self, client):
        with patch("virtual_team.routers.prompts.get_prompts", new_callable=AsyncMock, return_value=[]):
            resp = client.get("/api/agents/agent-1/prompts")
            assert resp.status_code == 200
            assert resp.json() == []

    def test_activate_prompt_200(self, client):
        p = MagicMock()
        p.id = "p-1"
        p.version = 1
        p.is_active = True
        with patch("virtual_team.routers.prompts.activate_prompt", new_callable=AsyncMock, return_value=p):
            resp = client.put("/api/agents/agent-1/prompts/activate", json={"prompt_id": "p-1"})
            assert resp.status_code == 200
            assert resp.json()["is_active"] is True

    def test_activate_prompt_404(self, client):
        with patch("virtual_team.routers.prompts.activate_prompt", new_callable=AsyncMock, return_value=None):
            resp = client.put("/api/agents/agent-1/prompts/activate", json={"prompt_id": "nonexistent"})
            assert resp.status_code == 404


# ============================================================
# schemas.py — 接口路由测试
# ============================================================

class TestSchemasAPI:

    def test_create_schema_201(self, client):
        s = MagicMock()
        s.id = "s-1"
        s.name = "test"
        with patch("virtual_team.routers.schemas.create_output_schema", new_callable=AsyncMock, return_value=s):
            resp = client.post("/api/agents/agent-1/schemas", json={
                "name": "test", "format_type": "markdown", "schema_def": {"type": "object"},
            })
            assert resp.status_code == 201
            assert resp.json()["status"] == "created"

    def test_list_schemas_200(self, client):
        with patch("virtual_team.routers.schemas.get_output_schemas", new_callable=AsyncMock, return_value=[]):
            resp = client.get("/api/agents/agent-1/schemas")
            assert resp.status_code == 200

    def test_update_schema_200(self, client):
        s = MagicMock()
        s.id = "s-1"
        with patch("virtual_team.routers.schemas.update_output_schema", new_callable=AsyncMock, return_value=s):
            resp = client.put("/api/agents/agent-1/schemas/s-1", json={"name": "new"})
            assert resp.status_code == 200
            assert resp.json()["status"] == "updated"

    def test_update_schema_404(self, client):
        with patch("virtual_team.routers.schemas.update_output_schema", new_callable=AsyncMock, return_value=None):
            resp = client.put("/api/agents/agent-1/schemas/s-1", json={"name": "new"})
            assert resp.status_code == 404

    def test_delete_schema_200(self, client):
        with patch("virtual_team.routers.schemas.delete_output_schema", new_callable=AsyncMock, return_value=True):
            resp = client.delete("/api/agents/agent-1/schemas/s-1")
            assert resp.status_code == 200
            assert resp.json()["status"] == "deleted"

    def test_delete_schema_404(self, client):
        with patch("virtual_team.routers.schemas.delete_output_schema", new_callable=AsyncMock, return_value=False):
            resp = client.delete("/api/agents/agent-1/schemas/s-1")
            assert resp.status_code == 404


# ============================================================
# bindings.py — 接口路由测试
# ============================================================

class TestBindingsAPI:

    # --- Tools ---

    def test_bind_tool_201(self, client):
        b = MagicMock()
        b.id = "b-1"
        b.agent_id = "agent-1"
        b.tool_id = "tool-1"
        with patch("virtual_team.routers.bindings.bind_tool", new_callable=AsyncMock, return_value=b):
            resp = client.post("/api/agents/agent-1/tools", json={"tool_id": "tool-1"})
            assert resp.status_code == 201
            assert resp.json()["status"] == "bound"

    def test_unbind_tool_200(self, client):
        with patch("virtual_team.routers.bindings.unbind_tool", new_callable=AsyncMock, return_value=True):
            resp = client.delete("/api/agents/agent-1/tools/tool-1")
            assert resp.status_code == 200
            assert resp.json()["status"] == "unbound"

    def test_unbind_tool_404(self, client):
        with patch("virtual_team.routers.bindings.unbind_tool", new_callable=AsyncMock, return_value=False):
            resp = client.delete("/api/agents/agent-1/tools/tool-1")
            assert resp.status_code == 404

    def test_list_tools_200(self, client):
        with patch("virtual_team.routers.bindings.get_agent_tools", new_callable=AsyncMock, return_value=[]):
            resp = client.get("/api/agents/agent-1/tools")
            assert resp.status_code == 200

    # --- MCP ---

    def test_bind_mcp_201(self, client):
        b = MagicMock()
        b.id = "b-1"
        b.agent_id = "agent-1"
        b.mcp_id = "mcp-1"
        with patch("virtual_team.routers.bindings.bind_mcp", new_callable=AsyncMock, return_value=b):
            resp = client.post("/api/agents/agent-1/mcp", json={"mcp_id": "mcp-1"})
            assert resp.status_code == 201
            assert resp.json()["status"] == "bound"

    def test_unbind_mcp_200(self, client):
        with patch("virtual_team.routers.bindings.unbind_mcp", new_callable=AsyncMock, return_value=True):
            resp = client.delete("/api/agents/agent-1/mcp/mcp-1")
            assert resp.status_code == 200
            assert resp.json()["status"] == "unbound"

    def test_unbind_mcp_404(self, client):
        with patch("virtual_team.routers.bindings.unbind_mcp", new_callable=AsyncMock, return_value=False):
            resp = client.delete("/api/agents/agent-1/mcp/mcp-1")
            assert resp.status_code == 404

    def test_list_mcp_200(self, client):
        with patch("virtual_team.routers.bindings.get_agent_mcp", new_callable=AsyncMock, return_value=[]):
            resp = client.get("/api/agents/agent-1/mcp")
            assert resp.status_code == 200

    # --- Skills ---

    def test_bind_skill_201(self, client):
        b = MagicMock()
        b.id = "b-1"
        b.agent_id = "agent-1"
        b.skill_id = "skill-1"
        with patch("virtual_team.routers.bindings.bind_skill", new_callable=AsyncMock, return_value=b):
            resp = client.post("/api/agents/agent-1/skills", json={"skill_id": "skill-1"})
            assert resp.status_code == 201
            assert resp.json()["status"] == "bound"

    def test_unbind_skill_200(self, client):
        with patch("virtual_team.routers.bindings.unbind_skill", new_callable=AsyncMock, return_value=True):
            resp = client.delete("/api/agents/agent-1/skills/skill-1")
            assert resp.status_code == 200
            assert resp.json()["status"] == "unbound"

    def test_unbind_skill_404(self, client):
        with patch("virtual_team.routers.bindings.unbind_skill", new_callable=AsyncMock, return_value=False):
            resp = client.delete("/api/agents/agent-1/skills/skill-1")
            assert resp.status_code == 404

    def test_list_skills_200(self, client):
        with patch("virtual_team.routers.bindings.get_agent_skills", new_callable=AsyncMock, return_value=[]):
            resp = client.get("/api/agents/agent-1/skills")
            assert resp.status_code == 200
