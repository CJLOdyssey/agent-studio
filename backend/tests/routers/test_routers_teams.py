"""Comprehensive unit tests for the Teams router module.

Uses shared client fixture from conftest.py.
"""
import pytest

pytestmark = pytest.mark.unit

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest


class TestTeams:

    def test_list_teams(self, client):
        resp = client.get("/api/teams", headers={"X-User-ID": "admin"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_team(self, client):
        resp = client.post("/api/teams", json={"name": "my-team", "description": "test"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "my-team"
        assert data["agents"] == []

    def test_create_team_conflict(self, client):
        client.post("/api/teams", json={"name": "dup-team"})
        resp = client.post("/api/teams", json={"name": "dup-team"})
        assert resp.status_code == 409

    def test_get_team_detail(self, client):
        resp = client.post("/api/teams", json={"name": "detail-team"})
        team_id = resp.json()["id"]
        resp = client.get(f"/api/teams/{team_id}")
        assert resp.status_code == 200

    def test_get_team_not_found(self, client):
        resp = client.get("/api/teams/nonexistent")
        assert resp.status_code == 404

    def test_update_team(self, client):
        resp = client.post("/api/teams", json={"name": "upd-team"})
        team_id = resp.json()["id"]
        resp = client.put(f"/api/teams/{team_id}", json={"name": "updated-team", "description": "new"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "updated-team"

    def test_update_team_not_found(self, client):
        resp = client.put("/api/teams/nonexistent", json={"name": "x"})
        assert resp.status_code == 404

    def test_delete_team(self, client):
        resp = client.post("/api/teams", json={"name": "del-team"})
        team_id = resp.json()["id"]
        resp = client.delete(f"/api/teams/{team_id}")
        assert resp.status_code == 200

    def test_delete_team_not_found(self, client):
        resp = client.delete("/api/teams/nonexistent")
        assert resp.status_code == 404

    def test_add_member(self, client):
        resp = client.post("/api/teams", json={"name": "mem-team"})
        team_id = resp.json()["id"]
        resp = client.post(f"/api/teams/{team_id}/members", json={"name": "member-1"})
        assert resp.status_code == 201

    def test_add_member_team_not_found(self, client):
        resp = client.post("/api/teams/nonexistent/members", json={"name": "m"})
        assert resp.status_code == 404

    def test_remove_member(self, client):
        resp = client.post("/api/teams", json={"name": "rm-team"})
        team_id = resp.json()["id"]
        resp = client.post(f"/api/teams/{team_id}/members", json={"name": "to-remove"})
        member_id = resp.json()["id"]
        resp = client.delete(f"/api/teams/{team_id}/members/{member_id}")
        assert resp.status_code == 200

    def test_remove_member_not_found(self, client):
        resp = client.post("/api/teams", json={"name": "rm2-team"})
        team_id = resp.json()["id"]
        resp = client.delete(f"/api/teams/{team_id}/members/nonexistent")
        assert resp.status_code == 404

    def test_reorder_members(self, client):
        resp = client.post("/api/teams", json={"name": "reorder-team"})
        team_id = resp.json()["id"]
        resp = client.put(f"/api/teams/{team_id}/members/reorder", json={"member_ids": []})
        assert resp.status_code == 200

    def test_link_agent(self, client):
        resp = client.post("/api/teams", json={"name": "link-team"})
        team_id = resp.json()["id"]
        resp = client.post(f"/api/teams/{team_id}/members", json={"name": "linkable"})
        member_id = resp.json()["id"]
        resp = client.put(f"/api/teams/{team_id}/members/{member_id}/link-agent",
                          json={"agent_config_id": "agent-1"})
        assert resp.status_code == 200

    def test_link_agent_member_not_found(self, client):
        resp = client.put("/api/teams/t/members/nonexistent/link-agent",
                          json={"agent_config_id": "agent-1"})
        assert resp.status_code == 404

    def test_team_create_request_model(self):
        from routers.teams import TeamCreateRequest
        req = TeamCreateRequest(name="test")
        assert req.name == "test"

    def test_team_update_request_model(self):
        from routers.teams import TeamUpdateRequest
        req = TeamUpdateRequest(name="updated")
        assert req.name == "updated"

    # ── Exception handler paths ──

    def test_list_teams_exception(self, client):
        with patch("routers.teams.get_teams", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.get("/api/teams", headers={"X-User-ID": "admin"})
            assert resp.status_code == 500

    def test_create_team_exception(self, client):
        with patch("routers.teams.create_team", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/teams", json={"name": "err-team"})
            assert resp.status_code == 500

    def test_delete_team_not_found_return(self, client):
        resp = client.post("/api/teams", json={"name": "dnf-team"})
        team_id = resp.json()["id"]
        with patch("routers.teams.delete_team", new_callable=AsyncMock, return_value=False):
            resp = client.delete(f"/api/teams/{team_id}")
            assert resp.status_code == 404

    def test_remove_member_exception(self, client):
        with patch("routers.teams.remove_team_member", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.delete("/api/teams/t/members/m")
            assert resp.status_code == 500

    def test_reorder_exception(self, client):
        with patch("routers.teams.reorder_team_members", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.put("/api/teams/t/members/reorder", json={"member_ids": []})
            assert resp.status_code == 500

    def test_link_agent_exception(self, client):
        with patch("routers.teams.link_agent_config", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.put("/api/teams/t/members/m/link-agent", json={"agent_config_id": "a"})
            assert resp.status_code == 500

    def test_update_team_exception(self, client):
        with patch("routers.teams.update_team", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.put("/api/teams/t", json={"name": "x"})
            assert resp.status_code == 500

    def test_delete_team_exception(self, client):
        with patch("routers.teams.delete_team", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.delete("/api/teams/t")
            assert resp.status_code == 500

    def test_add_member_exception(self, client):
        with patch("routers.teams.add_team_member", new_callable=AsyncMock, side_effect=RuntimeError("err")):
            resp = client.post("/api/teams/t/members", json={"name": "m"})
            assert resp.status_code == 500

    # ── Remaining coverage gaps ──

    def test_update_team_with_all_fields(self, client):
        resp = client.post("/api/teams", json={"name": "full-update-team"})
        team_id = resp.json()["id"]
        resp = client.put(f"/api/teams/{team_id}", json={
            "name": "fully-updated",
            "description": "new desc",
            "status": "active",
            "order": 5,
            "is_expanded": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "fully-updated"
        assert data["description"] == "new desc"
        assert data["order"] == 5
        assert data["is_expanded"] is True

    def test_update_team_http_exception_reraise(self, client):
        with patch("routers.teams.update_team", new_callable=AsyncMock,
                    side_effect=Exception("some error")):
            resp = client.put("/api/teams/nonexistent", json={"name": "x"})
            assert resp.status_code in (404, 500)


class TestTeamCategories:
    """Category field — 8 unit tests for backend category support (TDD)"""

    def test_categories_endpoint_returns_all(self, client: Any):
        resp = client.get("/api/teams/categories")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 3
        for item in data:
            assert "value" in item
            assert "label" in item
        values = [c["value"] for c in data]
        assert "dev" in values
        assert "ops" in values
        assert "test" in values

    def test_categories_list_no_auth_required(self, client: Any):
        resp = client.get("/api/teams/categories")
        assert resp.status_code == 200

    def test_team_creation_with_category(self, client: Any):
        resp = client.post("/api/teams", json={
            "name": "cat-team", "category": "ops"
        })
        assert resp.status_code == 201
        tid = resp.json()["id"]
        detail = client.get(f"/api/teams/{tid}")
        assert detail.json()["category"] == "ops"

    def test_team_default_category_is_dev(self, client: Any):
        resp = client.post("/api/teams", json={"name": "default-cat"})
        assert resp.status_code == 201
        tid = resp.json()["id"]
        detail = client.get(f"/api/teams/{tid}")
        assert detail.json()["category"] == "dev"

    def test_custom_category_accepted(self, client: Any):
        """分类允许用户自定义（非枚举限制）。"""
        resp = client.post("/api/teams", json={
            "name": "custom-cat", "category": "research"
        })
        assert resp.status_code == 201
        tid = resp.json()["id"]
        detail = client.get(f"/api/teams/{tid}")
        assert detail.json()["category"] == "research"

    def test_update_team_category(self, client: Any):
        r = client.post("/api/teams", json={
            "name": "cat-update", "category": "dev"
        })
        tid = r.json()["id"]
        resp = client.put(f"/api/teams/{tid}", json={"category": "test"})
        assert resp.status_code == 200
        assert resp.json()["category"] == "test"

    def test_list_teams_includes_category_field(self, client: Any):
        client.post("/api/teams", json={
            "name": "cat-list", "category": "ops"
        })
        resp = client.get("/api/teams")
        for team in resp.json():
            assert "category" in team

    def test_get_team_detail_includes_category(self, client: Any):
        r = client.post("/api/teams", json={
            "name": "cat-detail", "category": "test"
        })
        tid = r.json()["id"]
        resp = client.get(f"/api/teams/{tid}")
        assert resp.json()["category"] == "test"
