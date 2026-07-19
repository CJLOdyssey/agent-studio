"""Response schema contract tests — verify field completeness of key endpoints."""

import pytest

pytestmark = pytest.mark.integration


class TestAgentCreateResponseSchema:
    async def test_create_agent_response_has_required_fields(self, test_client):
        r = await test_client.post(
            "/api/agents",
            json={
                "name": "Contract-Test-Agent",
                "role_identifier": "contract_test_agent",
                "system_prompt": "Test prompt",
            },
        )
        assert r.status_code in (200, 201)
        body = r.json()
        assert "id" in body, "Missing 'id' field in agent create response"
        assert "status" in body, "Missing 'status' field in agent create response"


class TestSessionCreateResponseSchema:
    async def test_create_session_response_has_required_fields(self, test_client):
        r = await test_client.post(
            "/api/sessions",
            json={"title": "Contract-Test-Session"},
        )
        assert r.status_code == 201
        body = r.json()
        assert "id" in body, "Missing 'id' field in session create response"
        assert "title" in body, "Missing 'title' field in session create response"


class TestToolCreateResponseSchema:
    async def test_create_tool_response_has_required_fields(self, test_client):
        r = await test_client.post(
            "/api/tools",
            json={
                "name": "Contract-Test-Tool",
                "category": "api",
                "description": "A test tool for contract testing",
            },
        )
        assert r.status_code in (200, 201)
        body = r.json()
        assert "id" in body, "Missing 'id' field in tool create response"
        assert "name" in body, "Missing 'name' field in tool create response"


class TestTeamCreateResponseSchema:
    async def test_create_team_response_has_required_fields(self, test_client):
        r = await test_client.post(
            "/api/teams",
            json={
                "name": "Contract-Test-Team",
                "description": "A test team for contract testing",
            },
        )
        assert r.status_code == 201
        body = r.json()
        assert "id" in body, "Missing 'id' field in team create response"
        assert "name" in body, "Missing 'name' field in team create response"
