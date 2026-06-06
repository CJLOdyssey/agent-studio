"""业务测试：直接调用 router 函数覆盖所有业务逻辑路径。"""
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException


def _make_agent(**kw):
    a = MagicMock()
    a.id = kw.get("id", "agent-1")
    a.name = kw.get("name", "Agent")
    a.role_identifier = kw.get("role_identifier", "agent")
    a.system_prompt = kw.get("system_prompt", "prompt")
    a.output_constraints = kw.get("output_constraints", None)
    a.tools = kw.get("tools", None)
    a.mcp = kw.get("mcp", None)
    a.skills = kw.get("skills", None)
    a.model = kw.get("model", None)
    a.temperature = kw.get("temperature", None)
    a.order = kw.get("order", 0)
    a.is_active = kw.get("is_active", True)
    a.is_approver = kw.get("is_approver", False)
    a.icon = kw.get("icon", "icon")
    a.created_at = kw.get("created_at", None)
    return a


def _mock_binding(**kw):
    b = MagicMock()
    b.id = kw.get("id", "b-1")
    b.agent_id = kw.get("agent_id", "agent-1")
    b.tool_id = kw.get("tool_id", None)
    b.mcp_id = kw.get("mcp_id", None)
    b.skill_id = kw.get("skill_id", None)
    b.config_override = kw.get("config_override", None)
    b.tool_filter = kw.get("tool_filter", None)
    return b


def _mock_prompt(**kw):
    p = MagicMock()
    p.id = kw.get("id", "p-1")
    p.agent_id = kw.get("agent_id", "agent-1")
    p.version = kw.get("version", 1)
    p.content = kw.get("content", "content")
    p.change_reason = kw.get("change_reason", None)
    p.is_active = kw.get("is_active", True)
    p.created_at = kw.get("created_at", None)
    return p


def _mock_schema(**kw):
    s = MagicMock()
    s.id = kw.get("id", "s-1")
    s.name = kw.get("name", "schema")
    s.format_type = kw.get("format_type", "markdown")
    s.schema_def = kw.get("schema_def", '{"type":"object"}')
    s.example = kw.get("example", None)
    s.created_at = kw.get("created_at", None)
    return s


# ============================================================
# agents.py — 业务测试
# ============================================================

class TestListAgents:
    async def _call(self):
        from virtual_team.routers.agents import list_agents
        return await list_agents()

    async def test_success_empty(self):
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock, return_value=[]):
            result = await self._call()
            assert result == []

    async def test_success_with_data(self):
        a = _make_agent(created_at=datetime(2025, 1, 1))
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock, return_value=[a]):
            result = await self._call()
            assert len(result) == 1
            assert result[0]["id"] == "agent-1"
            assert result[0]["created_at"] == "2025-01-01T00:00:00"

    async def test_exception_500(self):
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock, side_effect=Exception("db")):
            with pytest.raises(HTTPException) as exc:
                await self._call()
            assert exc.value.status_code == 500


