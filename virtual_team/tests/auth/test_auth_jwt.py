"""Unit tests for virtual_team/auth_jwt.py (JWT token creation and decoding)."""

import json
import time


class TestCreateToken:
    def test_returns_valid_jwt_string(self):
        from virtual_team.auth.auth_jwt import create_token

        token = create_token("user-1", "mysecret", ttl=3600)
        parts = token.split(".")
        assert len(parts) == 3
        assert all(isinstance(p, str) and len(p) > 0 for p in parts)

    def test_token_contains_user_id(self):
        from virtual_team.auth.auth_jwt import create_token, decode_jwt

        token = create_token("alice", "secret", ttl=3600)
        payload = decode_jwt(token, "secret")
        assert payload is not None
        assert payload["sub"] == "alice"




class TestDecodeJWT:
    def test_valid_token(self):
        from virtual_team.auth.auth_jwt import create_token, decode_jwt

        token = create_token("bob", "key123", ttl=3600)
        payload = decode_jwt(token, "key123")
        assert payload is not None
        assert payload["sub"] == "bob"
        assert "exp" in payload
        assert "iat" in payload

    def test_expired_token_returns_none(self):
        from virtual_team.auth.auth_jwt import create_token, decode_jwt

        token = create_token("bob", "key123", ttl=-1)

        payload = decode_jwt(token, "key123")
        assert payload is None

    def test_wrong_secret_returns_none(self):
        from virtual_team.auth.auth_jwt import create_token, decode_jwt

        token = create_token("bob", "real-secret", ttl=3600)
        payload = decode_jwt(token, "wrong-secret")
        assert payload is None

    def test_empty_secret_returns_none(self):
        from virtual_team.auth.auth_jwt import decode_jwt

        payload = decode_jwt("some.token.here", "")
        assert payload is None

    def test_malformed_token_returns_none(self):
        from virtual_team.auth.auth_jwt import decode_jwt

        payload = decode_jwt("not-a-valid-token", "secret")
        assert payload is None

    def test_tampered_payload_returns_none(self):
        from virtual_team.auth.auth_jwt import create_token, decode_jwt

        token = create_token("alice", "secret", ttl=3600)
        parts = token.split(".")
        tampered = f"{parts[0]}.{parts[1]}.invalidsig"
        payload = decode_jwt(tampered, "secret")
        assert payload is None

    def test_base64url_decode_pads_correctly(self):
        from virtual_team.auth.auth_jwt import _base64url_decode

        result = _base64url_decode("eyJzdWIiOiAidGVzdCJ9")
        assert json.loads(result) == {"sub": "test"}

    def test_simplified_token_format(self):
        from virtual_team.auth.auth_jwt import decode_jwt

        now = int(time.time())
        raw = f"testuser:{now}:abcdef1234567890"
        import base64

        token = base64.urlsafe_b64encode(raw.encode()).rstrip(b"=").decode()
        payload = decode_jwt(token, "some_secret")
        assert payload is None  # Wrong signature

    def test_simplified_token_expired(self):
        from virtual_team.auth.auth_jwt import decode_jwt

        past = int(time.time()) - 90000
        import base64
        import hashlib
        import hmac

        raw = f"testuser:{past}"
        sig = hmac.new(b"secret", raw.encode(), hashlib.sha256).hexdigest()[:16]
        token = base64.urlsafe_b64encode(f"{raw}:{sig}".encode()).rstrip(b"=").decode()
        payload = decode_jwt(token, "secret")
        assert payload is None


# ─────────────────────────────────────────────────────────────────────
# 4. virtual_team/database.py — Engine & session factory
# ─────────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────
# 5. virtual_team/audit.py — Audit logging
# ─────────────────────────────────────────────────────────────────────


