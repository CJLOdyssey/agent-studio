"""Tests for auth/ownership.py — owner-scoping helpers under RBAC on/off.

Covers the security boundary added for resource routes: legacy mode must keep
pre-existing behavior (no enforcement), RBAC mode must reject anonymous and
non-owner callers with 404, and both dict- and ORM-shaped resources must be
checked (regression: dict resources were once treated as unowned).
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from auth import ownership as ow


@pytest.fixture(autouse=True)
def _legacy_default(monkeypatch):
    monkeypatch.setenv("AUTH_ENABLED", "0")


def _enable_rbac(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "1")
    import auth.auth_rbac as ar

    monkeypatch.setattr(ar, "AUTH_ENABLED", True)


def _request(user_id: str) -> MagicMock:
    req = MagicMock()
    req.state.user_id = user_id
    req.cookies.get.return_value = None
    req.headers.get.return_value = user_id
    return req


def _resource(owner_id: str | None) -> dict[str, str | None]:
    return {"id": "r1", "owner_id": owner_id}


class TestRequireOwned:
    async def test_legacy_no_enforcement(self):
        res = await ow.require_owned(
            _request("anonymous"), "r1", AsyncMock(return_value=_resource("someone-else")),
        )
        assert res["owner_id"] == "someone-else"

    async def test_rbac_owner_match(self, monkeypatch):
        _enable_rbac(monkeypatch)
        res = await ow.require_owned(
            _request("u1"), "r1", AsyncMock(return_value=_resource("u1")),
        )
        assert res["id"] == "r1"

    async def test_rbac_anonymous_404(self, monkeypatch):
        _enable_rbac(monkeypatch)
        with pytest.raises(HTTPException) as ei:
            await ow.require_owned(
                _request("anonymous"), "r1", AsyncMock(return_value=_resource("u1")),
                not_found=ow.ErrorCode.TEAM_NOT_FOUND,
            )
        assert ei.value.status_code == 404

    async def test_rbac_foreign_owner_404(self, monkeypatch):
        _enable_rbac(monkeypatch)
        with pytest.raises(HTTPException) as ei:
            await ow.require_owned(
                _request("u2"), "r1", AsyncMock(return_value=_resource("u1")),
                not_found=ow.ErrorCode.TEAM_NOT_FOUND,
            )
        assert ei.value.status_code == 404

    async def test_rbac_dict_owner_enforced(self, monkeypatch):
        """Regression: dict resources must be owner-checked, not treated as unowned."""
        _enable_rbac(monkeypatch)
        with pytest.raises(HTTPException):
            await ow.require_owned(
                _request("u2"), "r1", AsyncMock(return_value=_resource("u1")),
                allow_unowned=True,
            )

    async def test_rbac_orm_owner_enforced(self, monkeypatch):
        _enable_rbac(monkeypatch)
        getter = AsyncMock(return_value=SimpleNamespace(owner_id="u1"))
        with pytest.raises(HTTPException):
            await ow.require_owned(_request("u2"), "r1", getter)

    async def test_rbac_unowned_read_allowed(self, monkeypatch):
        _enable_rbac(monkeypatch)
        res = await ow.require_owned(
            _request("u1"), "r1", AsyncMock(return_value=_resource(None)),
        )
        assert res is not None

    async def test_rbac_unowned_write_404(self, monkeypatch):
        _enable_rbac(monkeypatch)
        with pytest.raises(HTTPException) as ei:
            await ow.require_owned(
                _request("u1"), "r1", AsyncMock(return_value=_resource(None)),
                allow_unowned=False, not_found=ow.ErrorCode.TEAM_NOT_FOUND,
            )
        assert ei.value.status_code == 404

    async def test_missing_resource_404(self):
        with pytest.raises(HTTPException) as ei:
            await ow.require_owned(
                _request("u1"), "missing", AsyncMock(return_value=None),
                not_found=ow.ErrorCode.TEAM_NOT_FOUND,
            )
        assert ei.value.status_code == 404


class TestRequireRunOwner:
    async def test_legacy_returns_none_without_db(self, monkeypatch):
        assert await ow.require_run_owner(_request("u1"), "r1") is None

    async def test_rbac_owner_ok(self, monkeypatch):
        _enable_rbac(monkeypatch)
        with patch("repository.get_run", new_callable=AsyncMock,
                   return_value=SimpleNamespace(session_id="s1")), \
             patch("repository.get_session", new_callable=AsyncMock,
                   return_value=SimpleNamespace(user_id="u1")):
            run = await ow.require_run_owner(_request("u1"), "r1")
            assert run.session_id == "s1"

    async def test_rbac_foreign_owner_404(self, monkeypatch):
        _enable_rbac(monkeypatch)
        with patch("repository.get_run", new_callable=AsyncMock,
                   return_value=SimpleNamespace(session_id="s1")), \
             patch("repository.get_session", new_callable=AsyncMock,
                   return_value=SimpleNamespace(user_id="u1")):
            with pytest.raises(HTTPException):
                await ow.require_run_owner(_request("u2"), "r1")

    async def test_rbac_anonymous_404(self, monkeypatch):
        _enable_rbac(monkeypatch)
        with patch("repository.get_run", new_callable=AsyncMock,
                   return_value=SimpleNamespace(session_id="s1")), \
             patch("repository.get_session", new_callable=AsyncMock,
                   return_value=SimpleNamespace(user_id="u1")):
            with pytest.raises(HTTPException):
                await ow.require_run_owner(_request("anonymous"), "r1")


class TestWsRunOwner:
    async def test_legacy_allows(self, monkeypatch):
        assert await ow.ws_run_owner(MagicMock(), "r1") is True

    async def test_rbac_no_token_denied(self, monkeypatch):
        _enable_rbac(monkeypatch)
        ws = MagicMock()
        ws.cookies.get.return_value = None
        assert await ow.ws_run_owner(ws, "r1") is False

    async def test_rbac_owner_allowed(self, monkeypatch):
        _enable_rbac(monkeypatch)
        from auth.auth_jwt import AUTH_SECRET, create_token

        ws = MagicMock()
        ws.cookies.get.return_value = create_token("u1", AUTH_SECRET)
        with patch("repository.get_run", new_callable=AsyncMock,
                   return_value=SimpleNamespace(session_id="s1")), \
             patch("repository.get_session", new_callable=AsyncMock,
                   return_value=SimpleNamespace(user_id="u1")):
            assert await ow.ws_run_owner(ws, "r1") is True

    async def test_rbac_foreign_denied(self, monkeypatch):
        _enable_rbac(monkeypatch)
        from auth.auth_jwt import AUTH_SECRET, create_token

        ws = MagicMock()
        ws.cookies.get.return_value = create_token("u2", AUTH_SECRET)
        with patch("repository.get_run", new_callable=AsyncMock,
                   return_value=SimpleNamespace(session_id="s1")), \
             patch("repository.get_session", new_callable=AsyncMock,
                   return_value=SimpleNamespace(user_id="u1")):
            assert await ow.ws_run_owner(ws, "r1") is False