class TestGetAgent:
    async def _call(self, agent_id):
        from virtual_team.routers.agents import get_agent
        return await get_agent(agent_id)

    async def test_success(self):
        a = _make_agent()
        with patch("virtual_team.routers.agents.get_agent_config", new_callable=AsyncMock, return_value=a):
            result = await self._call("agent-1")
            assert result["id"] == "agent-1"

    async def test_not_found_404(self):
        with patch("virtual_team.routers.agents.get_agent_config", new_callable=AsyncMock, return_value=None):
            with pytest.raises(HTTPException) as exc:
                await self._call("agent-1")
            assert exc.value.status_code == 404

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.agents.get_agent_config", new_callable=AsyncMock,
                   side_effect=HTTPException(403, "no")):
            with pytest.raises(HTTPException) as exc:
                await self._call("agent-1")
            assert exc.value.status_code == 403

    async def test_exception_500(self):
        with patch("virtual_team.routers.agents.get_agent_config", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            with pytest.raises(HTTPException) as exc:
                await self._call("agent-1")
            assert exc.value.status_code == 500


class TestAddAgent:
    async def _call(self, **data):
        from virtual_team.routers.agents import add_agent, AgentCreateRequest
        req = AgentCreateRequest(**data)
        return await add_agent(req)

    async def test_success(self):
        created = _make_agent()
        with (
            patch("virtual_team.routers.agents.get_agent_config_by_role", new_callable=AsyncMock, return_value=None),
            patch("virtual_team.routers.agents.create_agent_config", new_callable=AsyncMock, return_value=created),
        ):
            result = await self._call(name="Agent", role_identifier="agent", system_prompt="prompt")
            assert result["status"] == "created"

    async def test_duplicate_role_409(self):
        existing = _make_agent()
        with patch("virtual_team.routers.agents.get_agent_config_by_role", new_callable=AsyncMock, return_value=existing):
            from virtual_team.routers.agents import add_agent, AgentCreateRequest
            req = AgentCreateRequest(name="Agent", role_identifier="agent", system_prompt="prompt")
            with pytest.raises(HTTPException) as exc:
                await add_agent(req)
            assert exc.value.status_code == 409

    async def test_exception_500(self):
        with (
            patch("virtual_team.routers.agents.get_agent_config_by_role", new_callable=AsyncMock, return_value=None),
            patch("virtual_team.routers.agents.create_agent_config", new_callable=AsyncMock,
                  side_effect=Exception("db")),
        ):
            from virtual_team.routers.agents import add_agent, AgentCreateRequest
            req = AgentCreateRequest(name="Agent", role_identifier="agent", system_prompt="prompt")
            with pytest.raises(HTTPException) as exc:
                await add_agent(req)
            assert exc.value.status_code == 500

    async def test_with_tools_mcp_skills_model_temp(self):
        created = _make_agent()
        with (
            patch("virtual_team.routers.agents.get_agent_config_by_role", new_callable=AsyncMock, return_value=None),
            patch("virtual_team.routers.agents.create_agent_config", new_callable=AsyncMock, return_value=created),
        ):
            from virtual_team.routers.agents import add_agent, AgentCreateRequest
            req = AgentCreateRequest(
                name="Agent", role_identifier="agent", system_prompt="prompt",
                tools=[{"key": "val"}], mcp=[{"key": "val"}], skills=[{"key": "val"}],
                model="gpt-4", temperature=0.5,
            )
            result = await add_agent(req)
            assert result["status"] == "created"

    async def test_get_agent_by_role_raises_http(self):
        with patch("virtual_team.routers.agents.get_agent_config_by_role", new_callable=AsyncMock,
                   side_effect=HTTPException(403, "no")):
            from virtual_team.routers.agents import add_agent, AgentCreateRequest
            req = AgentCreateRequest(name="Agent", role_identifier="agent", system_prompt="prompt")
            with pytest.raises(HTTPException) as exc:
                await add_agent(req)
            assert exc.value.status_code == 403


class TestEditAgent:
    async def _call(self, agent_id, **data):
        from virtual_team.routers.agents import edit_agent, AgentUpdateRequest
        req = AgentUpdateRequest(**{k: v for k, v in data.items() if v is not None})
        return await edit_agent(agent_id, req)

    async def test_success(self):
        updated = _make_agent()
        with patch("virtual_team.routers.agents.update_agent_config", new_callable=AsyncMock, return_value=updated):
            result = await self._call("agent-1", name="New")
            assert result["status"] == "updated"

    async def test_not_found_404(self):
        with patch("virtual_team.routers.agents.update_agent_config", new_callable=AsyncMock, return_value=None):
            with pytest.raises(HTTPException) as exc:
                await self._call("agent-1", name="New")
            assert exc.value.status_code == 404

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.agents.update_agent_config", new_callable=AsyncMock,
                   side_effect=HTTPException(403, "no")):
            with pytest.raises(HTTPException) as exc:
                await self._call("agent-1", name="New")
            assert exc.value.status_code == 403

    async def test_exception_500(self):
        with patch("virtual_team.routers.agents.update_agent_config", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            with pytest.raises(HTTPException) as exc:
                await self._call("agent-1", name="New")
            assert exc.value.status_code == 500

    async def test_with_tools_mcp_skills(self):
        updated = _make_agent()
        with patch("virtual_team.routers.agents.update_agent_config", new_callable=AsyncMock, return_value=updated):
            from virtual_team.routers.agents import edit_agent, AgentUpdateRequest
            req = AgentUpdateRequest(tools=[{"k": "v"}], mcp=[{"k": "v"}], skills=[{"k": "v"}])
            result = await edit_agent("agent-1", req)
            assert result["status"] == "updated"

    async def test_empty_update(self):
        updated = _make_agent()
        with patch("virtual_team.routers.agents.update_agent_config", new_callable=AsyncMock, return_value=updated):
            from virtual_team.routers.agents import edit_agent, AgentUpdateRequest
            req = AgentUpdateRequest()
            result = await edit_agent("agent-1", req)
            assert result["status"] == "updated"


class TestRemoveAgent:
    async def _call(self, agent_id, agents=None):
        from virtual_team.routers.agents import remove_agent
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock, return_value=agents or []):
            return await remove_agent(agent_id)

    async def test_success(self):
        agents = [_make_agent(is_approver=False)]
        with patch("virtual_team.routers.agents.delete_agent_config", new_callable=AsyncMock, return_value=True):
            result = await self._call("agent-1", agents)
            assert result == {"status": "deleted"}

    async def test_not_found_target_404(self):
        with pytest.raises(HTTPException) as exc:
            await self._call("agent-1", [])
        assert exc.value.status_code == 404

    async def test_last_approver_400(self):
        agents = [_make_agent(is_approver=True)]
        with pytest.raises(HTTPException) as exc:
            await self._call("agent-1", agents)
        assert exc.value.status_code == 400

    async def test_delete_fails_404(self):
        agents = [_make_agent(is_approver=False)]
        with patch("virtual_team.routers.agents.delete_agent_config", new_callable=AsyncMock, return_value=None):
            with pytest.raises(HTTPException) as exc:
                await self._call("agent-1", agents)
            assert exc.value.status_code == 404

    async def test_http_exception_re_raise(self):
        agents = [_make_agent(is_approver=False)]
        with patch("virtual_team.routers.agents.delete_agent_config", new_callable=AsyncMock,
                   side_effect=HTTPException(403, "no")):
            with pytest.raises(HTTPException) as exc:
                await self._call("agent-1", agents)
            assert exc.value.status_code == 403

    async def test_exception_500(self):
        agents = [_make_agent(is_approver=False)]
        with patch("virtual_team.routers.agents.delete_agent_config", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            with pytest.raises(HTTPException) as exc:
                await self._call("agent-1", agents)
            assert exc.value.status_code == 500

    async def test_approver_with_other_approver_success(self):
        agents = [_make_agent(id="agent-1", is_approver=True), _make_agent(id="agent-2", is_approver=True)]
        with patch("virtual_team.routers.agents.delete_agent_config", new_callable=AsyncMock, return_value=True):
            result = await self._call("agent-1", agents)
            assert result == {"status": "deleted"}


class TestToggleAgent:
    async def _call(self, agent_id, agents=None):
        from virtual_team.routers.agents import toggle_agent
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock, return_value=agents or []):
            return await toggle_agent(agent_id)

    async def test_success(self):
        agents = [_make_agent(is_approver=False)]
        updated = _make_agent(is_active=False)
        with patch("virtual_team.routers.agents.update_agent_config", new_callable=AsyncMock, return_value=updated):
            result = await self._call("agent-1", agents)
            assert result["is_active"] is False

    async def test_not_found_404(self):
        with pytest.raises(HTTPException) as exc:
            await self._call("agent-1", [])
        assert exc.value.status_code == 404

    async def test_last_active_approver_400(self):
        agents = [_make_agent(is_approver=True, is_active=True)]
        with pytest.raises(HTTPException) as exc:
            await self._call("agent-1", agents)
        assert exc.value.status_code == 400

    async def test_approver_with_other_active_approver_success(self):
        agents = [
            _make_agent(id="agent-1", is_approver=True, is_active=True),
            _make_agent(id="agent-2", is_approver=True, is_active=True),
        ]
        updated = _make_agent(is_active=False)
        with patch("virtual_team.routers.agents.update_agent_config", new_callable=AsyncMock, return_value=updated):
            result = await self._call("agent-1", agents)
            assert result["is_active"] is False

    async def test_not_found_after_update_404(self):
        agents = [_make_agent(is_approver=False)]
        with patch("virtual_team.routers.agents.update_agent_config", new_callable=AsyncMock, return_value=None):
            with pytest.raises(HTTPException) as exc:
                await self._call("agent-1", agents)
            assert exc.value.status_code == 404

    async def test_non_approver_toggle_success(self):
        agents = [_make_agent(is_approver=False)]
        updated = _make_agent(is_active=False)
        with patch("virtual_team.routers.agents.update_agent_config", new_callable=AsyncMock, return_value=updated):
            result = await self._call("agent-1", agents)
            assert result["is_active"] is False


