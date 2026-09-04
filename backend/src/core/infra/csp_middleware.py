"""Content-Security-Policy ASGI 中间件，用于纵深防御 XSS。

纯 ASGI，避免 Starlette BaseHTTPMiddleware 与 h11 的响应头编码问题。
"""

from __future__ import annotations

import os

from starlette.types import ASGIApp, Message, Receive, Scope, Send

# 合理默认：API 响应仅允许 self。可通过 CSP_POLICY 环境变量覆盖为更严格规则
# （如针对前端源的 script-src、connect-src）。置空字符串则禁用。
_DEFAULT_CSP = "default-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'"
CSP_POLICY = os.environ.get("CSP_POLICY", _DEFAULT_CSP).strip()


class CSPMiddleware:
    """添加 Content-Security-Policy 响应头的纯 ASGI 中间件。"""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        policy = CSP_POLICY
        if not policy:
            await self.app(scope, receive, send)
            return

        async def _send(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append(
                    (b"content-security-policy", policy.encode("ascii"))
                )
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, _send)
