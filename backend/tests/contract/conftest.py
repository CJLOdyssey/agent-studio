"""Contract test fixtures — shared HTTP client for integration contract testing."""

from __future__ import annotations

import os
from typing import Any

import httpx
import pytest

BASE_URL = os.environ.get("CONTRACT_BASE_URL", "http://localhost:8080")

CONTRACT_EMAIL = os.environ.get("CONTRACT_EMAIL", "admin@example.com")
CONTRACT_PASSWORD = os.environ.get("CONTRACT_PASSWORD", "admin123")

_COOKIE_CACHE: httpx.Cookies | None = None


@pytest.fixture(scope="session")
async def contract_client() -> Any:
    """Session-scoped httpx.AsyncClient pointing at the local backend.

    Unlike the root conftest's ``test_client`` (which uses ASGI transport
    directly), this fixture connects via real HTTP — suitable for contract
    tests that verify responses over the wire.

    Auth cookies are obtained once per session and cached on the client
    (cookie-only transport — the login response body no longer carries tokens).
    """
    cookies = _obtain_cookies()

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as client:
        if cookies:
            client.cookies.update(cookies)
        yield client


def _obtain_cookies() -> httpx.Cookies | None:
    """Login as the seeded admin (rbac mode); cache auth cookies per session."""
    global _COOKIE_CACHE
    if _COOKIE_CACHE is not None:
        return _COOKIE_CACHE

    try:
        resp = httpx.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": CONTRACT_EMAIL, "password": CONTRACT_PASSWORD},
            timeout=5,
        )
        if resp.status_code == 200:
            _COOKIE_CACHE = resp.cookies
            return _COOKIE_CACHE
    except Exception:
        pass

    _COOKIE_CACHE = httpx.Cookies()
    return None
