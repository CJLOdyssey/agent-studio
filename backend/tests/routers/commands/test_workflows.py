class TestWorkflows:

    def test_get_team_workflow_not_found(self, client):
        resp = client.post("/api/teams", json={"name": "wf-nf-team"})
        team_id = resp.json()["id"]
        resp = client.get(f"/api/workflows/teams/{team_id}")
        assert resp.status_code == 404

    def test_delete_workflow_not_found(self, client):
        resp = client.delete("/api/workflows/nonexistent-id")
        assert resp.status_code == 404

    def test_list_workflows_returns_rows_with_team_name(self, client):
        resp = client.post("/api/teams", json={"name": "wf-list-team"})
        assert resp.status_code == 201
        team_id = resp.json()["id"]
        resp = client.post(
            "/api/workflows",
            json={
                "id": "",
                "teamId": team_id,
                "name": "审批流",
                "maxRounds": 3,
                "nodes": [],
                "edges": [],
            },
        )
        assert resp.status_code == 201
        resp = client.get("/api/workflows")
        assert resp.status_code == 200
        rows = resp.json()
        row = next((r for r in rows if r["teamId"] == team_id), None)
        assert row is not None
        assert row["teamName"] == "wf-list-team"
        assert row["name"] == "审批流"
        assert row["nodeCount"] == 0
        assert "createdAt" in row
