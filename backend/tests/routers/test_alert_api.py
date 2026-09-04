"""API tests for the alert module — rules, events, notifications, subscriptions."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete

import core.infra.database as db_mod
from orm.alert import (
    AlertEventDB,
    AlertRuleDB,
    NotificationDB,
)

# Legacy auth resolves identity from the X-User-ID header (guest namespace).
H = {"X-User-ID": "admin"}


def _insert_rule(**overrides: Any) -> dict[str, Any]:
    """Insert a rule row directly and return its payload for reference."""
    payload = {
        "id": "rule-test-1",
        "name": "Error rate spike",
        "metric_type": "error_count",
        "operator": "gt",
        "threshold": 0.0,
        "window_seconds": 3600,
        "severity": "P2",
        "cooldown_seconds": 300,
        "enabled": True,
        "created_by": "admin",
    }
    payload.update(overrides)

    async def _do() -> None:
        factory = db_mod.get_session_factory()
        async with factory() as session:
            session.add(AlertRuleDB(**payload))
            await session.commit()

    import asyncio

    asyncio.run(_do())
    return payload


def _insert_event(**overrides: Any) -> dict[str, Any]:
    """Insert an event row directly and return its payload for reference."""
    payload = {
        "id": "evt-test-1",
        "rule_id": "rule-test-1",
        "metric_value": 5.0,
        "threshold": 0.0,
        "severity": "P2",
        "status": "firing",
        "message": "breach",
        "triggered_at": datetime(2026, 8, 19, 0, 0, tzinfo=UTC),
    }
    payload.update(overrides)

    async def _do() -> None:
        factory = db_mod.get_session_factory()
        async with factory() as session:
            session.add(AlertEventDB(**payload))
            await session.commit()

    import asyncio

    asyncio.run(_do())
    return payload


async def _delete_rules() -> None:
    factory = db_mod.get_session_factory()
    async with factory() as session:
        await session.execute(delete(AlertRuleDB))
        await session.commit()


class TestRulesAPI:
    def test_rule_crud_roundtrip(self, client: Any) -> None:
        # create
        resp = client.post(
            "/api/alerts/rules",
            json={
                "name": "P95 latency breach",
                "metricType": "p95_latency",
                "operator": "gt",
                "threshold": 5000,
                "windowSeconds": 1800,
                "severity": "P1",
                "runbookUrl": "https://runbook.example.com/latency",
            },
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["name"] == "P95 latency breach"
        assert body["metricType"] == "p95_latency"
        assert body["enabled"] is True
        rule_id = body["id"]

        # list
        resp = client.get("/api/alerts/rules")
        assert resp.status_code == 200
        listed = resp.json()
        assert any(r["id"] == rule_id for r in listed)
        assert all(r["severity"] in {"P1", "P2", "P3"} for r in listed)

        # filter by metric type
        resp = client.get("/api/alerts/rules", params={"metric_type": "p95_latency"})
        assert resp.status_code == 200
        assert all(r["metricType"] == "p95_latency" for r in resp.json())

        # update
        resp = client.put(
            f"/api/alerts/rules/{rule_id}",
            json={"threshold": 8000, "enabled": False, "severity": "P3"},
        )
        assert resp.status_code == 200, resp.text
        updated = resp.json()
        assert updated["threshold"] == 8000
        assert updated["enabled"] is False
        assert updated["severity"] == "P3"

        # delete
        resp = client.delete(f"/api/alerts/rules/{rule_id}")
        assert resp.status_code == 204
        assert client.get("/api/alerts/rules").json() == []

    def test_silence_rule(self, client: Any) -> None:
        from datetime import UTC, datetime, timedelta

        resp = client.post(
            "/api/alerts/rules",
            json={"name": "s", "metricType": "error_count", "operator": "gt", "threshold": 1, "severity": "P2"},
        )
        rule_id = resp.json()["id"]

        until = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
        resp = client.post(f"/api/alerts/rules/{rule_id}/silence", json={"silenceUntil": until})
        assert resp.status_code == 200, resp.text
        assert resp.json()["silenceUntil"] is not None

        # clearing silence
        resp = client.post(f"/api/alerts/rules/{rule_id}/silence", json={"silenceUntil": None})
        assert resp.status_code == 200
        assert resp.json()["silenceUntil"] is None

    def test_silence_missing_rule_returns_404(self, client: Any) -> None:
        resp = client.post("/api/alerts/rules/nope/silence", json={"silenceUntil": None})
        assert resp.status_code == 404

    def test_create_rejects_unsupported_metric_type(self, client: Any) -> None:
        resp = client.post(
            "/api/alerts/rules",
            json={
                "name": "bad",
                "metricType": "not_a_metric",
                "operator": "gt",
                "threshold": 1,
                "severity": "P2",
            },
        )
        assert resp.status_code == 400

    def test_update_missing_rule_returns_404(self, client: Any) -> None:
        resp = client.put("/api/alerts/rules/nope", json={"threshold": 1})
        assert resp.status_code == 404

    def test_delete_missing_rule_returns_404(self, client: Any) -> None:
        assert client.delete("/api/alerts/rules/nope").status_code == 404


class TestEventsAPI:
    def test_list_events_joins_rule_name(self, client: Any) -> None:
        _insert_rule()
        _insert_event()

        resp = client.get("/api/alerts/events")
        assert resp.status_code == 200
        events = resp.json()
        assert len(events) == 1
        assert events[0]["ruleName"] == "Error rate spike"
        assert events[0]["status"] == "firing"

    def test_list_events_filters(self, client: Any) -> None:
        _insert_rule()
        _insert_event(id="evt-a", status="firing")
        _insert_event(id="evt-b", status="resolved", resolved_at=datetime.now(UTC))

        resp = client.get("/api/alerts/events", params={"status": "resolved"})
        assert resp.status_code == 200
        assert [e["id"] for e in resp.json()] == ["evt-b"]

        resp = client.get("/api/alerts/events", params={"ruleId": "rule-test-1"})
        assert resp.status_code == 200
        assert len(resp.json()) == 2

        resp = client.get("/api/alerts/events", params={"severity": "P1"})
        assert resp.status_code == 200
        assert resp.json() == []

    def test_event_rule_deleted_keeps_history(self, client: Any) -> None:
        _insert_rule()
        _insert_event()
        import asyncio

        asyncio.run(_delete_rules())

        resp = client.get("/api/alerts/events")
        assert resp.status_code == 200
        assert resp.json()[0]["ruleName"] == "rule-test-1"

    def test_ack_event(self, client: Any) -> None:
        _insert_rule()
        _insert_event()

        resp = client.post("/api/alerts/events/evt-test-1/ack")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "acked"
        assert body["ackedAt"] is not None

        # idempotent second ack
        resp = client.post("/api/alerts/events/evt-test-1/ack")
        assert resp.status_code == 200
        assert resp.json()["status"] == "acked"

    def test_ack_missing_event_returns_404(self, client: Any) -> None:
        assert client.post("/api/alerts/events/nope/ack").status_code == 404


class TestNotificationsAPI:
    def test_mark_read_and_read_all(self, client: Any) -> None:
        async def _seed() -> None:
            factory = db_mod.get_session_factory()
            async with factory() as session:
                session.add_all(
                    [
                        NotificationDB(
                            id="n1",
                            user_id="admin",
                            title="t1",
                            body="b1",
                            type="alert",
                            created_at=datetime(2026, 8, 19, tzinfo=UTC),
                        ),
                        NotificationDB(
                            id="n2",
                            user_id="admin",
                            title="t2",
                            body="b2",
                            type="alert",
                            created_at=datetime(2026, 8, 19, tzinfo=UTC),
                        ),
                        NotificationDB(
                            id="n3",
                            user_id="other",
                            title="t3",
                            body="b3",
                            type="alert",
                            created_at=datetime(2026, 8, 19, tzinfo=UTC),
                        ),
                    ]
                )
                await session.commit()

        import asyncio

        asyncio.run(_seed())

        # unread filter shows own unread only
        resp = client.get("/api/alerts/notifications", headers=H, params={"unread_only": "true"})
        assert resp.status_code == 200
        assert {n["id"] for n in resp.json()} == {"n1", "n2"}

        # unread count badge
        resp = client.get("/api/alerts/notifications/unread-count", headers=H)
        assert resp.status_code == 200
        assert resp.json() == {"count": 2}

        # mark one read (owner-scoped; cannot touch others' rows)
        resp = client.post("/api/alerts/notifications/n1/read", headers=H)
        assert resp.status_code == 200
        assert resp.json()["readAt"] is not None
        assert client.post("/api/alerts/notifications/n3/read", headers=H).status_code == 404

        resp = client.get("/api/alerts/notifications", headers=H, params={"unread_only": "true"})
        assert {n["id"] for n in resp.json()} == {"n2"}

        # read-all
        resp = client.post("/api/alerts/notifications/read-all", headers=H)
        assert resp.status_code == 200
        assert resp.json()["count"] == 1
        resp = client.get("/api/alerts/notifications", headers=H, params={"unread_only": "true"})
        assert resp.json() == []


class TestSubscriptionsAPI:
    def test_replace_and_list(self, client: Any) -> None:
        resp = client.put(
            "/api/alerts/subscriptions",
            headers=H,
            json={
                "subscriptions": [
                    {"severity": "P1", "enabled": True},
                    {"severity": "P2", "teamId": "team-x", "enabled": False},
                ]
            },
        )
        assert resp.status_code == 200, resp.text
        subs = resp.json()
        assert {s["severity"] for s in subs} == {"P1", "P2"}
        assert next(s for s in subs if s["severity"] == "P2")["teamId"] == "team-x"

        # replace atomically drops the previous set
        resp = client.put(
            "/api/alerts/subscriptions",
            headers=H,
            json={"subscriptions": [{"severity": "P3", "enabled": True}]},
        )
        assert resp.status_code == 200
        assert [s["severity"] for s in resp.json()] == ["P3"]

        resp = client.get("/api/alerts/subscriptions", headers=H)
        assert resp.status_code == 200
        assert [s["severity"] for s in resp.json()] == ["P3"]


class TestAuthz:
    def test_legacy_admin_can_write(self, client: Any) -> None:
        resp = client.post(
            "/api/alerts/rules",
            json={"name": "ok", "metricType": "error_count", "operator": "gt", "threshold": 1, "severity": "P2"},
        )
        assert resp.status_code == 201

    def test_viewer_role_rejected(self, monkeypatch: Any) -> None:
        """RBAC path: require_role must reject a viewer without HTTP machinery."""
        import os

        from auth.auth_rbac import require_role

        os.environ["AUTH_MODE"] = "rbac"

        class _User:
            id = "alice"
            username = "alice"
            email = "alice@example.com"
            roles = ["viewer"]

        checker = require_role("admin")
        try:
            checker(_User())
            raise AssertionError("viewer should be rejected")
        except Exception as exc:  # noqa: BLE001 — HTTPException expected
            assert getattr(exc, "status_code", None) == 403
        finally:
            os.environ["AUTH_MODE"] = "legacy"

    def test_admin_role_accepted(self, monkeypatch: Any) -> None:
        import os

        from auth.auth_rbac import require_role

        os.environ["AUTH_MODE"] = "rbac"

        class _User:
            id = "bob"
            username = "bob"
            email = "bob@example.com"
            roles = ["admin"]

        checker = require_role("admin")
        try:
            result = checker(_User())
            assert result.id == "bob"
        finally:
            os.environ["AUTH_MODE"] = "legacy"
