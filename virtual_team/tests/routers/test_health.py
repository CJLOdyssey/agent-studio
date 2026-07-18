"""Health-check tests for key REST API endpoints (happy-path only).

Requires: conftest.py fixtures (db_engine, async_session, test_client).
"""

import pytest


@pytest.mark.asyncio
async def test_get_agents_empty_list(test_client, db_engine):
    """GET /api/agents → 200, returns a list (empty when no agents seeded)."""
    response = await test_client.get("/api/agents")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # No sample_agent fixture used in this test, so list should be empty
    assert len(data) == 0


@pytest.mark.asyncio
async def test_create_prompt(test_client, db_engine):
    """POST /api/prompts → 201, response body includes an id field."""
    payload = {"name": "test-prompt", "category": "general", "content": "hello world"}
    response = await test_client.post("/api/prompts", json=payload)
    assert response.status_code in (200, 201), f"Got {response.status_code}: {response.text}"
    data = response.json()
    assert "id" in data, f"Response missing 'id': {data}"
    assert data["name"] == "test-prompt"


@pytest.mark.asyncio
async def test_get_teams_list(test_client, db_engine):
    """GET /api/teams → 200, response body is a list."""
    response = await test_client.get("/api/teams")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
