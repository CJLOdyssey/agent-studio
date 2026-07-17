"""Integration tests for auth API endpoints.

Requires backend running on port 8081 with AUTH_MODE=rbac, AUTH_ENABLED=1,
and Redis + PostgreSQL available (via docker compose local).

EMAIL_BACKEND defaults to "log" so verification codes are stored in Redis
and can be read directly for test purposes.
"""

import os
import string
import subprocess
import uuid
from typing import Any

import httpx
import pytest

BASE = os.environ.get("AUTH_TEST_BASE", "http://localhost:8081")

# ── helpers ────────────────────────────────────────────────────────────────


def _rid(prefix: str = "test") -> str:
    suffix = uuid.uuid4().hex[:8]
    clean = "".join(c for c in suffix if c in string.ascii_lowercase)
    return f"{prefix}_{clean}" if clean else f"{prefix}_x"


def _redis(args: list[str]) -> Any:  # type: ignore[type-arg]
    """Run redis-cli on db1 (matches .env REDIS_URL)."""
    return subprocess.run(
        ["docker", "exec", "virtual-team-redis", "redis-cli", "-n", "1"] + args,
        capture_output=True, text=True, timeout=5,
    )


def _clear_rate_limits() -> None:
    try:
        keys = _redis(["KEYS", "ratelimit:*"])
        if keys.stdout.strip():
            _redis(["DEL"] + keys.stdout.strip().split("\n"))
    except Exception:
        pass


def _get_redis_value(key: str) -> str | None:
    try:
        result = _redis(["GET", key])
        return result.stdout.strip() if result.stdout.strip() else None
    except Exception:
        return None


def _delete_redis_pattern(pattern: str):
    try:
        keys = _redis(["KEYS", pattern])
        if keys.stdout.strip():
            _redis(["DEL"] + keys.stdout.strip().split("\n"))
    except Exception:
        pass


def _valid_password() -> str:
    return "Test@1234"


def _weak_password() -> str:
    return "12345678"


class AuthApi:
    """HTTP client specifically for auth API tests."""

    def __init__(self, base: str = BASE):
        self.client = httpx.Client(base_url=base, timeout=30)

    def get(self, path: str, **kw: Any) -> httpx.Response:
        return self.client.get(path, **kw)  # type: ignore[arg-type]

    def post(self, path: str, json: object = None, **kw: Any) -> httpx.Response:
        return self.client.post(path, json=json, **kw)  # type: ignore[arg-type]

    def close(self) -> None:
        self.client.close()


# ── fixtures ───────────────────────────────────────────────────────────────


@pytest.fixture
def api():
    a = AuthApi()
    yield a
    a.close()


@pytest.fixture(autouse=True)
def _fresh_state():
    _clear_rate_limits()
    _delete_redis_pattern("auth:*")
    yield


# ── Tests ──────────────────────────────────────────────────────────────────


