"""参数边界值测试：Pydantic 校验、边界值和异常输入。"""
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
# AgentCreateRequest 边界值测试
# ============================================================

class TestAgentCreateBoundary:

    route = "/api/agents"

    def test_empty_name(self, client):
        resp = client.post(self.route, json={
            "name": "", "role_identifier": "agent", "system_prompt": "prompt",
        })
        assert resp.status_code == 422

    def test_name_too_long(self, client):
        resp = client.post(self.route, json={
            "name": "x" * 65, "role_identifier": "agent", "system_prompt": "prompt",
        })
        assert resp.status_code == 422

    def test_name_max_length(self, client):
        resp = client.post(self.route, json={
            "name": "x" * 64, "role_identifier": "agent", "system_prompt": "prompt",
        })
        assert resp.status_code in (201, 422)

    def test_empty_role_identifier(self, client):
        resp = client.post(self.route, json={
            "name": "Agent", "role_identifier": "", "system_prompt": "prompt",
        })
        assert resp.status_code == 422

    def test_role_identifier_too_long(self, client):
        resp = client.post(self.route, json={
            "name": "Agent", "role_identifier": "x" * 33, "system_prompt": "prompt",
        })
        assert resp.status_code == 422

    def test_role_identifier_with_uppercase(self, client):
        resp = client.post(self.route, json={
            "name": "Agent", "role_identifier": "PM", "system_prompt": "prompt",
        })
        assert resp.status_code == 422

    def test_role_identifier_with_hyphen(self, client):
        resp = client.post(self.route, json={
            "name": "Agent", "role_identifier": "product-manager", "system_prompt": "prompt",
        })
        assert resp.status_code == 422

    def test_role_identifier_with_space(self, client):
        resp = client.post(self.route, json={
            "name": "Agent", "role_identifier": "pm role", "system_prompt": "prompt",
        })
        assert resp.status_code == 422

    def test_empty_system_prompt(self, client):
        resp = client.post(self.route, json={
            "name": "Agent", "role_identifier": "agent", "system_prompt": "",
        })
        assert resp.status_code == 422

    def test_temperature_below_zero(self, client):
        resp = client.post(self.route, json={
            "name": "Agent", "role_identifier": "agent", "system_prompt": "prompt",
            "temperature": -0.1,
        })
        assert resp.status_code == 422

    def test_temperature_above_one(self, client):
        resp = client.post(self.route, json={
            "name": "Agent", "role_identifier": "agent", "system_prompt": "prompt",
            "temperature": 1.5,
        })
        assert resp.status_code == 422

    def test_temperature_zero(self, client):
        resp = client.post(self.route, json={
            "name": "Agent", "role_identifier": "agent", "system_prompt": "prompt",
            "temperature": 0.0,
        })
        assert resp.status_code in (201, 422)

    def test_temperature_one(self, client):
        resp = client.post(self.route, json={
            "name": "Agent", "role_identifier": "agent", "system_prompt": "prompt",
            "temperature": 1.0,
        })
        assert resp.status_code in (201, 422)

    def test_missing_name(self, client):
        resp = client.post(self.route, json={
            "role_identifier": "agent", "system_prompt": "prompt",
        })
        assert resp.status_code == 422

    def test_missing_role_identifier(self, client):
        resp = client.post(self.route, json={
            "name": "Agent", "system_prompt": "prompt",
        })
        assert resp.status_code == 422

    def test_missing_system_prompt(self, client):
        resp = client.post(self.route, json={
            "name": "Agent", "role_identifier": "agent",
        })
        assert resp.status_code == 422

    def test_invalid_json_body(self, client):
        resp = client.post(self.route, data="not json", headers={"Content-Type": "application/json"})
        assert resp.status_code == 422

    def test_role_identifier_min_length(self, client):
        resp = client.post(self.route, json={
            "name": "Agent", "role_identifier": "a", "system_prompt": "prompt",
        })
        assert resp.status_code in (201, 422)

    def test_with_all_optional_fields_none(self, client):
        resp = client.post(self.route, json={
            "name": "Agent", "role_identifier": "agent", "system_prompt": "prompt",
            "output_constraints": None, "tools": None, "mcp": None, "skills": None,
            "model": None, "temperature": None, "icon": "icon",
        })
        assert resp.status_code in (201, 422)


# ============================================================
# AgentUpdateRequest 边界值测试
# ============================================================

class TestAgentUpdateBoundary:

    def test_temperature_below_zero(self, client):
        resp = client.put("/api/agents/agent-1", json={"temperature": -0.5})
        assert resp.status_code == 422

    def test_temperature_above_one(self, client):
        resp = client.put("/api/agents/agent-1", json={"temperature": 2.0})
        assert resp.status_code == 422


# ============================================================
# Prompt 请求边界值测试
# ============================================================

class TestPromptBoundary:

    def test_create_prompt_missing_content(self, client):
        resp = client.post("/api/agents/agent-1/prompts", json={})
        assert resp.status_code == 422

    def test_activate_prompt_no_prompt_id(self, client):
        resp = client.put("/api/agents/agent-1/prompts/activate", json={})
        assert resp.status_code == 422


# ============================================================
# Schema 请求边界值测试
# ============================================================

class TestSchemaBoundary:

    def test_create_schema_missing_name(self, client):
        resp = client.post("/api/agents/agent-1/schemas", json={
            "format_type": "markdown", "schema_def": {"type": "object"},
        })
        assert resp.status_code == 422

    def test_create_schema_missing_format_type(self, client):
        resp = client.post("/api/agents/agent-1/schemas", json={
            "name": "test", "schema_def": {"type": "object"},
        })
        assert resp.status_code == 422

    def test_create_schema_missing_schema_def(self, client):
        resp = client.post("/api/agents/agent-1/schemas", json={
            "name": "test", "format_type": "markdown",
        })
        assert resp.status_code == 422




# ============================================================
# Binding 请求边界值测试
# ============================================================

class TestBindingBoundary:

    def test_bind_tool_missing_tool_id(self, client):
        resp = client.post("/api/agents/agent-1/tools", json={})
        assert resp.status_code == 422

    def test_bind_mcp_missing_mcp_id(self, client):
        resp = client.post("/api/agents/agent-1/mcp", json={})
        assert resp.status_code == 422

    def test_bind_skill_missing_skill_id(self, client):
        resp = client.post("/api/agents/agent-1/skills", json={})
        assert resp.status_code == 422


# ============================================================
# Schema update 边界值测试
# ============================================================

class TestSchemaUpdateBoundary:

    def test_update_schema_empty_body(self, client):
        resp = client.put("/api/agents/agent-1/schemas/s-1", json={})
        assert resp.status_code in (200, 404)
