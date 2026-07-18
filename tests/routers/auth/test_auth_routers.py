"""Integration tests for auth API endpoints using in-memory SQLite and TestClient."""
import os

os.environ["AUTH_MODE"] = "legacy"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///test_auth.db"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["KEY_VAULT_SECRET"] = "0123456789abcdef0123456789abcdef"
os.environ["AUTH_ENABLED"] = "0"
os.environ["RATE_LIMIT"] = "9999"

from unittest.mock import AsyncMock, patch

import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import virtual_team.core.infra.database as db_mod

_sqlite_engine = create_async_engine("sqlite+aiosqlite:///test_auth.db")
db_mod._async_engine = _sqlite_engine
db_mod._async_session_factory = async_sessionmaker(_sqlite_engine, expire_on_commit=False)
db_mod.DATABASE_URL = "sqlite+aiosqlite:///test_auth.db"

from virtual_team.core.app import app
from virtual_team.core.base import Base


@pytest.fixture
def client():
    from virtual_team.core import app_lifespan as lifespan_mod

    async def _safe_init_db():
        engine = db_mod.get_async_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        from virtual_team.core.infra.database import RoleDB, UserDB, UserRoleDB, get_session_factory
        factory = get_session_factory()
        async with factory() as session:
            for role_data in [
                ("role-admin", "admin", {"all": True}),
                ("role-member", "member", {"read": True}),
            ]:
                existing = await session.execute(
                    select(RoleDB).where(RoleDB.name == role_data[1])
                )
                if not existing.scalar_one_or_none():
                    session.add(RoleDB(id=role_data[0], name=role_data[1], permissions=role_data[2]))
            await session.flush()

            admin_role = (
                await session.execute(select(RoleDB).where(RoleDB.name == "admin"))
            ).scalar_one_or_none()

            for user_data in [
                {"id": "admin", "email": "admin@legacy.local"},
                {"id": "admin-login", "email": "admin@test.com"},
            ]:
                existing = await session.execute(
                    select(UserDB).where(UserDB.id == user_data["id"])
                )
                if not existing.scalar_one_or_none():
                    user = UserDB(
                        id=user_data["id"],
                        username=user_data["id"],
                        email=user_data["email"],
                        password_hash=bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode(),
                        is_active=True,
                        is_verified=True,
                    )
                    session.add(user)
                    await session.flush()
                    if admin_role:
                        session.add(UserRoleDB(user_id=user.id, role_id=admin_role.id))
            await session.commit()

    lifespan_mod.init_db = _safe_init_db

    store: dict[str, str] = {}

    async def _redis_get(key: str) -> str | None:
        return store.get(key)

    async def _redis_set(key: str, value: str, *args: object, **kwargs: object) -> bool:
        store[key] = value
        return True

    async def _redis_delete(key: str) -> bool:
        store.pop(key, None)
        return True

    mock_redis = AsyncMock()
    mock_redis.incr.return_value = 1
    mock_redis.expire.return_value = True
    mock_redis.ping.return_value = True
    mock_redis.publish.return_value = 1
    mock_redis.get.side_effect = _redis_get
    mock_redis.set.side_effect = _redis_set
    mock_redis.delete.side_effect = _redis_delete

    with patch("virtual_team.core.app_lifespan.get_redis", return_value=mock_redis), \
         patch("virtual_team.broker.get_redis", return_value=mock_redis), \
         patch("virtual_team.routers.auth.login.get_redis", return_value=mock_redis), \
         patch("virtual_team.routers.auth.register.get_redis", return_value=mock_redis), \
         patch("virtual_team.routers.auth.password.get_redis", return_value=mock_redis):
        with TestClient(app) as c:
            yield c


