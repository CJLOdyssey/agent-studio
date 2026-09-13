"""安全响应头 ASGI 中间件 —— 针对常见 Web 攻击的纵深防御。

为每个 HTTP 响应添加 X-Content-Type-Options、X-Frame-Options、
Strict-Transport-Security、Referrer-Policy 与 Permissions-Policy 响应头。

纯 ASGI，避免 Starlette BaseHTTPMiddleware 与 h11 的响应头编码问题。
注意：必须保留多值响应头（如多个 Set-Cookie）—— 用 dict() 合并会静默
丢弃除最后一个外的全部（曾导致 access/refresh 双 cookie 只下发其一）。
"""

from __future__ import annotations

import os

from starlette.types import ASGIApp, Message, Receive, Scope, Send

# 合理默认：nosniff + 禁止嵌套 + HSTS 1 年（含子域）+ 严格 referrer 策略 +
# 特性锁定（禁摄像头/麦克风/定位等）。可通过环境变量覆盖单个响应头，
# 置空字符串则禁用。
# 注：X-XSS-Protection 有意不设 —— OWASP 已标记废弃并建议不设置
# （它本身是一个 XSS 向量）。
_SECURE_HEADERS: list[tuple[bytes, bytes]] = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"strict-transport-security", b"max-age=31536000; includeSubDomains"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
    (
        b"permissions-policy",
        b"camera=(), microphone=(), geolocation=(), payment=(), "
        b"usb=(), magnetometer=(), gyroscope=()",
    ),
]

# 逐头覆盖 —— 环境变量置空字符串即跳过该响应头。
_ENV_OVERRIDES: dict[str, int] = {
    "X_CONTENT_TYPE_OPTIONS": 0,
    "X_FRAME_OPTIONS": 1,
    "STRICT_TRANSPORT_SECURITY": 2,
    "REFERRER_POLICY": 3,
    "PERMISSIONS_POLICY": 4,
}


class SecurityHeadersMiddleware:
    """为每个响应添加安全响应头的纯 ASGI 中间件。"""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        headers = _build_headers()

        async def _send(message: Message) -> None:
            if message["type"] == "http.response.start":
                # 保留多值响应头（如多个 Set-Cookie）—— dict() 合并会静默
                # 丢弃除最后一个外的全部。仅追加缺失的安全头，不重建列表。
                existing = list(message.get("headers", []))
                existing_keys = {k for k, _ in existing}
                for k, v in headers:
                    if k not in existing_keys:
                        existing.append((k, v))
                message["headers"] = existing
            await send(message)

        await self.app(scope, receive, _send)


def _build_headers() -> list[tuple[bytes, bytes]]:
    result: list[tuple[bytes, bytes]] = []
    for key, idx in _ENV_OVERRIDES.items():
        val = os.environ.get(key)
        if val is not None:
            if val:
                result.append((_SECURE_HEADERS[idx][0], val.encode("ascii")))
            # 空字符串 → 跳过该响应头
        else:
            result.append(_SECURE_HEADERS[idx])
    return result
