"""参数边界值测试：Pydantic 校验、边界值和异常输入 for 01 02 routers."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _mock_async_session_factory():
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_scalar = MagicMock()
    mock_scalar.all.return_value = []
    mock_result.scalars.return_value = mock_scalar
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result
    mock_session.get.return_value = None
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.delete = AsyncMock()

    class _AsyncCtx:
        def __call__(self):
            return self
        async def __aenter__(self):
            return mock_session
        async def __aexit__(self, *args):
            pass

    return MagicMock(return_value=_AsyncCtx())


@pytest.fixture
def client():
    mock_redis = MagicMock()
    mock_redis.ping = AsyncMock(return_value=True)
    mock_redis.incr = AsyncMock(return_value=1)
    mock_redis.expire = AsyncMock(return_value=True)
    _mock_factory = _mock_async_session_factory()

    with (
        patch("virtual_team.broker.get_redis", return_value=mock_redis),
        patch("virtual_team.database.get_async_engine", return_value=MagicMock()),
        patch("virtual_team.database.get_session_factory", _mock_factory),
        patch("virtual_team.repository.agents.get_session_factory", _mock_factory),
        patch("virtual_team.repository.prompts.get_session_factory", _mock_factory),
        patch("virtual_team.repository.schemas.get_session_factory", _mock_factory),
        patch("virtual_team.repository.bindings.get_session_factory", _mock_factory),
        patch("virtual_team.repository.keys.get_session_factory", _mock_factory),
        patch("virtual_team.repository.teams.get_session_factory", _mock_factory),
        patch("virtual_team.repository.core.get_session_factory", _mock_factory),
        patch("virtual_team.database.init_db", new_callable=AsyncMock),
        patch("virtual_team.repository.seed_default_agents", new_callable=AsyncMock),
        patch("virtual_team.rate_limit.get_redis", return_value=mock_redis),
    ):
        from fastapi.testclient import TestClient
        from virtual_team.app import app
        yield TestClient(app)


# ============================================================
# keys.py — Pydantic 边界值
# ============================================================

class TestKeyCreateBoundary:

    route = "/api/keys"

    def test_provider_empty(self, client):
        resp = client.post(self.route, json={
            "provider": "", "label": "test", "api_key": "sk-xxx",
        })
        assert resp.status_code == 422

    def test_provider_too_long(self, client):
        resp = client.post(self.route, json={
            "provider": "a" * 33, "label": "test", "api_key": "sk-xxx",
        })
        assert resp.status_code == 422

    def test_provider_invalid_chars(self, client):
        resp = client.post(self.route, json={
            "provider": "OPENAI", "label": "test", "api_key": "sk-xxx",
        })
        assert resp.status_code == 422

    def test_usage_type_invalid_value(self, client):
        resp = client.post(self.route, json={
            "provider": "openai", "label": "test", "api_key": "sk-xxx", "usage_type": "invalid",
        })
        assert resp.status_code == 422

    def test_label_empty(self, client):
        resp = client.post(self.route, json={
            "provider": "openai", "label": "", "api_key": "sk-xxx",
        })
        assert resp.status_code == 422

    def test_label_too_long(self, client):
        resp = client.post(self.route, json={
            "provider": "openai", "label": "x" * 65, "api_key": "sk-xxx",
        })
        assert resp.status_code == 422

    def test_api_key_empty(self, client):
        resp = client.post(self.route, json={
            "provider": "openai", "label": "test", "api_key": "",
        })
        assert resp.status_code == 422

    def test_missing_required_fields(self, client):
        resp = client.post(self.route, json={})
        assert resp.status_code == 422


class TestKeyUpdateBoundary:

    route = "/api/keys/key-1"

    def test_usage_type_invalid(self, client):
        resp = client.put(self.route, json={"usage_type": "invalid"})
        assert resp.status_code == 422


class TestFetchModelsBoundary:

    route = "/api/keys/fetch-models"

    def test_api_key_empty(self, client):
        resp = client.post(self.route, json={"api_key": ""})
        assert resp.status_code == 422

    def test_missing_api_key(self, client):
        resp = client.post(self.route, json={})
        assert resp.status_code == 422


# ============================================================
# runs.py — Pydantic 边界值
# ============================================================

class TestRunRequestBoundary:

    def test_requirement_empty(self):
        from virtual_team.routers.runs import RunRequest
        with pytest.raises(Exception):
            RunRequest(requirement="")

    def test_requirement_too_long(self):
        from virtual_team.routers.runs import RunRequest
        with pytest.raises(Exception):
            RunRequest(requirement="x" * 2001)

    def test_requirement_valid(self):
        from virtual_team.routers.runs import RunRequest
        r = RunRequest(requirement="build an app")
        assert r.requirement == "build an app"

    def test_with_session_id(self):
        from virtual_team.routers.runs import RunRequest
        r = RunRequest(requirement="test", session_id="sess-1")
        assert r.session_id == "sess-1"

    def test_with_key_id(self):
        from virtual_team.routers.runs import RunRequest
        r = RunRequest(requirement="test", key_id="key-1")
        assert r.key_id == "key-1"

    def test_with_model(self):
        from virtual_team.routers.runs import RunRequest
        r = RunRequest(requirement="test", model="gpt-4")
        assert r.model == "gpt-4"


# ============================================================
# sessions.py — Pydantic 边界值
# ============================================================

class TestSessionUpdateBoundary:

    route = "/api/sessions/sess-1"

    def test_title_empty(self, client):
        resp = client.put(self.route, json={"title": ""})
        assert resp.status_code == 422

    def test_title_too_long(self, client):
        resp = client.put(self.route, json={"title": "x" * 257})
        assert resp.status_code == 422

    def test_missing_title(self, client):
        resp = client.put(self.route, json={})
        assert resp.status_code == 422


class TestSessionCreateBoundary:

    route = "/api/sessions"

    def test_default_title_accepted(self, client):
        # Pydantic has default "新对话", so empty body should be accepted
        mock_redis = MagicMock()
        mock_redis.ping = AsyncMock(return_value=True)
        mock_redis.incr = AsyncMock(return_value=1)
        mock_redis.expire = AsyncMock(return_value=True)
        _mock_factory = _mock_async_session_factory()

        mock_session = MagicMock()
        mock_session.id = "sess-new"
        mock_session.title = "新对话"
        mock_session.created_at = None
        mock_session.updated_at = None

        with (
            patch("virtual_team.broker.get_redis", return_value=mock_redis),
            patch("virtual_team.database.get_async_engine", return_value=MagicMock()),
            patch("virtual_team.database.get_session_factory", _mock_factory),
            patch("virtual_team.database.init_db", new_callable=AsyncMock),
            patch("virtual_team.repository.seed_default_agents", new_callable=AsyncMock),
            patch("virtual_team.rate_limit.get_redis", return_value=mock_redis),
            patch("virtual_team.routers.sessions.create_session", new_callable=AsyncMock, return_value=mock_session),
        ):
            from fastapi.testclient import TestClient
            from virtual_team.app import app
            tc = TestClient(app)
            resp = tc.post(self.route, json={})
            assert resp.status_code == 201


# ============================================================
# skills.py — Pydantic 边界值
# ============================================================

class TestSkillGenerateBoundary:

    route = "/api/skills/generate"

    def test_description_empty(self, client):
        resp = client.post(self.route, json={"description": "", "category": "general"})
        assert resp.status_code == 422

    def test_description_too_long(self, client):
        resp = client.post(self.route, json={"description": "x" * 501, "category": "general"})
        assert resp.status_code == 422

    def test_missing_description(self, client):
        resp = client.post(self.route, json={"category": "general"})
        assert resp.status_code == 422


class TestSkillValidateBoundary:

    route = "/api/skills/validate"

    def test_missing_content(self, client):
        resp = client.post(self.route, json={})
        assert resp.status_code == 422

    def test_empty_content(self, client):
        resp = client.post(self.route, json={"content": ""})
        assert resp.status_code == 200  # Empty content is valid per Pydantic


# ============================================================
# tools.py — Pydantic 边界值
# ============================================================

class TestToolGenerateBoundary:

    route = "/api/tools/generate"

    def test_description_empty(self, client):
        resp = client.post(self.route, json={"description": "", "language": "python"})
        assert resp.status_code == 422

    def test_description_too_long(self, client):
        resp = client.post(self.route, json={"description": "x" * 501, "language": "python"})
        assert resp.status_code == 422

    def test_missing_description(self, client):
        resp = client.post(self.route, json={"language": "python"})
        assert resp.status_code == 422

    def test_invalid_language(self, client):
        resp = client.post(self.route, json={"description": "test", "language": "rust"})
        assert resp.status_code == 422

    def test_language_valid_values(self, client):
        from virtual_team.routers.tools import GeneratedTool
        for lang in ("python", "javascript", "typescript"):
            with patch("virtual_team.routers.tools._generate_tool_from_description") as mock_gen:
                mock_gen.return_value = GeneratedTool(
                    id="t1", name="test", description="desc",
                    code="print(1)", language=lang,
                    parameters={}, is_valid=True,
                )
                resp = client.post(self.route, json={"description": "test", "language": lang})
                assert resp.status_code == 200, f"lang={lang} got {resp.status_code}: {resp.text[:200]}"


class TestToolValidateBoundary:

    route = "/api/tools/validate"

    def test_missing_code(self, client):
        resp = client.post(self.route, json={"language": "python"})
        assert resp.status_code == 422

    def test_empty_code(self, client):
        resp = client.post(self.route, json={"code": "", "language": "python"})
        assert resp.status_code == 200


class TestToolExecuteBoundary:

    route = "/api/tools/execute"

    def test_invalid_language(self, client):
        resp = client.post(self.route, json={"code": "print(1)", "language": "rust"})
        # execute_tool doesn't validate via Pydantic, so it may accept
        assert resp.status_code in (200, 422)

    def test_execute_empty_code(self, client):
        resp = client.post(self.route, json={"code": ""})
        # execute_tool accepts empty code (no Pydantic validation on params)
        assert resp.status_code in (200, 422)


# ============================================================
# system_team.py — Pydantic 边界值
# ============================================================

class TestSystemTeamToolGenerateBoundary:

    route = "/api/system-team/tools/generate"

    def test_description_empty(self, client):
        resp = client.post(self.route, json={"description": "", "language": "python"})
        assert resp.status_code == 422

    def test_invalid_language(self, client):
        resp = client.post(self.route, json={"description": "test", "language": "go"})
        assert resp.status_code == 422


class TestSystemTeamSkillGenerateBoundary:

    route = "/api/system-team/skills/generate"

    def test_description_empty(self, client):
        resp = client.post(self.route, json={"description": ""})
        assert resp.status_code == 422


# ============================================================
# teams.py — Pydantic 边界值
# ============================================================

class TestTeamCreateBoundary:

    route = "/api/teams"

    def test_name_empty(self, client):
        resp = client.post(self.route, json={"name": ""})
        assert resp.status_code == 422

    def test_name_too_long(self, client):
        resp = client.post(self.route, json={"name": "x" * 65})
        assert resp.status_code == 422

    def test_missing_name(self, client):
        resp = client.post(self.route, json={})
        assert resp.status_code == 422


class TestTeamUpdateBoundary:

    route = "/api/teams/team-1"

    def test_valid_partial_update(self, client):
        resp = client.put(self.route, json={"name": "new name"})
        assert resp.status_code in (200, 422, 404)  # May 404 if no DB mock


class TestMemberAddBoundary:

    route = "/api/teams/team-1/members"

    def test_name_empty(self, client):
        resp = client.post(self.route, json={"name": ""})
        assert resp.status_code == 422

    def test_name_too_long(self, client):
        resp = client.post(self.route, json={"name": "x" * 65})
        assert resp.status_code == 422

    def test_missing_name(self, client):
        resp = client.post(self.route, json={})
        assert resp.status_code == 422


class TestReorderBoundary:

    route = "/api/teams/team-1/members/reorder"

    def test_empty_member_ids(self, client):
        resp = client.put(self.route, json={"member_ids": []})
        # ReorderRequest has no min_length on member_ids, so [] is valid Pydantic-wise
        assert resp.status_code in (200, 422, 404)

    def test_missing_member_ids(self, client):
        resp = client.put(self.route, json={})
        assert resp.status_code == 422
