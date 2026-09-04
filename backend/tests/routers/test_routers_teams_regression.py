"""Regression tests for Teams API.

Covers edge cases, validation, and error paths that must
not regress during refactoring. Uses shared client fixture
from routers/conftest.py.

See: .omo/test-plan-team-management/regression.md
"""

import pytest

pytestmark = pytest.mark.regression


# ═══════════════════════════════════════════════════════════════
# R-01 ~ R-04: 创建团队边界条件
# ═══════════════════════════════════════════════════════════════

class TestCreateTeamRegression:

    def test_empty_name_rejected(self, client):
        """R-01: 空名称 → 422"""
        resp = client.post("/api/teams", json={"name": ""})
        assert resp.status_code == 422

    def test_name_too_long_rejected(self, client):
        """R-02: name > 64 字符 → 422"""
        resp = client.post("/api/teams", json={"name": "A" * 65})
        assert resp.status_code == 422

    def test_default_status_is_active(self, client):
        """R-03: 不传 status → 默认 active"""
        resp = client.post("/api/teams", json={"name": "r-defaults"})
        assert resp.status_code == 201
        body = resp.json()
        assert body.get("status") in ("active", None)

    def test_description_omitted_is_null(self, client):
        """R-04: 不传 description → null"""
        resp = client.post("/api/teams", json={"name": "r-nodesc"})
        assert resp.status_code == 201
        assert resp.json().get("description") in (None, "")

    def test_category_omitted_defaults_dev(self, client):
        """R-04.1: 不传 category → 默认 dev"""
        resp = client.post("/api/teams", json={"name": "r-nocat"})
        assert resp.status_code == 201
        assert resp.json().get("category") in ("dev", None)

    def test_custom_category_accepted(self, client):
        """R-04.2: 分类为用户自定义（非枚举限制），任意值应被接受"""
        resp = client.post("/api/teams", json={
            "name": "r-customcat", "category": "research"
        })
        assert resp.status_code == 201
        assert resp.json().get("category") == "research"


# ═══════════════════════════════════════════════════════════════
# R-05 ~ R-06: 更新团队
# ═══════════════════════════════════════════════════════════════

class TestUpdateTeamRegression:

    def test_partial_update_preserves_other_fields(self, client):
        """R-05: 只更新 description → name 不变"""
        r = client.post("/api/teams", json={"name": "r-partial"})
        tid = r.json()["id"]
        resp = client.put(f"/api/teams/{tid}", json={"description": "new"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "r-partial"

    def test_status_toggle_active_inactive(self, client):
        """R-06: status active ↔ inactive 双向切换"""
        r = client.post("/api/teams", json={"name": "r-tgl", "status": "active"})
        tid = r.json()["id"]
        r1 = client.put(f"/api/teams/{tid}", json={"status": "inactive"})
        assert r1.status_code == 200
        assert r1.json()["status"] == "inactive"
        r2 = client.put(f"/api/teams/{tid}", json={"status": "active"})
        assert r2.status_code == 200
        assert r2.json()["status"] == "active"

    def test_update_all_fields(self, client):
        """R-06.1: 全字段更新（name + description + status）"""
        r = client.post("/api/teams", json={"name": "r-full"})
        tid = r.json()["id"]
        resp = client.put(f"/api/teams/{tid}", json={
            "name": "reg-full-updated", "description": "d", "status": "inactive",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "reg-full-updated"
        assert data["description"] == "d"
        assert data["status"] == "inactive"


# ═══════════════════════════════════════════════════════════════
# R-07: 删除团队
# ═══════════════════════════════════════════════════════════════

class TestDeleteTeamRegression:

    def test_delete_removes_from_list(self, client):
        """R-07: 删除 → 列表中消失"""
        r = client.post("/api/teams", json={"name": "r-rm"})
        tid = r.json()["id"]
        client.delete(f"/api/teams/{tid}")
        resp = client.get("/api/teams")
        assert tid not in [t["id"] for t in resp.json()]


# ═══════════════════════════════════════════════════════════════
# R-08 ~ R-10: 成员管理
# ═══════════════════════════════════════════════════════════════

class TestMemberRegression:

    def test_add_member_returns_created(self, client):
        """R-08: 添加成员 → 201 + 返回 name"""
        r = client.post("/api/teams", json={"name": "r-addmem"})
        tid = r.json()["id"]
        resp = client.post(f"/api/teams/{tid}/members", json={"name": "newmem"})
        assert resp.status_code == 201
        assert resp.json()["name"] == "newmem"

    def test_remove_member_updates_list(self, client):
        """R-09: 移除成员 → 表格中消失"""
        r = client.post("/api/teams", json={"name": "r-rmmem"})
        tid = r.json()["id"]
        mr = client.post(f"/api/teams/{tid}/members", json={"name": "goner"})
        mid = mr.json()["id"]
        client.delete(f"/api/teams/{tid}/members/{mid}")
        detail = client.get(f"/api/teams/{tid}")
        assert mid not in [m["id"] for m in detail.json().get("agents", [])]

    def test_member_invalid_name_rejected(self, client):
        """R-10: 成员空名称 → 422"""
        r = client.post("/api/teams", json={"name": "r-badmem"})
        tid = r.json()["id"]
        resp = client.post(f"/api/teams/{tid}/members", json={"name": ""})
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════
# R-11 ~ R-12: 分类字段 — 回归验证
# ═══════════════════════════════════════════════════════════════

class TestCategoryRegression:

    def test_create_with_category_returns_correct_type(self, client):
        """R-11: 创建时指定分类 → 响应包含相同分类值"""
        for cat in ("dev", "ops", "test"):
            resp = client.post("/api/teams", json={
                "name": f"r-cat-{cat}", "category": cat,
            })
            assert resp.status_code == 201
            assert resp.json()["category"] == cat

    def test_update_category_reflected_in_detail(self, client):
        """R-12: 更新分类 → GET 详情返回新值"""
        r = client.post("/api/teams", json={
            "name": "r-cat-upd", "category": "dev"
        })
        tid = r.json()["id"]
        client.put(f"/api/teams/{tid}", json={"category": "test"})
        detail = client.get(f"/api/teams/{tid}")
        assert detail.json()["category"] == "test"
