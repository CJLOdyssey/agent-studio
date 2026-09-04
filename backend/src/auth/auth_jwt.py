"""通过 PyJWT（HS256）创建与校验 JWT token。

保留针对 pre-PyJWT 简化 HMAC token 格式 ``base64(user_id:ts:sig[:16])``
的旧解码分支，使已签发的 token 仍可校验。
"""

import base64
import hashlib
import hmac
import os
import time
from typing import Any

import jwt

from core.infra.logging_config import get_logger

logger = get_logger(__name__)

AUTH_SECRET = os.environ.get("AUTH_SECRET", "")


def _base64url_decode(data: str) -> bytes:
    """解码 base64url 字符串并修复填充。"""
    rem = len(data) % 4
    if rem:
        data += "=" * (4 - rem)
    return base64.urlsafe_b64decode(data)


def decode_jwt(token: str, secret: str) -> dict[str, Any] | None:
    """解码并校验 JWT token。

    有效则返回 payload 字典，否则返回 None。
    标准 token 用 PyJWT 校验（HS256，强制校验响应头 alg）。
    简化的旧 token 回退到旧 HMAC 校验。
    """
    if not secret:
        return None

    parts = token.split(".")
    if len(parts) == 3:
        try:
            return jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"require": ["exp"], "verify_exp": True},
            )
        except Exception:
            logger.warning("JWT decode error", exc_info=True)
            return None

    # 旧版简化 token：base64url(user_id:ts:sig[:16])
    if len(parts) == 1:
        try:
            raw = _base64url_decode(token).decode()
            user_id, ts_str, provided_sig = raw.rsplit(":", 2)
            expected = hmac.new(
                secret.encode(),
                f"{user_id}:{ts_str}".encode(),
                hashlib.sha256,
            ).hexdigest()[:16]
            if not hmac.compare_digest(provided_sig, expected):
                return None
            if int(ts_str) < int(time.time()) - 86400:
                return None
            return {"sub": user_id, "iat": int(ts_str)}
        except (ValueError, UnicodeDecodeError):
            return None

    return None


def create_token(user_id: str, secret: str, ttl: int = 86400) -> str:
    """为给定 user_id 创建 HS256 JWT token。"""
    if not secret:
        # PyJWT >= 2.12 在空密钥时抛出 InvalidKeyError；像 decode_jwt 一样兜底，
        # 使没有 AUTH_SECRET 的测试环境不致崩溃。
        raise ValueError("AUTH_SECRET is empty — cannot create token")
    now = int(time.time())
    return jwt.encode(
        {"sub": user_id, "iat": now, "exp": now + ttl},
        secret,
        algorithm="HS256",
    )