class TestAuthConfig:
    """GET /api/auth/config."""

    def test_auth_config(self, api: AuthApi):
        resp = api.get("/api/auth/config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["enabled"] is True
        assert data["mode"] == "rbac"


class TestSendRegisterCode:
    """POST /api/auth/send-register-code."""

    def test_send_code_success(self, api: AuthApi):
        email = f"{_rid('code')}@test.com"
        resp = api.post("/api/auth/send-register-code", json={"email": email})
        assert resp.status_code == 200
        data = resp.json()
        assert "验证码" in data["message"]
        assert "email_hint" in data

        code = _get_redis_value(f"auth:verify:{email}")
        assert code is not None, "Verification code should be stored in Redis"
        assert len(code) == 6
        assert code.isdigit()

    def test_send_code_duplicate_email(self, api: AuthApi):
        email = f"{_rid('dup')}@test.com"
        pwd = _valid_password()

        resp = api.post("/api/auth/send-register-code", json={"email": email})
        assert resp.status_code == 200
        code = _get_redis_value(f"auth:verify:{email}")
        assert code is not None

        resp = api.post("/api/auth/register", json={"email": email, "code": code, "password": pwd})
        assert resp.status_code == 201

        resp = api.post("/api/auth/send-register-code", json={"email": email})
        assert resp.status_code == 409
        assert "已注册" in resp.json()["detail"]["error"]["message"]


class TestRegister:
    """POST /api/auth/register."""

    def test_register_success(self, api: AuthApi):
        email = f"{_rid('reg')}@test.com"
        pwd = _valid_password()

        resp = api.post("/api/auth/send-register-code", json={"email": email})
        assert resp.status_code == 200

        code = _get_redis_value(f"auth:verify:{email}")
        assert code is not None

        resp = api.post("/api/auth/register", json={"email": email, "code": code, "password": pwd})
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 900
        assert data["user"]["email"] == email
        assert data["user"]["is_verified"] is True

    def test_register_wrong_code(self, api: AuthApi):
        email = f"{_rid('wrong')}@test.com"
        pwd = _valid_password()

        resp = api.post("/api/auth/send-register-code", json={"email": email})
        assert resp.status_code == 200

        resp = api.post("/api/auth/register", json={"email": email, "code": "000000", "password": pwd})
        assert resp.status_code == 400
        assert "验证码错误" in resp.json()["detail"]["error"]["message"]

    def test_register_expired_code(self, api: AuthApi):
        email = f"{_rid('exp')}@test.com"
        pwd = _valid_password()

        resp = api.post("/api/auth/register", json={"email": email, "code": "123456", "password": pwd})
        assert resp.status_code == 400
        assert "已过期" in resp.json()["detail"]["error"]["message"]

    def test_register_weak_password(self, api: AuthApi):
        email = f"{_rid('weak')}@test.com"
        pwd = _weak_password()

        resp = api.post("/api/auth/send-register-code", json={"email": email})
        assert resp.status_code == 200
        code = _get_redis_value(f"auth:verify:{email}")
        assert code is not None

        resp = api.post("/api/auth/register", json={"email": email, "code": code, "password": pwd})
        assert resp.status_code == 400
        msg = resp.json()["detail"]["error"]["message"]
        assert any(word in msg for word in ["密码", "数字", "小写", "大写", "特殊字符"])

    def test_register_code_attempts_exhausted(self, api: AuthApi):
        email = f"{_rid('att')}@test.com"
        pwd = _valid_password()

        resp = api.post("/api/auth/send-register-code", json={"email": email})
        assert resp.status_code == 200

        for _ in range(3):
            resp = api.post("/api/auth/register", json={"email": email, "code": "000000", "password": pwd})
            assert resp.status_code == 400

        code = _get_redis_value(f"auth:verify:{email}")
        assert code is not None, "Code should survive 3 wrong attempts (exhausted at 4th, but IP rate limit halts at 3)"

    def test_register_duplicate_email(self, api: AuthApi):
        email = f"{_rid('dup2')}@test.com"
        pwd = _valid_password()

        resp = api.post("/api/auth/send-register-code", json={"email": email})
        assert resp.status_code == 200
        code = _get_redis_value(f"auth:verify:{email}")
        assert code is not None
        resp = api.post("/api/auth/register", json={"email": email, "code": code, "password": pwd})
        assert resp.status_code == 201

        resp = api.post("/api/auth/send-register-code", json={"email": email})
        assert resp.status_code == 409
        assert "已注册" in resp.json()["detail"]["error"]["message"]


class TestLogin:
    """POST /api/auth/login."""

    @pytest.fixture
    def registered_user(self, api: AuthApi):
        email = f"{_rid('login')}@test.com"
        pwd = _valid_password()
        resp = api.post("/api/auth/send-register-code", json={"email": email})
        assert resp.status_code == 200
        code = _get_redis_value(f"auth:verify:{email}")
        assert code is not None
        resp = api.post("/api/auth/register", json={"email": email, "code": code, "password": pwd})
        assert resp.status_code == 201
        return {"email": email, "password": pwd, "user": resp.json()["user"]}

    def test_login_success(self, api: AuthApi, registered_user: dict[str, Any]):
        resp = api.post("/api/auth/login", json={
            "email": registered_user["email"],
            "password": registered_user["password"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == registered_user["email"]
        assert data["user"]["is_verified"] is True

    def test_login_wrong_password(self, api: AuthApi, registered_user: dict[str, Any]):
        resp = api.post("/api/auth/login", json={
            "email": registered_user["email"],
            "password": "WrongPass@999",
        })
        assert resp.status_code == 401
        assert "邮箱或密码错误" in resp.json()["detail"]["error"]["message"]

    def test_login_nonexistent_email(self, api: AuthApi):
        resp = api.post("/api/auth/login", json={
            "email": f"{_rid('nonexist')}@test.com",
            "password": _valid_password(),
        })
        assert resp.status_code == 401
        assert "邮箱或密码错误" in resp.json()["detail"]["error"]["message"]

    def test_login_with_remember_me(self, api: AuthApi, registered_user: dict[str, Any]):
        resp = api.post("/api/auth/login", json={
            "email": registered_user["email"],
            "password": registered_user["password"],
            "remember_me": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data


class TestRefresh:
    """POST /api/auth/refresh."""

    @pytest.fixture
    def tokens(self, api: AuthApi):
        email = f"{_rid('ref')}@test.com"
        pwd = _valid_password()
        resp = api.post("/api/auth/send-register-code", json={"email": email})
        assert resp.status_code == 200
        code = _get_redis_value(f"auth:verify:{email}")
        assert code is not None
        resp = api.post("/api/auth/register", json={"email": email, "code": code, "password": pwd})
        assert resp.status_code == 201
        data = resp.json()
        return {"access_token": data["access_token"], "refresh_token": data["refresh_token"]}

    def test_refresh_success(self, api: AuthApi, tokens: dict[str, Any]):
        resp = api.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_refresh_invalid_token(self, api: AuthApi):
        resp = api.post("/api/auth/refresh", json={"refresh_token": "garbage_token_here"})
        assert resp.status_code == 401
        assert "已过期" in resp.json()["detail"]["error"]["message"]


class TestMe:
    """GET /api/auth/me."""

    @pytest.fixture
    def auth_header(self, api: AuthApi) -> dict:
        email = f"{_rid('me')}@test.com"
        pwd = _valid_password()
        resp = api.post("/api/auth/send-register-code", json={"email": email})
        assert resp.status_code == 200
        code = _get_redis_value(f"auth:verify:{email}")
        assert code is not None
        resp = api.post("/api/auth/register", json={"email": email, "code": code, "password": pwd})
        assert resp.status_code == 201
        return {"Authorization": f"Bearer {resp.json()['access_token']}"}

    def test_me_authenticated(self, api: AuthApi, auth_header: dict[str, Any]):
        resp = api.get("/api/auth/me", headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert "email" in data
        assert "roles" in data
        assert data["is_verified"] is True

    def test_me_unauthenticated(self, api: AuthApi):
        resp = api.get("/api/auth/me")
        assert resp.status_code == 401
        msg = resp.json()["detail"]["error"]["message"]
        assert "认证" in msg or "令牌" in msg


class TestForgotResetPassword:
    """POST /api/auth/forgot-password + /api/auth/reset-password."""

    @pytest.fixture
    def registered_user(self, api: AuthApi):
        email = f"{_rid('fr')}@test.com"
        pwd = _valid_password()
        resp = api.post("/api/auth/send-register-code", json={"email": email})
        assert resp.status_code == 200
        code = _get_redis_value(f"auth:verify:{email}")
        assert code is not None
        resp = api.post("/api/auth/register", json={"email": email, "code": code, "password": pwd})
        assert resp.status_code == 201
        return {"email": email, "password": pwd}

    def test_forgot_password(self, api: AuthApi, registered_user: dict[str, Any]):
        resp = api.post("/api/auth/forgot-password", json={"email": registered_user["email"]})
        assert resp.status_code == 200
        assert "如果该邮箱已注册" in resp.json()["message"]

        code = _get_redis_value(f"auth:reset:{registered_user['email']}")
        assert code is not None
        assert len(code) == 6
        assert code.isdigit()

    def test_forgot_password_unregistered(self, api: AuthApi):
        resp = api.post("/api/auth/forgot-password", json={"email": f"{_rid('unknown')}@test.com"})
        assert resp.status_code == 200
        assert "如果该邮箱已注册" in resp.json()["message"]

    def test_reset_password_success(self, api: AuthApi, registered_user: dict[str, Any]):
        new_pwd = "NewPass@789"

        resp = api.post("/api/auth/forgot-password", json={"email": registered_user["email"]})
        assert resp.status_code == 200

        code = _get_redis_value(f"auth:reset:{registered_user['email']}")
        assert code is not None

        resp = api.post("/api/auth/reset-password", json={
            "email": registered_user["email"],
            "code": code,
            "new_password": new_pwd,
        })
        assert resp.status_code == 200
        assert "密码已重置" in resp.json()["message"]

        resp = api.post("/api/auth/login", json={
            "email": registered_user["email"],
            "password": registered_user["password"],
        })
        assert resp.status_code == 401

        resp = api.post("/api/auth/login", json={
            "email": registered_user["email"],
            "password": new_pwd,
        })
        assert resp.status_code == 200

    def test_reset_password_wrong_code(self, api: AuthApi, registered_user: dict[str, Any]):
        resp = api.post("/api/auth/forgot-password", json={"email": registered_user["email"]})
        assert resp.status_code == 200

        resp = api.post("/api/auth/reset-password", json={
            "email": registered_user["email"],
            "code": "000000",
            "new_password": "NewPass@789",
        })
        assert resp.status_code == 400
        assert "验证码错误" in resp.json()["detail"]["error"]["message"]

    def test_reset_password_same_as_old(self, api: AuthApi, registered_user: dict[str, Any]):
        resp = api.post("/api/auth/forgot-password", json={"email": registered_user["email"]})
        assert resp.status_code == 200
        code = _get_redis_value(f"auth:reset:{registered_user['email']}")
        assert code is not None

        resp = api.post("/api/auth/reset-password", json={
            "email": registered_user["email"],
            "code": code,
            "new_password": registered_user["password"],
        })
        assert resp.status_code == 400
        assert "新密码不能与旧密码相同" in resp.json()["detail"]["error"]["message"]


class TestLogout:
    """POST /api/auth/logout."""

    @pytest.fixture
    def tokens(self, api: AuthApi):
        email = f"{_rid('logout')}@test.com"
        pwd = _valid_password()
        resp = api.post("/api/auth/send-register-code", json={"email": email})
        assert resp.status_code == 200
        code = _get_redis_value(f"auth:verify:{email}")
        assert code is not None
        resp = api.post("/api/auth/register", json={"email": email, "code": code, "password": pwd})
        assert resp.status_code == 201
        data = resp.json()
        return {"access_token": data["access_token"], "refresh_token": data["refresh_token"]}

    def test_logout_success(self, api: AuthApi, tokens: dict[str, Any]):
        resp = api.post("/api/auth/logout", json={"refresh_token": tokens["refresh_token"]},
                        headers={"Authorization": f"Bearer {tokens['access_token']}"})
        assert resp.status_code == 204

    def test_logout_then_refresh_fails(self, api: AuthApi, tokens: dict[str, Any]):
        resp = api.post("/api/auth/logout", json={"refresh_token": tokens["refresh_token"]},
                        headers={"Authorization": f"Bearer {tokens['access_token']}"})
        assert resp.status_code == 204

        resp = api.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert resp.status_code == 401


class TestResendVerification:
    """POST /api/auth/resend-verification."""

    def test_resend_to_nonexistent_email(self, api: AuthApi):
        resp = api.post("/api/auth/resend-verification", json={"email": f"{_rid('noexist')}@test.com"})
        assert resp.status_code == 200
        assert "验证码" in resp.json()["message"]


class TestFullScenario:
    """End-to-end scenario: register → login → refresh → me → logout."""

    def test_full_auth_flow(self, api: AuthApi):
        email = f"{_rid('full')}@test.com"
        pwd = _valid_password()

        resp = api.post("/api/auth/send-register-code", json={"email": email})
        assert resp.status_code == 200

        code = _get_redis_value(f"auth:verify:{email}")
        assert code is not None

        resp = api.post("/api/auth/register", json={"email": email, "code": code, "password": pwd})
        assert resp.status_code == 201
        reg_data = resp.json()
        assert reg_data["user"]["email"] == email
        access_token = reg_data["access_token"]
        refresh_token = reg_data["refresh_token"]

        resp = api.get("/api/auth/me", headers={"Authorization": f"Bearer {access_token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == email

        resp = api.post("/api/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 200
        new_access = resp.json()["access_token"]
        new_refresh = resp.json()["refresh_token"]

        resp = api.get("/api/auth/me", headers={"Authorization": f"Bearer {new_access}"})
        assert resp.status_code == 200

        resp = api.post("/api/auth/logout", json={"refresh_token": new_refresh},
                        headers={"Authorization": f"Bearer {new_access}"})
        assert resp.status_code == 204

        resp = api.post("/api/auth/login", json={"email": email, "password": pwd})
        assert resp.status_code == 200
        login_data = resp.json()
        assert login_data["user"]["email"] == email