# ============================================================
# prompts.py — 业务测试
# ============================================================

class TestCreatePrompt:
    async def test_success(self):
        p = _mock_prompt()
        with patch("virtual_team.routers.prompts.create_prompt", new_callable=AsyncMock, return_value=p):
            from virtual_team.routers.prompts import create_agent_prompt, PromptCreateRequest
            req = PromptCreateRequest(content="test")
            result = await create_agent_prompt("agent-1", req)
            assert result["id"] == "p-1"

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.prompts.create_prompt", new_callable=AsyncMock,
                   side_effect=HTTPException(422, "bad")):
            from virtual_team.routers.prompts import create_agent_prompt, PromptCreateRequest
            req = PromptCreateRequest(content="test")
            with pytest.raises(HTTPException) as exc:
                await create_agent_prompt("agent-1", req)
            assert exc.value.status_code == 422

    async def test_exception_500(self):
        with patch("virtual_team.routers.prompts.create_prompt", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.prompts import create_agent_prompt, PromptCreateRequest
            req = PromptCreateRequest(content="test")
            with pytest.raises(HTTPException) as exc:
                await create_agent_prompt("agent-1", req)
            assert exc.value.status_code == 500

    async def test_with_change_reason(self):
        p = _mock_prompt(change_reason="updated")
        with patch("virtual_team.routers.prompts.create_prompt", new_callable=AsyncMock, return_value=p):
            from virtual_team.routers.prompts import create_agent_prompt, PromptCreateRequest
            req = PromptCreateRequest(content="test", change_reason="updated")
            result = await create_agent_prompt("agent-1", req)
            assert result["change_reason"] == "updated"


class TestListPrompts:
    async def test_success_empty(self):
        with patch("virtual_team.routers.prompts.get_prompts", new_callable=AsyncMock, return_value=[]):
            from virtual_team.routers.prompts import list_agent_prompts
            result = await list_agent_prompts("agent-1")
            assert result == []

    async def test_success_with_data(self):
        p = _mock_prompt(created_at=datetime(2025, 1, 1))
        with patch("virtual_team.routers.prompts.get_prompts", new_callable=AsyncMock, return_value=[p]):
            from virtual_team.routers.prompts import list_agent_prompts
            result = await list_agent_prompts("agent-1")
            assert len(result) == 1

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.prompts.get_prompts", new_callable=AsyncMock,
                   side_effect=HTTPException(422, "bad")):
            from virtual_team.routers.prompts import list_agent_prompts
            with pytest.raises(HTTPException) as exc:
                await list_agent_prompts("agent-1")
            assert exc.value.status_code == 422

    async def test_exception_500(self):
        with patch("virtual_team.routers.prompts.get_prompts", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.prompts import list_agent_prompts
            with pytest.raises(HTTPException) as exc:
                await list_agent_prompts("agent-1")
            assert exc.value.status_code == 500


class TestActivatePrompt:
    async def test_success(self):
        p = _mock_prompt(is_active=True)
        with patch("virtual_team.routers.prompts.activate_prompt", new_callable=AsyncMock, return_value=p):
            from virtual_team.routers.prompts import activate_agent_prompt, PromptActivateRequest
            req = PromptActivateRequest(prompt_id="p-1")
            result = await activate_agent_prompt("agent-1", req)
            assert result["is_active"] is True

    async def test_not_found_404(self):
        with patch("virtual_team.routers.prompts.activate_prompt", new_callable=AsyncMock, return_value=None):
            from virtual_team.routers.prompts import activate_agent_prompt, PromptActivateRequest
            req = PromptActivateRequest(prompt_id="p-1")
            with pytest.raises(HTTPException) as exc:
                await activate_agent_prompt("agent-1", req)
            assert exc.value.status_code == 404

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.prompts.activate_prompt", new_callable=AsyncMock,
                   side_effect=HTTPException(403, "no")):
            from virtual_team.routers.prompts import activate_agent_prompt, PromptActivateRequest
            req = PromptActivateRequest(prompt_id="p-1")
            with pytest.raises(HTTPException) as exc:
                await activate_agent_prompt("agent-1", req)
            assert exc.value.status_code == 403

    async def test_exception_500(self):
        with patch("virtual_team.routers.prompts.activate_prompt", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.prompts import activate_agent_prompt, PromptActivateRequest
            req = PromptActivateRequest(prompt_id="p-1")
            with pytest.raises(HTTPException) as exc:
                await activate_agent_prompt("agent-1", req)
            assert exc.value.status_code == 500


# ============================================================
# schemas.py — 业务测试
# ============================================================

class TestCreateSchema:
    async def test_success(self):
        s = _mock_schema()
        with patch("virtual_team.routers.schemas.create_output_schema", new_callable=AsyncMock, return_value=s):
            from virtual_team.routers.schemas import create_agent_schema, SchemaCreateRequest
            req = SchemaCreateRequest(name="test", format_type="markdown", schema_def={"type": "object"})
            result = await create_agent_schema("agent-1", req)
            assert result["status"] == "created"

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.schemas.create_output_schema", new_callable=AsyncMock,
                   side_effect=HTTPException(409, "conflict")):
            from virtual_team.routers.schemas import create_agent_schema, SchemaCreateRequest
            req = SchemaCreateRequest(name="test", format_type="markdown", schema_def={"type": "object"})
            with pytest.raises(HTTPException) as exc:
                await create_agent_schema("agent-1", req)
            assert exc.value.status_code == 409

    async def test_exception_500(self):
        with patch("virtual_team.routers.schemas.create_output_schema", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.schemas import create_agent_schema, SchemaCreateRequest
            req = SchemaCreateRequest(name="test", format_type="markdown", schema_def={"type": "object"})
            with pytest.raises(HTTPException) as exc:
                await create_agent_schema("agent-1", req)
            assert exc.value.status_code == 500

    async def test_with_example(self):
        s = _mock_schema(example="# Doc")
        with patch("virtual_team.routers.schemas.create_output_schema", new_callable=AsyncMock, return_value=s):
            from virtual_team.routers.schemas import create_agent_schema, SchemaCreateRequest
            req = SchemaCreateRequest(name="test", format_type="markdown", schema_def={"type": "object"}, example="# Doc")
            result = await create_agent_schema("agent-1", req)
            assert result["status"] == "created"


class TestListSchemas:
    async def test_success_empty(self):
        with patch("virtual_team.routers.schemas.get_output_schemas", new_callable=AsyncMock, return_value=[]):
            from virtual_team.routers.schemas import list_agent_schemas
            result = await list_agent_schemas("agent-1")
            assert result == []

    async def test_success_with_data(self):
        s = _mock_schema(created_at=datetime(2025, 1, 1))
        with patch("virtual_team.routers.schemas.get_output_schemas", new_callable=AsyncMock, return_value=[s]):
            from virtual_team.routers.schemas import list_agent_schemas
            result = await list_agent_schemas("agent-1")
            assert len(result) == 1

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.schemas.get_output_schemas", new_callable=AsyncMock,
                   side_effect=HTTPException(422, "bad")):
            from virtual_team.routers.schemas import list_agent_schemas
            with pytest.raises(HTTPException) as exc:
                await list_agent_schemas("agent-1")
            assert exc.value.status_code == 422

    async def test_exception_500(self):
        with patch("virtual_team.routers.schemas.get_output_schemas", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.schemas import list_agent_schemas
            with pytest.raises(HTTPException) as exc:
                await list_agent_schemas("agent-1")
            assert exc.value.status_code == 500


class TestUpdateSchema:
    async def test_success(self):
        s = _mock_schema()
        with patch("virtual_team.routers.schemas.update_output_schema", new_callable=AsyncMock, return_value=s):
            from virtual_team.routers.schemas import update_agent_schema, SchemaUpdateRequest
            req = SchemaUpdateRequest(name="new")
            result = await update_agent_schema("agent-1", "s-1", req)
            assert result["status"] == "updated"

    async def test_not_found_404(self):
        with patch("virtual_team.routers.schemas.update_output_schema", new_callable=AsyncMock, return_value=None):
            from virtual_team.routers.schemas import update_agent_schema, SchemaUpdateRequest
            req = SchemaUpdateRequest(name="new")
            with pytest.raises(HTTPException) as exc:
                await update_agent_schema("agent-1", "s-1", req)
            assert exc.value.status_code == 404

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.schemas.update_output_schema", new_callable=AsyncMock,
                   side_effect=HTTPException(403, "no")):
            from virtual_team.routers.schemas import update_agent_schema, SchemaUpdateRequest
            req = SchemaUpdateRequest(name="new")
            with pytest.raises(HTTPException) as exc:
                await update_agent_schema("agent-1", "s-1", req)
            assert exc.value.status_code == 403

    async def test_exception_500(self):
        with patch("virtual_team.routers.schemas.update_output_schema", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.schemas import update_agent_schema, SchemaUpdateRequest
            req = SchemaUpdateRequest(name="new")
            with pytest.raises(HTTPException) as exc:
                await update_agent_schema("agent-1", "s-1", req)
            assert exc.value.status_code == 500

    async def test_with_schema_def(self):
        s = _mock_schema()
        with patch("virtual_team.routers.schemas.update_output_schema", new_callable=AsyncMock, return_value=s):
            from virtual_team.routers.schemas import update_agent_schema, SchemaUpdateRequest
            req = SchemaUpdateRequest(schema_def={"type": "array"})
            result = await update_agent_schema("agent-1", "s-1", req)
            assert result["status"] == "updated"


class TestDeleteSchema:
    async def test_success(self):
        with patch("virtual_team.routers.schemas.delete_output_schema", new_callable=AsyncMock, return_value=True):
            from virtual_team.routers.schemas import delete_agent_schema
            result = await delete_agent_schema("agent-1", "s-1")
            assert result["status"] == "deleted"

    async def test_not_found_404(self):
        with patch("virtual_team.routers.schemas.delete_output_schema", new_callable=AsyncMock, return_value=False):
            from virtual_team.routers.schemas import delete_agent_schema
            with pytest.raises(HTTPException) as exc:
                await delete_agent_schema("agent-1", "s-1")
            assert exc.value.status_code == 404

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.schemas.delete_output_schema", new_callable=AsyncMock,
                   side_effect=HTTPException(403, "no")):
            from virtual_team.routers.schemas import delete_agent_schema
            with pytest.raises(HTTPException) as exc:
                await delete_agent_schema("agent-1", "s-1")
            assert exc.value.status_code == 403

    async def test_exception_500(self):
        with patch("virtual_team.routers.schemas.delete_output_schema", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.schemas import delete_agent_schema
            with pytest.raises(HTTPException) as exc:
                await delete_agent_schema("agent-1", "s-1")
            assert exc.value.status_code == 500


# ============================================================
# bindings.py — 业务测试
# ============================================================

class TestBindTool:
    async def test_success(self):
        b = _mock_binding(tool_id="tool-1", config_override=None)
        with patch("virtual_team.routers.bindings.bind_tool", new_callable=AsyncMock, return_value=b):
            from virtual_team.routers.bindings import bind_agent_tool, BindToolRequest
            req = BindToolRequest(tool_id="tool-1")
            result = await bind_agent_tool("agent-1", req)
            assert result["status"] == "bound"

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.bindings.bind_tool", new_callable=AsyncMock,
                   side_effect=HTTPException(409, "conflict")):
            from virtual_team.routers.bindings import bind_agent_tool, BindToolRequest
            req = BindToolRequest(tool_id="tool-1")
            with pytest.raises(HTTPException) as exc:
                await bind_agent_tool("agent-1", req)
            assert exc.value.status_code == 409

    async def test_exception_500(self):
        with patch("virtual_team.routers.bindings.bind_tool", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.bindings import bind_agent_tool, BindToolRequest
            req = BindToolRequest(tool_id="tool-1")
            with pytest.raises(HTTPException) as exc:
                await bind_agent_tool("agent-1", req)
            assert exc.value.status_code == 500

    async def test_with_config_override(self):
        b = _mock_binding(tool_id="tool-1", config_override="{}")
        with patch("virtual_team.routers.bindings.bind_tool", new_callable=AsyncMock, return_value=b):
            from virtual_team.routers.bindings import bind_agent_tool, BindToolRequest
            req = BindToolRequest(tool_id="tool-1", config_override="{}")
            result = await bind_agent_tool("agent-1", req)
            assert result["status"] == "bound"


class TestUnbindTool:
    async def test_success(self):
        with patch("virtual_team.routers.bindings.unbind_tool", new_callable=AsyncMock, return_value=True):
            from virtual_team.routers.bindings import unbind_agent_tool
            result = await unbind_agent_tool("agent-1", "tool-1")
            assert result["status"] == "unbound"

    async def test_not_found_404(self):
        with patch("virtual_team.routers.bindings.unbind_tool", new_callable=AsyncMock, return_value=False):
            from virtual_team.routers.bindings import unbind_agent_tool
            with pytest.raises(HTTPException) as exc:
                await unbind_agent_tool("agent-1", "tool-1")
            assert exc.value.status_code == 404

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.bindings.unbind_tool", new_callable=AsyncMock,
                   side_effect=HTTPException(403, "no")):
            from virtual_team.routers.bindings import unbind_agent_tool
            with pytest.raises(HTTPException) as exc:
                await unbind_agent_tool("agent-1", "tool-1")
            assert exc.value.status_code == 403

    async def test_exception_500(self):
        with patch("virtual_team.routers.bindings.unbind_tool", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.bindings import unbind_agent_tool
            with pytest.raises(HTTPException) as exc:
                await unbind_agent_tool("agent-1", "tool-1")
            assert exc.value.status_code == 500


class TestListTools:
    async def test_success_empty(self):
        with patch("virtual_team.routers.bindings.get_agent_tools", new_callable=AsyncMock, return_value=[]):
            from virtual_team.routers.bindings import list_agent_tools
            result = await list_agent_tools("agent-1")
            assert result == []

    async def test_success_with_data(self):
        b = _mock_binding(tool_id="tool-1", config_override="{}")
        with patch("virtual_team.routers.bindings.get_agent_tools", new_callable=AsyncMock, return_value=[b]):
            from virtual_team.routers.bindings import list_agent_tools
            result = await list_agent_tools("agent-1")
            assert len(result) == 1
            assert result[0]["tool_id"] == "tool-1"

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.bindings.get_agent_tools", new_callable=AsyncMock,
                   side_effect=HTTPException(422, "bad")):
            from virtual_team.routers.bindings import list_agent_tools
            with pytest.raises(HTTPException) as exc:
                await list_agent_tools("agent-1")
            assert exc.value.status_code == 422

    async def test_exception_500(self):
        with patch("virtual_team.routers.bindings.get_agent_tools", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.bindings import list_agent_tools
            with pytest.raises(HTTPException) as exc:
                await list_agent_tools("agent-1")
            assert exc.value.status_code == 500


class TestBindMCP:
    async def test_success(self):
        b = _mock_binding(mcp_id="mcp-1")
        with patch("virtual_team.routers.bindings.bind_mcp", new_callable=AsyncMock, return_value=b):
            from virtual_team.routers.bindings import bind_agent_mcp, BindMcpRequest
            req = BindMcpRequest(mcp_id="mcp-1")
            result = await bind_agent_mcp("agent-1", req)
            assert result["status"] == "bound"

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.bindings.bind_mcp", new_callable=AsyncMock,
                   side_effect=HTTPException(409, "conflict")):
            from virtual_team.routers.bindings import bind_agent_mcp, BindMcpRequest
            req = BindMcpRequest(mcp_id="mcp-1")
            with pytest.raises(HTTPException) as exc:
                await bind_agent_mcp("agent-1", req)
            assert exc.value.status_code == 409

    async def test_exception_500(self):
        with patch("virtual_team.routers.bindings.bind_mcp", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.bindings import bind_agent_mcp, BindMcpRequest
            req = BindMcpRequest(mcp_id="mcp-1")
            with pytest.raises(HTTPException) as exc:
                await bind_agent_mcp("agent-1", req)
            assert exc.value.status_code == 500

    async def test_with_tool_filter(self):
        b = _mock_binding(mcp_id="mcp-1", tool_filter="*.py")
        with patch("virtual_team.routers.bindings.bind_mcp", new_callable=AsyncMock, return_value=b):
            from virtual_team.routers.bindings import bind_agent_mcp, BindMcpRequest
            req = BindMcpRequest(mcp_id="mcp-1", tool_filter="*.py")
            result = await bind_agent_mcp("agent-1", req)
            assert result["status"] == "bound"


class TestUnbindMCP:
    async def test_success(self):
        with patch("virtual_team.routers.bindings.unbind_mcp", new_callable=AsyncMock, return_value=True):
            from virtual_team.routers.bindings import unbind_agent_mcp
            result = await unbind_agent_mcp("agent-1", "mcp-1")
            assert result["status"] == "unbound"

    async def test_not_found_404(self):
        with patch("virtual_team.routers.bindings.unbind_mcp", new_callable=AsyncMock, return_value=False):
            from virtual_team.routers.bindings import unbind_agent_mcp
            with pytest.raises(HTTPException) as exc:
                await unbind_agent_mcp("agent-1", "mcp-1")
            assert exc.value.status_code == 404

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.bindings.unbind_mcp", new_callable=AsyncMock,
                   side_effect=HTTPException(403, "no")):
            from virtual_team.routers.bindings import unbind_agent_mcp
            with pytest.raises(HTTPException) as exc:
                await unbind_agent_mcp("agent-1", "mcp-1")
            assert exc.value.status_code == 403

    async def test_exception_500(self):
        with patch("virtual_team.routers.bindings.unbind_mcp", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.bindings import unbind_agent_mcp
            with pytest.raises(HTTPException) as exc:
                await unbind_agent_mcp("agent-1", "mcp-1")
            assert exc.value.status_code == 500


class TestListMCP:
    async def test_success_empty(self):
        with patch("virtual_team.routers.bindings.get_agent_mcp", new_callable=AsyncMock, return_value=[]):
            from virtual_team.routers.bindings import list_agent_mcp
            result = await list_agent_mcp("agent-1")
            assert result == []

    async def test_success_with_data(self):
        b = _mock_binding(mcp_id="mcp-1", tool_filter="*.py")
        with patch("virtual_team.routers.bindings.get_agent_mcp", new_callable=AsyncMock, return_value=[b]):
            from virtual_team.routers.bindings import list_agent_mcp
            result = await list_agent_mcp("agent-1")
            assert len(result) == 1

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.bindings.get_agent_mcp", new_callable=AsyncMock,
                   side_effect=HTTPException(422, "bad")):
            from virtual_team.routers.bindings import list_agent_mcp
            with pytest.raises(HTTPException) as exc:
                await list_agent_mcp("agent-1")
            assert exc.value.status_code == 422

    async def test_exception_500(self):
        with patch("virtual_team.routers.bindings.get_agent_mcp", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.bindings import list_agent_mcp
            with pytest.raises(HTTPException) as exc:
                await list_agent_mcp("agent-1")
            assert exc.value.status_code == 500


class TestBindSkill:
    async def test_success(self):
        b = _mock_binding(skill_id="skill-1")
        with patch("virtual_team.routers.bindings.bind_skill", new_callable=AsyncMock, return_value=b):
            from virtual_team.routers.bindings import bind_agent_skill, BindSkillRequest
            req = BindSkillRequest(skill_id="skill-1")
            result = await bind_agent_skill("agent-1", req)
            assert result["status"] == "bound"

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.bindings.bind_skill", new_callable=AsyncMock,
                   side_effect=HTTPException(409, "conflict")):
            from virtual_team.routers.bindings import bind_agent_skill, BindSkillRequest
            req = BindSkillRequest(skill_id="skill-1")
            with pytest.raises(HTTPException) as exc:
                await bind_agent_skill("agent-1", req)
            assert exc.value.status_code == 409

    async def test_exception_500(self):
        with patch("virtual_team.routers.bindings.bind_skill", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.bindings import bind_agent_skill, BindSkillRequest
            req = BindSkillRequest(skill_id="skill-1")
            with pytest.raises(HTTPException) as exc:
                await bind_agent_skill("agent-1", req)
            assert exc.value.status_code == 500


class TestUnbindSkill:
    async def test_success(self):
        with patch("virtual_team.routers.bindings.unbind_skill", new_callable=AsyncMock, return_value=True):
            from virtual_team.routers.bindings import unbind_agent_skill
            result = await unbind_agent_skill("agent-1", "skill-1")
            assert result["status"] == "unbound"

    async def test_not_found_404(self):
        with patch("virtual_team.routers.bindings.unbind_skill", new_callable=AsyncMock, return_value=False):
            from virtual_team.routers.bindings import unbind_agent_skill
            with pytest.raises(HTTPException) as exc:
                await unbind_agent_skill("agent-1", "skill-1")
            assert exc.value.status_code == 404

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.bindings.unbind_skill", new_callable=AsyncMock,
                   side_effect=HTTPException(403, "no")):
            from virtual_team.routers.bindings import unbind_agent_skill
            with pytest.raises(HTTPException) as exc:
                await unbind_agent_skill("agent-1", "skill-1")
            assert exc.value.status_code == 403

    async def test_exception_500(self):
        with patch("virtual_team.routers.bindings.unbind_skill", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.bindings import unbind_agent_skill
            with pytest.raises(HTTPException) as exc:
                await unbind_agent_skill("agent-1", "skill-1")
            assert exc.value.status_code == 500


class TestListSkills:
    async def test_success_empty(self):
        with patch("virtual_team.routers.bindings.get_agent_skills", new_callable=AsyncMock, return_value=[]):
            from virtual_team.routers.bindings import list_agent_skills
            result = await list_agent_skills("agent-1")
            assert result == []

    async def test_success_with_data(self):
        b = _mock_binding(skill_id="skill-1")
        with patch("virtual_team.routers.bindings.get_agent_skills", new_callable=AsyncMock, return_value=[b]):
            from virtual_team.routers.bindings import list_agent_skills
            result = await list_agent_skills("agent-1")
            assert len(result) == 1

    async def test_http_exception_re_raise(self):
        with patch("virtual_team.routers.bindings.get_agent_skills", new_callable=AsyncMock,
                   side_effect=HTTPException(422, "bad")):
            from virtual_team.routers.bindings import list_agent_skills
            with pytest.raises(HTTPException) as exc:
                await list_agent_skills("agent-1")
            assert exc.value.status_code == 422

    async def test_exception_500(self):
        with patch("virtual_team.routers.bindings.get_agent_skills", new_callable=AsyncMock,
                   side_effect=Exception("db")):
            from virtual_team.routers.bindings import list_agent_skills
            with pytest.raises(HTTPException) as exc:
                await list_agent_skills("agent-1")
            assert exc.value.status_code == 500
