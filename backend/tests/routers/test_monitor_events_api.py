"""API tests for the authenticated monitor events/trace/clusters endpoints."""

from typing import Any

import pytest
from starlette.testclient import TestClient

H = {"X-User-ID": "admin"}

_SAMPLE = [
    {
        "timestamp": 100.0, "trace_id": "t1", "span_id": "s1", "parent_span_id": None,
        "level": "error", "logger": "workflow.agent", "message": "boom",
        "error_type": "TimeoutError", "error_stack": "traceback", "duration_ms": 1500,
        "tags": None, "event_type": "llm",
    },
    {
        "timestamp": 101.0, "trace_id": "t1", "span_id": "s2", "parent_span_id": "s1",
        "level": "info", "logger": "workflow.agent", "message": "step done",
        "error_type": "", "error_stack": None, "duration_ms": 200,
        "tags": None, "event_type": "tool",
    },
    {
        "timestamp": 102.0, "trace_id": "t2", "span_id": "s9", "parent_span_id": None,
        "level": "error", "logger": "rag.retrieve", "message": "db down",
        "error_type": "ProgrammingError", "error_stack": None, "duration_ms": 900,
        "tags": None, "event_type": "retrieval",
    },
]


@pytest.fixture(autouse=True)
def _mock_store(monkeypatch: Any) -> None:
    class _FakeStore:
        def recent(self, seconds: int = 300, limit: int = 50) -> list[dict[str, Any]]:
            return _SAMPLE

        def by_trace(self, trace_id: str, limit: int = 200) -> list[dict[str, Any]]:
            return [e for e in _SAMPLE if e["trace_id"] == trace_id]

        def search(self, q: str, limit: int = 50) -> list[dict[str, Any]]:
            return [e for e in _SAMPLE if q in (e["message"] or "")]

        def recent_errors(self, seconds: int = 300, limit: int = 50) -> list[dict[str, Any]]:
            return [e for e in _SAMPLE if e["error_type"]]

    import routers.monitor_events as mod

    monkeypatch.setattr(mod, "get_store", lambda: _FakeStore())
    monkeypatch.setattr("routers.monitor_events.analyze_trace", lambda trace_id: {
        "trace_id": trace_id, "total_events": 2, "errors": 1, "slow_spans": 1,
        "error_events": [], "slow_events": [], "suggestion": "操作超时，检查依赖服务（Redis/DB）状态",
    })


class TestMonitorEvents:
    def test_lists_events_with_auth(self, client: TestClient) -> None:
        resp = client.get("/api/monitor/events", headers=H)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 3
        assert body["events"][0]["traceId"] == "t1"

    def test_filters_by_level(self, client: TestClient) -> None:
        resp = client.get("/api/monitor/events", headers=H, params={"level": "error"})
        assert resp.status_code == 200
        assert all(e["level"] == "error" for e in resp.json()["events"])

    def test_filters_by_error_type(self, client: TestClient) -> None:
        resp = client.get("/api/monitor/events", headers=H, params={"error_type": "timeout"})
        assert resp.status_code == 200
        body = resp.json()
        assert all("timeout" in (e["errorType"] or "").lower() for e in body["events"])
        assert body["total"] == 1

    def test_filters_by_slow(self, client: TestClient) -> None:
        resp = client.get("/api/monitor/events", headers=H, params={"slow": 1000})
        assert resp.status_code == 200
        assert all(e["durationMs"] >= 1000 for e in resp.json()["events"])

    def test_by_trace(self, client: TestClient) -> None:
        resp = client.get("/api/monitor/events", headers=H, params={"trace_id": "t2"})
        assert resp.status_code == 200
        body = resp.json()
        assert all(e["traceId"] == "t2" for e in body["events"])

    def test_search(self, client: TestClient) -> None:
        resp = client.get("/api/monitor/events", headers=H, params={"q": "boom"})
        assert resp.status_code == 200
        assert body_events_count(resp) == 1

    def test_pagination(self, client: TestClient) -> None:
        resp = client.get("/api/monitor/events", headers=H, params={"limit": 2, "offset": 1})
        assert resp.status_code == 200
        assert len(resp.json()["events"]) == 2


class TestTraceDetail:
    def test_returns_analyzed_trace(self, client: TestClient) -> None:
        resp = client.get("/api/monitor/traces/t1", headers=H)
        assert resp.status_code == 200
        body = resp.json()
        assert body["trace_id"] == "t1"
        assert body["suggestion"] is not None


class TestErrorClusters:
    def test_clusters_errors(self, client: TestClient) -> None:
        resp = client.get("/api/monitor/errors/clusters", headers=H)
        assert resp.status_code == 200
        clusters = resp.json()["clusters"]
        by_type = {c["errorType"]: c for c in clusters}
        assert by_type["TimeoutError"]["count"] == 1
        assert by_type["TimeoutError"]["latestTraceId"] == "t1"


def body_events_count(resp: Any) -> int:
    return len(resp.json()["events"])
