from typing import Any, cast

"""JWT token creation and verification.

Handles HS256-signed JWTs and a simplified HMAC token format.
"""

import base64
import hashlib
import hmac
import json
import os
import time

from virtual_team.core.logging_config import get_logger

logger = get_logger(__name__)

AUTH_SECRET = os.environ.get("AUTH_SECRET", "")


def _base64url_decode(data: str) -> bytes:
    """Decode base64url-encoded string with padding fix."""
    rem = len(data) % 4
    if rem:
        data += "=" * (4 - rem)
    return base64.urlsafe_b64decode(data)


def decode_jwt(token: str, secret: str) -> dict[str, Any] | None:
    """Decode and verify a JWT token.

    Returns the payload dict if valid, None otherwise.
    Handles both HS256 and a simplified HMAC format.
    """
    if not secret:
        return None

    try:
        # Standard JWT: header.payload.signature
        parts = token.split(".")
        if len(parts) == 3:
            header_b64, payload_b64, sig_b64 = parts
            signed_data = f"{header_b64}.{payload_b64}"

            expected_sig = hmac.new(
                secret.encode(),
                signed_data.encode(),
                hashlib.sha256,
            ).digest()
            expected_sig_b64 = base64.urlsafe_b64encode(expected_sig).rstrip(b"=").decode()

            if not hmac.compare_digest(sig_b64, expected_sig_b64):
                return None

            payload = json.loads(_base64url_decode(payload_b64))

            # Check expiration
            exp = payload.get("exp", 0)
            if exp and int(time.time()) > exp:
                return None

            return cast(dict[str, Any], payload)

        # Simplified token: HMAC-SHA256 of user_id:timestamp
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

    except Exception:
        logger.warning("JWT decode error", exc_info=True)

    return None


def create_token(user_id: str, secret: str, ttl: int = 86400) -> str:
    """Create a simple JWT token for the given user_id."""
    now = int(time.time())
    header = (
        base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        .rstrip(b"=")
        .decode()
    )
    payload = (
        base64.urlsafe_b64encode(
            json.dumps({"sub": user_id, "iat": now, "exp": now + ttl}).encode()
        )
        .rstrip(b"=")
        .decode()
    )

    signed_data = f"{header}.{payload}"
    signature = (
        base64.urlsafe_b64encode(
            hmac.new(secret.encode(), signed_data.encode(), hashlib.sha256).digest()
        )
        .rstrip(b"=")
        .decode()
    )

    return f"{signed_data}.{signature}"
