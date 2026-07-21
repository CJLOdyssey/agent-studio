"""Content-Security-Policy ASGI middleware for defense-in-depth XSS protection.

Pure ASGI to avoid Starlette BaseHTTPMiddleware header encoding issues with h11.
"""

from __future__ import annotations

import os

from starlette.types import ASGIApp, Message, Receive, Scope, Send

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
    "frame-ancestors 'none'; ",
)


class CSPMiddleware:
    """Pure ASGI middleware that adds Content-Security-Policy header."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        async def _send(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append(
                    (b"content-security-policy", CSP_POLICY.encode("ascii"))
                )
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, _send)
