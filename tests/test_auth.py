"""Tests for JWT auth module."""
import os
import time
import pytest

from virtual_team.auth import decode_jwt, create_token


SECRET = "test-secret-key-for-unit-tests"


class TestJwtCreateAndDecode:
    def test_create_and_decode_valid_token(self):
        token = create_token("user-123", SECRET, ttl=3600)
        payload = decode_jwt(token, SECRET)
        assert payload is not None
        assert payload["sub"] == "user-123"

    def test_decode_with_wrong_secret(self):
        token = create_token("user-123", SECRET, ttl=3600)
        payload = decode_jwt(token, "wrong-secret")
        assert payload is None

    def test_decode_expired_token(self):
        token = create_token("user-123", SECRET, ttl=-1)  # already expired
        payload = decode_jwt(token, SECRET)
        assert payload is None

    def test_decode_garbage_token(self):
        payload = decode_jwt("not.a.valid.token!!!", SECRET)
        assert payload is None

    def test_decode_empty_token(self):
        payload = decode_jwt("", SECRET)
        assert payload is None

    def test_decode_without_secret(self):
        token = create_token("user-123", SECRET, ttl=3600)
        payload = decode_jwt(token, "")
        assert payload is None

    def test_tokens_for_different_users_are_different(self):
        token_a = create_token("user-a", SECRET)
        token_b = create_token("user-b", SECRET)
        assert token_a != token_b

    def test_decode_returns_iat(self):
        token = create_token("user-456", SECRET, ttl=7200)
        payload = decode_jwt(token, SECRET)
        assert payload is not None
        assert "iat" in payload
        assert payload["iat"] <= int(time.time())

    def test_simplified_token_format(self):
        """Test the simplified HMAC token format."""
        import hashlib
        import hmac
        import base64

        now = int(time.time())
        user_id = "test-user"
        raw = f"{user_id}:{now}"
        sig = hmac.new(SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()[:16]
        simple_token = base64.urlsafe_b64encode(f"{raw}:{sig}".encode()).rstrip(b"=").decode()

        payload = decode_jwt(simple_token, SECRET)
        assert payload is not None
        assert payload["sub"] == user_id

    def test_simplified_token_wrong_secret(self):
        import hashlib
        import hmac
        import base64

        now = int(time.time())
        raw = f"test-user:{now}"
        sig = hmac.new(SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()[:16]
        simple_token = base64.urlsafe_b64encode(f"{raw}:{sig}".encode()).rstrip(b"=").decode()

        payload = decode_jwt(simple_token, "wrong-secret")
        assert payload is None

    def test_simplified_token_expired(self):
        import hashlib
        import hmac
        import base64

        old_time = int(time.time()) - 100000  # >24 hours ago
        raw = f"test-user:{old_time}"
        sig = hmac.new(SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()[:16]
        simple_token = base64.urlsafe_b64encode(f"{raw}:{sig}".encode()).rstrip(b"=").decode()

        payload = decode_jwt(simple_token, SECRET)
        assert payload is None  # expired
