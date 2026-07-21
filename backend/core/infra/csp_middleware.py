"""Content-Security-Policy middleware for defense-in-depth XSS protection.

Adds a CSP header to every response. Policy is configurable via env vars or
defaults to a permissive development policy.
"""

from __future__ import annotations

import os
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

CSP_POLICY = os.environ.get(
    "CSP_POLICY",
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: https:; "
    "connect-src 'self' ws: wss:; "
    "font-src 'self'; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "frame-ancestors 'none'; "
)


class CSPMiddleware(BaseHTTPMiddleware):
    """Add Content-Security-Policy header to all responses."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = CSP_POLICY
        return response
