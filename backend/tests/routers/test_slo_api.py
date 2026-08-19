"""API tests for SLO definitions and budget."""

from typing import Any

import pytest
from starlette.testclient import TestClient

H = {"X-User-ID": "admin"}


@pytest.fixture(autouse=True)
def _mock_slo(monkeypatch: Any) -> None:
    import routers.slo as mod

    class _SloService:
        async def calculate(self, target_percent: float, window_seconds: int, team_id: str | None = None) -> dict[str, Any]:
            return {
                "target_percent": target_percent,
                "window_seconds": window_seconds,
                "total_requests": 100,
                "error_count": 2,
                "sli_percent": 98.0,
                "budget_remaining_percent": -1.0,
                "burn_rate": 2.0,
            }

    monkeypatch.setattr(mod, "get_slo_service", lambda: _SloService())


class TestDefinitions:
    def test_crud_roundtrip(self, client: TestClient) -> None:
        # create
        resp = client.post(
            "/api/slo/definitions",
            headers=H,
            json={"name": "成功率 SLO", "metricType": "success_rate", "targetPercent": 99.0, "windowDays": 30},
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["name"] == "成功率 SLO"
        assert body["targetPercent"] == 99.0
        sli_id = body["id"]

        # list
        resp = client.get("/api/slo/definitions", headers=H)
        assert resp.status_code == 200
        assert any(d["id"] == sli_id for d in resp.json())

        # update
        resp = client.put(f"/api/slo/definitions/{sli_id}", headers=H, json={"targetPercent": 99.5})
        assert resp.status_code == 200
        assert resp.json()["targetPercent"] == 99.5

        # delete
        resp = client.delete(f"/api/slo/definitions/{sli_id}", headers=H)
        assert resp.status_code == 204
        assert client.get("/api/slo/definitions", headers=H).json() == []

    def test_create_requires_name(self, client: TestClient) -> None:
        resp = client.post("/api/slo/definitions", headers=H, json={"targetPercent": 99.0})
        assert resp.status_code == 400

    def test_create_rejects_invalid_target(self, client: TestClient) -> None:
        resp = client.post(
            "/api/slo/definitions", headers=H,
            json={"name": "x", "metricType": "success_rate", "targetPercent": 150},
        )
        assert resp.status_code == 400

    def test_delete_missing_returns_404(self, client: TestClient) -> None:
        assert client.delete("/api/slo/definitions/nope", headers=H).status_code == 404


class TestBudget:
    def test_returns_snapshot(self, client: TestClient) -> None:
        resp = client.get("/api/slo/budget", headers=H, params={"target_percent": 99.0})
        assert resp.status_code == 200
        body = resp.json()
        assert body["targetPercent"] == 99.0
        assert body["sliPercent"] == 98.0
        assert "burnRate" in body