class TestAuthLogin:
    def test_login_inactive_user(self, client):
        from sqlalchemy import update

        from virtual_team.core.infra.database import UserDB, get_session_factory
        factory = get_session_factory()
        async def _deactivate():
            async with factory() as s:
                await s.execute(update(UserDB).where(UserDB.email == "admin@test.com").values(is_active=False))
                await s.commit()
        import asyncio
        asyncio.new_event_loop().run_until_complete(_deactivate())
        resp = client.post(
            "/api/auth/login",
            json={"email": "admin@test.com", "password": "admin123"},
        )
        assert resp.status_code == 403
        async def _reactivate():
            async with factory() as s:
                await s.execute(update(UserDB).where(UserDB.email == "admin@test.com").values(is_active=True))
                await s.commit()
        asyncio.new_event_loop().run_until_complete(_reactivate())

    def test_login_valid(self, client):
        resp = client.post(
            "/api/auth/login",
            json={"email": "admin@test.com", "password": "admin123"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "admin@test.com"

    def test_login_returns_token_structure(self, client):
        resp = client.post(
            "/api/auth/login",
            json={"email": "admin@test.com", "password": "admin123"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "token_type" in data
        assert "expires_in" in data
        assert "user" in data
        assert data["access_token"] != ""
        assert data["refresh_token"] != ""
        assert len(data["access_token"].split(".")) == 3

    def test_login_wrong_password(self, client):
        resp = client.post(
            "/api/auth/login",
            json={"email": "admin@test.com", "password": "wrongpass"},
        )
        assert resp.status_code == 401

    def test_login_nonexistent(self, client):
        resp = client.post(
            "/api/auth/login",
            json={"email": "ghost@test.com", "password": "AnyPass@1"},
        )
        assert resp.status_code == 401

    def test_refresh_token_valid(self, client):
        login_resp = client.post(
            "/api/auth/login",
            json={"email": "admin@test.com", "password": "admin123"},
        )
        assert login_resp.status_code == 200
        refresh_token = login_resp.json()["refresh_token"]
        resp = client.post(
            "/api/auth/refresh", json={"refresh_token": refresh_token}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data

    def test_refresh_token_invalid(self, client):
        resp = client.post(
            "/api/auth/refresh", json={"refresh_token": "totally_invalid_token"}
        )
        assert resp.status_code == 401

    def test_refresh_token_rotation(self, client):
        login_resp = client.post(
            "/api/auth/login",
            json={"email": "admin@test.com", "password": "admin123"},
        )
        assert login_resp.status_code == 200
        first_refresh = login_resp.json()["refresh_token"]

        resp1 = client.post(
            "/api/auth/refresh", json={"refresh_token": first_refresh}
        )
        assert resp1.status_code == 200
        resp1.json()["refresh_token"]

        resp2 = client.post(
            "/api/auth/refresh", json={"refresh_token": first_refresh}
        )
        assert resp2.status_code == 401


class TestAuthRegister:
    @patch("virtual_team.routers.auth.register._generate_code", return_value="654321")
    def test_register_flow(self, mock_gen_code, client):
        resp = client.post(
            "/api/auth/send-register-code", json={"email": "newuser@test.com"}
        )
        assert resp.status_code == 200

        resp = client.post(
            "/api/auth/register",
            json={
                "email": "newuser@test.com",
                "code": "654321",
                "password": "StrongPass@1",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data

    def test_register_wrong_code(self, client):
        with patch(
            "virtual_team.routers.auth.register._generate_code", return_value="654321"
        ):
            client.post(
                "/api/auth/send-register-code",
                json={"email": "wrongcode@test.com"},
            )
        resp = client.post(
            "/api/auth/register",
            json={
                "email": "wrongcode@test.com",
                "code": "000000",
                "password": "StrongPass@1",
            },
        )
        assert resp.status_code == 400

    def test_register_weak_password(self, client):
        with patch(
            "virtual_team.routers.auth.register._generate_code", return_value="123456"
        ):
            client.post(
                "/api/auth/send-register-code",
                json={"email": "weakpass@test.com"},
            )
        resp = client.post(
            "/api/auth/register",
            json={
                "email": "weakpass@test.com",
                "code": "123456",
                "password": "12345678",
            },
        )
        assert resp.status_code == 400

    @patch("virtual_team.routers.auth.register._generate_code", return_value="654321")
    def test_register_flow_complete(self, mock_gen_code, client):
        resp = client.post(
            "/api/auth/send-register-code", json={"email": "flowtest@test.com"}
        )
        assert resp.status_code == 200

        resp = client.post(
            "/api/auth/register",
            json={
                "email": "flowtest@test.com",
                "code": "654321",
                "password": "StrongPass@1",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "flowtest@test.com"

    def test_password_policy_rejects_common(self, client):
        with patch(
            "virtual_team.routers.auth.register._generate_code", return_value="654321"
        ):
            client.post(
                "/api/auth/send-register-code",
                json={"email": "commonpass@test.com"},
            )
        resp = client.post(
            "/api/auth/register",
            json={
                "email": "commonpass@test.com",
                "code": "654321",
                "password": "password123",
            },
        )
        assert resp.status_code == 400

    def test_password_policy_rejects_short(self, client):
        with patch(
            "virtual_team.routers.auth.register._generate_code", return_value="654321"
        ):
            client.post(
                "/api/auth/send-register-code",
                json={"email": "shortpass@test.com"},
            )
        resp = client.post(
            "/api/auth/register",
            json={
                "email": "shortpass@test.com",
                "code": "654321",
                "password": "Abc1!",
            },
        )
        assert resp.status_code == 400

    def test_register_duplicate(self, client):
        with patch(
            "virtual_team.routers.auth.register._generate_code", return_value="123456"
        ):
            with patch(
                "virtual_team.routers.auth.register.get_user_by_email",
                return_value=None,
            ):
                client.post(
                    "/api/auth/send-register-code",
                    json={"email": "admin@test.com"},
                )
        resp = client.post(
            "/api/auth/register",
            json={
                "email": "admin@test.com",
                "code": "123456",
                "password": "StrongPass@1",
            },
        )
        assert resp.status_code == 409

    def test_register_password_complexity_edge(self, client):
        with patch(
            "virtual_team.routers.auth.register._generate_code", return_value="654321"
        ):
            client.post(
                "/api/auth/send-register-code",
                json={"email": "edgepass@test.com"},
            )
        resp = client.post(
            "/api/auth/register",
            json={
                "email": "edgepass@test.com",
                "code": "654321",
                "password": "Ab1!xyzw",
            },
        )
        assert resp.status_code == 201


class TestAuthPassword:
    def test_forgot_password(self, client):
        resp = client.post(
            "/api/auth/forgot-password", json={"email": "admin@test.com"}
        )
        assert resp.status_code == 200

    @patch(
        "virtual_team.routers.auth.password._generate_code", return_value="999999"
    )
    def test_reset_password(self, mock_gen_code, client):
        client.post(
            "/api/auth/forgot-password", json={"email": "admin@test.com"}
        )
        resp = client.post(
            "/api/auth/reset-password",
            json={
                "email": "admin@test.com",
                "code": "999999",
                "new_password": "NewStr0ng@Pass",
            },
        )
        assert resp.status_code == 200

    def test_reset_wrong_code(self, client):
        with patch(
            "virtual_team.routers.auth.password._generate_code", return_value="111111"
        ):
            client.post(
                "/api/auth/forgot-password", json={"email": "admin@test.com"}
            )
        resp = client.post(
            "/api/auth/reset-password",
            json={
                "email": "admin@test.com",
                "code": "999999",
                "new_password": "NewStr0ng@Pass",
            },
        )
        assert resp.status_code == 400

    def test_change_password(self, client):
        resp = client.post(
            "/api/auth/change-password",
            json={
                "old_password": "admin123",
                "new_password": "NewStr0ng@Pass",
            },
        )
        assert resp.status_code == 200

    def test_forgot_password_nonexistent_email(self, client):
        resp = client.post(
            "/api/auth/forgot-password", json={"email": "doesnotexist@test.com"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data

    def test_reset_password_expired_code(self, client):
        resp = client.post(
            "/api/auth/reset-password",
            json={
                "email": "ghost@test.com",
                "code": "000000",
                "new_password": "NewStr0ng@Pass",
            },
        )
        assert resp.status_code == 400


class TestAuthProfile:
    def test_get_profile(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "admin@legacy.local"
        assert data["is_verified"] is True

    def test_profile_returns_admin_in_legacy(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] is not None
        assert data["email"] is not None
        assert isinstance(data["roles"], list)
        assert "admin" in data["roles"]
        assert data["is_verified"] is True


class TestAuthForgotPasswordFlow:

    @patch("virtual_team.routers.auth.register._generate_code", return_value="112233")
    @patch("virtual_team.routers.auth.password._generate_code", return_value="445566")
    def test_forgot_password_full_flow(self, mock_pwd_code, mock_reg_code, client):
        client.post(
            "/api/auth/send-register-code", json={"email": "fpflow@test.com"}
        )
        reg_resp = client.post(
            "/api/auth/register",
            json={
                "email": "fpflow@test.com",
                "code": "112233",
                "password": "StrongPass@1",
            },
        )
        assert reg_resp.status_code == 201

        forgot_resp = client.post(
            "/api/auth/forgot-password", json={"email": "fpflow@test.com"}
        )
        assert forgot_resp.status_code == 200

        reset_resp = client.post(
            "/api/auth/reset-password",
            json={
                "email": "fpflow@test.com",
                "code": "445566",
                "new_password": "NewStr0ng@Pass",
            },
        )
        assert reset_resp.status_code == 200
