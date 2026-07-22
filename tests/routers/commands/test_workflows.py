class TestWorkflows:

    def test_get_team_workflow_not_found(self, client):
        resp = client.post("/api/teams", json={"name": "wf-nf-team"})
        team_id = resp.json()["id"]
        resp = client.get(f"/api/workflows/teams/{team_id}")
        assert resp.status_code == 404

    def test_delete_workflow_not_found(self, client):
        resp = client.delete("/api/workflows/nonexistent-id")
        assert resp.status_code == 404
