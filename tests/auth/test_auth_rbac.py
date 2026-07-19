"""Tests for RBAC auth module (backend/auth/auth_rbac.py)."""

from unittest.mock import MagicMock, patch

import pytest

from backend.auth.auth_rbac import (
    AUTH_ENABLED,
    AUTH_MODE,
    PUBLIC_PATHS,
    PUBLIC_PREFIXES,
    CurrentUser,
    get_user_id,
    require_role,
)

FAKE_STATE = type("FakeState", (), {"user_id": None})


class TestCurrentUser:
    def test_default_admin(self):
        u = CurrentUser()
        assert u.id == "admin"
        assert u.username == "admin"
        assert u.roles == ["admin"]

    def test_custom_user(self):
        u = CurrentUser(id="u1", username="bob", roles=["member"])
        assert u.id == "u1"
        assert u.username == "bob"


class TestPublicConfig:
    def test_public_health(self):
        assert "/api/health" in PUBLIC_PATHS

    def test_public_metrics(self):
        assert "/api/metrics" in PUBLIC_PATHS

    def test_public_docs(self):
        assert "/docs" in PUBLIC_PATHS

    def test_public_prefixes(self):
        assert "/ws/" in PUBLIC_PREFIXES
        assert "/api/auth/" in PUBLIC_PREFIXES


class TestGetUserId:
    def test_from_state(self):
        request = MagicMock()
        request.state.user_id = "user-abc"
        assert get_user_id(request) == "user-abc"

    def test_from_header(self):
        request = MagicMock()
        request.state = FAKE_STATE()
        request.headers = {"X-User-ID": "header-user"}
        assert get_user_id(request) == "header-user"

    def test_anonymous(self):
        request = MagicMock()
        request.state = FAKE_STATE()
        request.headers = {}
        assert get_user_id(request) == "anonymous"


class TestEnvConfig:
    def test_auth_enabled_bool(self):
        assert AUTH_ENABLED in (True, False)

    def test_auth_mode_value(self):
        assert AUTH_MODE in ("legacy", "rbac")


class TestRequireRole:
    def test_legacy_bypass(self, monkeypatch):
        monkeypatch.setenv("AUTH_MODE", "legacy")
        import importlib
        mod = importlib.import_module("backend.auth.auth_rbac")
        importlib.reload(mod)
        checker = mod.require_role("admin")
        result = checker(current_user=mod.CurrentUser())
        assert result.id == "admin"
