"""Tests for the global exception handler (backend/core/app.py)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from starlette.testclient import TestClient


class TestExceptionHandler:
    @pytest.fixture
    def client(self):
        import os
        os.environ['AUTH_MODE'] = 'legacy'
        os.environ['AUTH_ENABLED'] = '0'
        os.environ['RATE_LIMIT'] = '9999'
        os.environ['REDIS_URL'] = 'redis://localhost:6379/0'
        from core.app import app
        with TestClient(app) as c:
            yield c

    def test_health_returned(self, client):
        resp = client.get("/api/health")
        assert resp.status_code in (200, 503)  # may be 503 if DB not available

    def test_version_endpoint(self, client):
        resp = client.get("/api/version")
        assert resp.status_code == 200
        assert "version" in resp.json()

    def test_unknown_route_returns_json(self, client):
        resp = client.get("/api/nonexistent")
        # FastAPI returns 404 for unknown routes
        # The exception handler catches unhandled exceptions only
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_http_exception_403_writes_error_audit(self):
        """403 (越权) responses must be recorded to the audit trail at error level."""
        from core.app import http_exception_handler

        request = MagicMock()
        request.method = "GET"
        request.url.path = "/api/admin/stats"
        exc = HTTPException(status_code=403, detail="Insufficient role")

        with patch("core.audit.log_audit", new_callable=AsyncMock) as mock_log:
            resp = await http_exception_handler(request, exc)

        mock_log.assert_awaited_once()
        call = mock_log.await_args
        assert call is not None
        kwargs = call.kwargs
        assert kwargs["action"] == "access_denied"
        assert kwargs["level"] == "error"
        assert kwargs["entity_type"] == "system"
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_http_exception_non_403_passes_through(self):
        """Non-403 statuses pass through unchanged without audit write."""
        from core.app import http_exception_handler

        request = MagicMock()
        request.method = "GET"
        request.url.path = "/api/nonexistent"
        exc = HTTPException(status_code=404, detail="Not Found")

        with patch("core.audit.log_audit", new_callable=AsyncMock) as mock_log:
            resp = await http_exception_handler(request, exc)

        mock_log.assert_not_awaited()
        assert resp.status_code == 404
        assert resp.body == b'{"detail":"Not Found"}'
