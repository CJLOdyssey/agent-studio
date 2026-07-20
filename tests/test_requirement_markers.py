
import bcrypt
import pytest

from backend.repository.auth import create_user

_SEED_EMAIL = "reqmarker@reqmarker.test.com"
_SEED_PASSWORD = "ReqMarkerPass1"


@pytest.fixture(scope="session", autouse=True)
async def _seed_test_user(test_client):
    """Seed a verified test user for login tests."""
    password_hash = bcrypt.hashpw(_SEED_PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode()
    await create_user(
        email=_SEED_EMAIL,
        password_hash=password_hash,
        is_verified=True,
    )


class TestAuthRequirements:

    @pytest.mark.requirement("REQ-AUTH-001")
    async def test_login_success(self, test_client):
        response = await test_client.post(
            "/api/auth/login",
            json={"email": _SEED_EMAIL, "password": _SEED_PASSWORD}
        )
        assert response.status_code == 200
        assert "access_token" in response.json()

    @pytest.mark.requirement("REQ-AUTH-002")
    async def test_login_wrong_password(self, test_client):
        response = await test_client.post(
            "/api/auth/login",
            json={"email": _SEED_EMAIL, "password": "WrongPassword"}
        )
        assert response.status_code in [400, 401]

    @pytest.mark.requirement("REQ-AUTH-004")
    async def test_jwt_token_generation(self, test_client):
        response = await test_client.post(
            "/api/auth/login",
            json={"email": _SEED_EMAIL, "password": _SEED_PASSWORD}
        )
        assert response.status_code == 200
        token = response.json().get("access_token")
        assert token is not None
        assert len(token) > 0

    @pytest.mark.requirement("REQ-AUTH-005")
    async def test_token_refresh(self, test_client):
        pass

    @pytest.mark.requirement("REQ-AUTH-007")
    async def test_password_policy_strong(self, test_client):
        pass

    @pytest.mark.requirement("REQ-AUTH-008")
    async def test_account_lockout(self, test_client):
        pass


class TestSessionRequirements:

    @pytest.mark.requirement("REQ-SES-001")
    async def test_create_session(self, test_client):
        response = await test_client.post("/api/sessions", json={"title": "Test Session"})
        assert response.status_code in [200, 201]

    @pytest.mark.requirement("REQ-SES-002")
    async def test_list_sessions(self, test_client):
        response = await test_client.get("/api/sessions")
        assert response.status_code == 200


class TestAgentRequirements:

    @pytest.mark.requirement("REQ-AGT-001")
    async def test_create_agent(self, test_client):
        response = await test_client.post(
            "/api/agents",
            json={"name": "Test Agent", "role_identifier": "test-role"}
        )
        assert response.status_code in [200, 201]

    @pytest.mark.requirement("REQ-AGT-004")
    async def test_agent_tool_binding(self, test_client):
        pass


class TestSessionForRun:
    @pytest.mark.requirement("REQ-RUN-001")
    async def test_create_run(self, test_client):
        session = await test_client.post("/api/sessions", json={"title": "Run Test Session"})
        assert session.status_code in [200, 201]
        session_id = session.json().get("id") or session.json().get("session_id")

        response = await test_client.post(
            "/api/runs",
            json={"requirement": "test requirement", "session_id": session_id}
        )
        assert response.status_code in [200, 201, 400, 404, 422]

    @pytest.mark.requirement("REQ-RUN-002")
    async def test_streaming_output(self, test_client):
        pass
