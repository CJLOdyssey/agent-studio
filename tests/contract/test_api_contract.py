"""API contract tests — verify schema, status codes, and response shapes."""

import pytest

pytestmark = pytest.mark.integration


class TestOpenAPISchema:
    """Verify the OpenAPI schema is complete and well-formed."""

    async def test_openapi_json_is_accessible(self, test_client):
        r = await test_client.get("/openapi.json")
        assert r.status_code == 200
        schema = r.json()
        assert "openapi" in schema
        assert "paths" in schema

    async def test_schema_contains_expected_routes(self, test_client):
        r = await test_client.get("/openapi.json")
        paths = r.json()["paths"]
        expected = [
            "/api/health",
            "/api/models",
            "/api/agents",
            "/api/tools",
            "/api/skills",
            "/api/mcps",
            "/api/teams",
            "/api/prompts",
            "/api/keys",
            "/api/providers",
            "/api/commands",
            "/api/workflows",
            "/api/sessions",
        ]
        for route in expected:
            assert route in paths, f"Missing route: {route}"


class TestHealthEndpoint:
    async def test_health_returns_200_with_status(self, test_client):
        r = await test_client.get("/api/health")
        assert r.status_code == 200
        body = r.json()
        assert "status" in body
        assert body["status"] in ("healthy", "degraded")


class TestListEndpoints:
    """Verify list endpoints return 200 with array response."""

    async def test_models_returns_array(self, test_client):
        r = await test_client.get("/api/models")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_agents_returns_array(self, test_client):
        r = await test_client.get("/api/agents")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_tools_returns_array(self, test_client):
        r = await test_client.get("/api/tools")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_skills_returns_array(self, test_client):
        r = await test_client.get("/api/skills")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_mcps_returns_array(self, test_client):
        r = await test_client.get("/api/mcps")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_teams_returns_array(self, test_client):
        r = await test_client.get("/api/teams")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_prompts_returns_array(self, test_client):
        r = await test_client.get("/api/prompts")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_keys_returns_array(self, test_client):
        r = await test_client.get("/api/keys")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_providers_returns_object(self, test_client):
        r = await test_client.get("/api/providers")
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, dict)

    async def test_commands_returns_array(self, test_client):
        r = await test_client.get("/api/commands")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_workflows_returns_array(self, test_client):
        r = await test_client.get("/api/workflows")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestErrorResponses:
    async def test_nonexistent_route_returns_404(self, test_client):
        r = await test_client.get("/api/nonexistent-route-xyz")
        assert r.status_code == 404

    async def test_post_agents_without_body_returns_error(self, test_client):
        r = await test_client.post("/api/agents")
        assert r.status_code in (401, 422)
