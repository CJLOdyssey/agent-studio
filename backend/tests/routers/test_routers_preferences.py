"""Preferences router tests — cross-device user preference persistence (bug 2).

Uses the shared tests/routers/conftest.py fixtures: sqlite in-memory DB with
per-test schema reset (_reset_db) + mocked redis + AUTH_MODE=legacy (X-User-ID
header acts as the user namespace).
"""

from unittest.mock import AsyncMock, patch

import pytest

pytestmark = pytest.mark.unit


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"X-User-ID": "admin"}


class TestPreferences:
    """Cross-device preferences: roundtrip, upsert, and user-scope isolation."""

    def test_preferences_roundtrip(self, client, auth_headers):
        """模型偏好跨设备持久化：PUT 后 GET 返回。"""
        resp = client.put(
            "/api/preferences",
            headers=auth_headers,
            json={
                "key": "selected_model",
                "value": "THUDM/GLM-Z1-9B-0414",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["key"] == "selected_model"
        assert resp.json()["value"] == "THUDM/GLM-Z1-9B-0414"

        resp = client.get("/api/preferences", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body.get("selected_model") == "THUDM/GLM-Z1-9B-0414"

    def test_preferences_user_scope_isolation(self, client, auth_headers):
        """不同用户各自的偏好互不影响——bug 2 跨设备语义的核心。"""
        user_a = {"X-User-ID": "user-a"}
        user_b = {"X-User-ID": "user-b"}

        resp = client.put(
            "/api/preferences",
            headers=user_a,
            json={
                "key": "selected_model",
                "value": "model-a",
            },
        )
        assert resp.status_code == 200
        resp = client.put(
            "/api/preferences",
            headers=user_b,
            json={
                "key": "selected_model",
                "value": "model-b",
            },
        )
        assert resp.status_code == 200

        assert client.get("/api/preferences", headers=user_a).json().get("selected_model") == "model-a"
        assert client.get("/api/preferences", headers=user_b).json().get("selected_model") == "model-b"

    def test_preferences_upsert_overwrites(self, client, auth_headers):
        """同一 key 重复 PUT → 覆盖旧值（last-write-wins）。"""
        client.put(
            "/api/preferences",
            headers=auth_headers,
            json={
                "key": "selected_model",
                "value": "old-model",
            },
        )
        resp = client.put(
            "/api/preferences",
            headers=auth_headers,
            json={
                "key": "selected_model",
                "value": "new-model",
            },
        )
        assert resp.status_code == 200
        assert client.get("/api/preferences", headers=auth_headers).json().get("selected_model") == "new-model"

    def test_preferences_get_empty_for_new_user(self, client, auth_headers):
        """无偏好时 GET 返回空 dict。"""
        resp = client.get("/api/preferences", headers={"X-User-ID": "fresh-user"})
        assert resp.status_code == 200
        assert resp.json() == {}

    def test_preferences_put_missing_key(self, client, auth_headers):
        resp = client.put("/api/preferences", headers=auth_headers, json={"value": "x"})
        assert resp.status_code == 400

    def test_preferences_put_empty_key(self, client, auth_headers):
        resp = client.put("/api/preferences", headers=auth_headers, json={"key": "", "value": "x"})
        assert resp.status_code == 400

    def test_preferences_put_missing_value(self, client, auth_headers):
        """缺 value → 400，避免 JSON NOT NULL 列插 NULL → IntegrityError → 500。"""
        resp = client.put("/api/preferences", headers=auth_headers, json={"key": "selected_model"})
        assert resp.status_code == 400

    def test_preferences_put_null_value(self, client, auth_headers):
        """value:null → 400，同上。"""
        resp = client.put(
            "/api/preferences",
            headers=auth_headers,
            json={"key": "selected_model", "value": None},
        )
        assert resp.status_code == 400

    def test_preferences_get_exception(self, client, auth_headers):
        with patch(
            "routers.preferences.get_all_preferences", new_callable=AsyncMock, side_effect=RuntimeError("db error")
        ):
            resp = client.get("/api/preferences", headers=auth_headers)
            assert resp.status_code == 500

    def test_preferences_put_exception(self, client, auth_headers):
        with patch("routers.preferences.set_preference", new_callable=AsyncMock, side_effect=RuntimeError("db error")):
            resp = client.put(
                "/api/preferences",
                headers=auth_headers,
                json={
                    "key": "selected_model",
                    "value": "x",
                },
            )
            assert resp.status_code == 500
