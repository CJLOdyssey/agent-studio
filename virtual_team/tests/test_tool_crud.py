"""
E2E Test: Tool CRUD + generate + validate operations.
"""

from virtual_team.tests.conftest import Api, _cleanup


class TestToolCRUD:
    def test_create_tool(self, api: Api):
        r = api.post(
            "/api/tools",
            json={
                "name": "E2E-Calculator",
                "category": "utility",
                "description": "加法计算器",
            },
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["name"] == "E2E-Calculator"
        assert body["category"] == "utility"
        _cleanup((body["id"], "/api/tools"))

    def test_list_tools(self, api: Api):
        r = api.get("/api/tools")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_update_tool(self, api: Api):
        r = api.post(
            "/api/tools",
            json={
                "name": "Old",
                "category": "general",
                "description": "x",
            },
        )
        tid = r.json()["id"]
        r2 = api.put(f"/api/tools/{tid}", json={"name": "New"})
        assert r2.status_code == 200
        assert r2.json()["name"] == "New"
        _cleanup((tid, "/api/tools"))

    def test_delete_tool(self, api: Api):
        r = api.post(
            "/api/tools",
            json={
                "name": "Del",
                "category": "general",
                "description": "x",
            },
        )
        tid = r.json()["id"]
        r2 = api.delete(f"/api/tools/{tid}")
        assert r2.status_code in (200, 204)

    def test_generate_tool(self, api: Api):
        r = api.post(
            "/api/tools/generate",
            json={
                "description": "计算两个数字的乘积",
                "language": "python",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "name" in body
        assert "code" in body
        assert body.get("is_valid") is True or body.get("is_valid") is False

    def test_validate_tool(self, api: Api):
        r = api.post(
            "/api/tools/validate",
            json={
                "code": "def multiply(a, b):\n    return a * b",
                "language": "python",
            },
        )
        assert r.status_code == 200
        body = r.json()
        assert "is_valid" in body
