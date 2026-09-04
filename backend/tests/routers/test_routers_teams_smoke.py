"""Smoke tests for Teams API — CRUD + member management + categories connectivity.

Uses shared client fixture from conftest.py.
"""
import pytest

pytestmark = pytest.mark.smoke

from typing import Any


class TestTeamsCRUDSmoke:
    """团队 CRUD — 每个端点验证 2xx（冒烟，不做深度断言）"""

    def test_list_teams_returns_200(self, client: Any):
        resp = client.get("/api/teams")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_team_returns_201(self, client: Any):
        resp = client.post("/api/teams", json={"name": "smoke-create"})
        assert resp.status_code == 201
        assert "id" in resp.json()

    def test_get_team_detail_returns_200(self, client: Any):
        r = client.post("/api/teams", json={"name": "smoke-get"})
        tid = r.json()["id"]
        resp = client.get(f"/api/teams/{tid}")
        assert resp.status_code == 200

    def test_update_team_returns_200(self, client: Any):
        r = client.post("/api/teams", json={"name": "smoke-put"})
        tid = r.json()["id"]
        resp = client.put(f"/api/teams/{tid}", json={"name": "smoke-put-ok"})
        assert resp.status_code == 200

    def test_delete_team_returns_200(self, client: Any):
        r = client.post("/api/teams", json={"name": "smoke-del"})
        tid = r.json()["id"]
        resp = client.delete(f"/api/teams/{tid}")
        assert resp.status_code == 200

    def test_team_not_found_returns_404(self, client: Any):
        resp = client.get("/api/teams/nonexistent-id")
        assert resp.status_code == 404

    def test_duplicate_team_name_returns_409(self, client: Any):
        client.post("/api/teams", json={"name": "dup-smoke"})
        resp = client.post("/api/teams", json={"name": "dup-smoke"})
        assert resp.status_code == 409


class TestTeamMembersSmoke:
    """成员管理 — 冒烟验证"""

    def test_add_member_returns_201(self, client: Any):
        r = client.post("/api/teams", json={"name": "smoke-mem"})
        tid = r.json()["id"]
        resp = client.post(f"/api/teams/{tid}/members", json={"name": "m1"})
        assert resp.status_code == 201

    def test_remove_member_returns_200(self, client: Any):
        r = client.post("/api/teams", json={"name": "smoke-rmmem"})
        tid = r.json()["id"]
        mr = client.post(f"/api/teams/{tid}/members", json={"name": "del-me"})
        mid = mr.json()["id"]
        resp = client.delete(f"/api/teams/{tid}/members/{mid}")
        assert resp.status_code == 200

    def test_remove_member_not_found_returns_404(self, client: Any):
        r = client.post("/api/teams", json={"name": "smoke-nomem"})
        tid = r.json()["id"]
        resp = client.delete(f"/api/teams/{tid}/members/nonexistent")
        assert resp.status_code == 404

    def test_reorder_members_returns_200(self, client: Any):
        r = client.post("/api/teams", json={"name": "smoke-sort"})
        tid = r.json()["id"]
        resp = client.put(
            f"/api/teams/{tid}/members/reorder",
            json={"member_ids": []},
        )
        assert resp.status_code == 200

    def test_link_agent_returns_200(self, client: Any):
        r = client.post("/api/teams", json={"name": "smoke-link"})
        tid = r.json()["id"]
        mr = client.post(f"/api/teams/{tid}/members", json={"name": "lnk"})
        mid = mr.json()["id"]
        resp = client.put(
            f"/api/teams/{tid}/members/{mid}/link-agent",
            json={"agent_config_id": "a-1"},
        )
        assert resp.status_code == 200


class TestTeamCategoriesSmoke:
    """分类接口 — 冒烟验证"""

    def test_categories_endpoint_returns_200(self, client: Any):
        resp = client.get("/api/teams/categories")
        assert resp.status_code == 200
