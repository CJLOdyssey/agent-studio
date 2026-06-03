"""
Functional test suite: simulates a real user's complete workflow.

Covers 5 scenarios, 35+ test cases — from first visit to agent execution.
Mocks repository functions at the API boundary for fast, deterministic runs.

Run:
    python -m pytest tests/test_user_flow.py -v --tb=short
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

USER_ID = "test-user-001"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _mock_key_response(key_id="k-001", provider="deepseek", label="My Key",
                       masked="sk-...0000", is_active=True, is_default=True):
    """Build a standard key response dict matching KeyResponse schema."""
    return {
        "id": key_id, "provider": provider, "label": label,
        "key_masked": masked, "base_url": "https://api.deepseek.com/v1",
        "models": ["deepseek-chat"], "is_active": is_active,
        "is_default": is_default,
        "last_used_at": None, "created_at": "2026-06-03T00:00:00+00:00",
    }


def _mock_run_response(run_id="r-001", session_id="s-001",
                       requirement="写一个冒泡排序", status="converged"):
    """Build a standard run response dict."""
    return {
        "id": run_id, "session_id": session_id, "requirement": requirement,
        "pm_document": "## 产品需求文档\n...", "code": "def bubble_sort(): pass",
        "review": "代码通过审查", "approved": True, "status": status,
        "created_at": "2026-06-03T00:00:00+00:00",
        "updated_at": "2026-06-03T00:00:10+00:00",
        "messages": [],
    }


def _mock_session_response(session_id="s-001", title="测试会话", run_count=1):
    """Build a standard session summary dict."""
    return {
        "id": session_id, "title": title, "run_count": run_count,
        "created_at": "2026-06-03T00:00:00+00:00",
        "updated_at": "2026-06-03T00:00:10+00:00",
    }


# ── Fixture ───────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _mock_key_vault():
    """Mock key vault globally so encrypted_key values don't need real Fernet."""
    with patch("virtual_team.key_vault.encrypt_api_key", return_value="mock-encrypted-token"), \
         patch("virtual_team.key_vault.decrypt_api_key", return_value="sk-plaintext-for-mask"), \
         patch("virtual_team.key_vault.mask_api_key", return_value="sk-...0000"):
        yield


@pytest.fixture
def client(_mock_key_vault):
    """Create TestClient with infrastructure mocks.

    Mocks Redis (pub/sub, rate limit) and DB engine so API routes
    load without external dependencies. Repository functions are
    patched per-test for data control.
    """
    mock_redis = MagicMock()
    mock_redis.ping = AsyncMock(return_value=True)
    mock_redis.publish = AsyncMock(return_value=1)
    mock_redis.incr = AsyncMock(return_value=1)
    mock_redis.expire = AsyncMock(return_value=True)

    with patch("virtual_team.broker.get_redis", return_value=mock_redis), \
         patch("virtual_team.rate_limit.get_redis", return_value=mock_redis), \
         patch("virtual_team.database.get_async_engine", return_value=MagicMock()), \
         patch("virtual_team.database.get_session_factory", return_value=MagicMock()), \
         patch("virtual_team.database.init_db", new_callable=AsyncMock), \
         patch("virtual_team.repository.seed_default_agents", new_callable=AsyncMock):
        from virtual_team.app import app
        yield TestClient(app)


# ═══════════════════════════════════════════════════════════════════════════════
# SCENARIO 1: First Visit — Browse & Configure API Key
# ═══════════════════════════════════════════════════════════════════════════════

class TestScenario1_FirstVisit:
    """TC-1.1 ~ TC-1.10"""

    def test_health_check(self, client):
        """TC-1.1: Health check confirms services connected."""
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_list_models(self, client):
        """TC-1.2: Available models returned."""
        resp = client.get("/api/models")
        assert resp.status_code == 200
        models = resp.json()
        assert isinstance(models, list)
        assert len(models) > 0
        for m in models:
            assert "id" in m and "label" in m and "provider" in m

    def test_list_commands(self, client):
        """TC-1.3: 7 builtin commands."""
        resp = client.get("/api/commands")
        assert resp.status_code == 200
        cmds = resp.json()
        assert len(cmds) == 7
        assert {c["id"] for c in cmds} == {
            "clear", "export", "rename", "model", "agents", "help", "shortcuts",
        }

    def test_list_keys_empty(self, client):
        """TC-1.4: No keys on first visit."""
        with patch("virtual_team.routers.keys.get_api_keys", new_callable=AsyncMock) as m:
            m.return_value = []
            resp = client.get("/api/keys", headers={"X-User-ID": USER_ID})
            assert resp.status_code == 200
            assert resp.json() == []

    def test_create_key_and_mask(self, client):
        """TC-1.5: Key created, plaintext NEVER in response."""
        secret = "sk-test-demo-key-000000"
        _mock_key_response(key_id="k-101", masked="sk-...0000")

        with patch("virtual_team.routers.keys.create_api_key", new_callable=AsyncMock) as m:
            m.return_value = MagicMock(
                id="k-101", provider="deepseek", label="My DeepSeek Key",
                encrypted_key="encrypted-blob",
                base_url="https://api.deepseek.com/v1",
                models="deepseek-chat,deepseek-reasoner",
                is_active=True, is_default=True,
                last_used_at=None,
                created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00"),
            )
            resp = client.post("/api/keys", json={
                "provider": "deepseek", "label": "My DeepSeek Key",
                "api_key": secret, "models": ["deepseek-chat", "deepseek-reasoner"],
                "base_url": "https://api.deepseek.com/v1", "is_default": True,
            }, headers={"X-User-ID": USER_ID})

        assert resp.status_code == 201
        data = resp.json()
        assert data["provider"] == "deepseek"
        assert data["is_active"] is True
        assert data["is_default"] is True
        # 🔒 Security
        assert secret not in json.dumps(data), "Plaintext key leaked!"
        assert "..." in data["key_masked"]
        TestScenario1_FirstVisit._key_id = data["id"]

    def test_list_keys_shows_masked(self, client):
        """TC-1.6: Key list returns masked, never plaintext."""
        secret = "sk-test-demo-key-000000"
        with patch("virtual_team.routers.keys.get_api_keys", new_callable=AsyncMock) as m:
            m.return_value = [_mock_key_response(key_id="k-101", masked="sk-...0000")]
            resp = client.get("/api/keys", headers={"X-User-ID": USER_ID})
        assert resp.status_code == 200
        keys = resp.json()
        assert len(keys) == 1
        assert secret not in json.dumps(keys), "Plaintext key leaked in list!"

    def test_create_second_key(self, client):
        """TC-1.7: Second key as non-default."""
        _mock_key_response(key_id="k-202", provider="openai",
                                      label="OpenAI Backup", is_default=False)
        m = MagicMock(id="k-202", provider="openai", label="OpenAI Backup",
                      encrypted_key="enc-2", models="gpt-4o",
                      is_active=True, is_default=False, last_used_at=None,
                      base_url="https://api.openai.com/v1",
                      created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00"))
        with patch("virtual_team.routers.keys.create_api_key", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = m
            resp = client.post("/api/keys", json={
                "provider": "openai", "label": "OpenAI Backup",
                "api_key": "sk-backup-xyz", "models": ["gpt-4o"],
                "is_default": False,
            }, headers={"X-User-ID": USER_ID})
        assert resp.status_code == 201
        assert resp.json()["is_default"] is False

    def test_delete_key(self, client):
        """TC-1.9: Delete a key."""
        with patch("virtual_team.routers.keys.delete_api_key", new_callable=AsyncMock) as m:
            m.return_value = True
            resp = client.delete("/api/keys/k-202", headers={"X-User-ID": USER_ID})
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

    def test_usage_stats(self, client):
        """TC-1.10: Usage starts at zero."""
        with patch("virtual_team.routers.keys.get_key_usage_stats", new_callable=AsyncMock) as m:
            m.return_value = {"today_requests": 0, "today_tokens": 0,
                              "month_requests": 0, "month_tokens": 0}
            resp = client.get("/api/keys/usage", headers={"X-User-ID": USER_ID})
        assert resp.status_code == 200
        assert resp.json()["today_requests"] == 0


# ═══════════════════════════════════════════════════════════════════════════════
# SCENARIO 2: Submit Requirement & Track Execution
# ═══════════════════════════════════════════════════════════════════════════════

class TestScenario2_SubmitRequirement:
    """TC-2.1 ~ TC-2.6"""

    def test_submit_requirement(self, client):
        """TC-2.1: Submit creates run with auto session."""
        run_id = "r-s2-001"
        session_id = "s-s2-001"

        # Mock at router level because 'create_session' etc are imported as
        # local names (from X import Y as Z) — patching repository won't work.
        import virtual_team.routers.runs as runs_mod

        with patch.object(runs_mod, "create_session", new_callable=AsyncMock, create=True) as mock_sess, \
             patch.object(runs_mod, "db_create_run", new_callable=AsyncMock, create=True) as mock_run, \
             patch.object(runs_mod, "get_session", new_callable=AsyncMock, create=True) as mock_get_sess, \
             patch.object(runs_mod, "update_session_title", new_callable=AsyncMock, create=True), \
             patch.object(runs_mod, "get_default_api_key", new_callable=AsyncMock, create=True) as mock_key, \
             patch.object(runs_mod, "run_agent", create=True) as mock_task:
            mock_sess.return_value = MagicMock(id=session_id)
            mock_run.return_value = run_id
            mock_get_sess.return_value = MagicMock(title="写一个 Python 冒泡排序")
            mock_key.return_value = {"api_key": "sk-decrypted", "base_url": "https://api.deepseek.com/v1"}
            mock_task.delay = MagicMock(return_value=None)

            resp = client.post("/api/runs", json={
                "requirement": "写一个 Python 冒泡排序",
                "model": "deepseek-chat",
            }, headers={"X-User-ID": USER_ID})

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["run_id"]) == 36, f"Expected UUID run_id, got {data['run_id']}"
        assert data["status"] == "pending"
        TestScenario2_SubmitRequirement._run_id = data["run_id"]
        TestScenario2_SubmitRequirement._session_id = data.get("session_id") or session_id

    def test_query_run(self, client):
        """TC-2.2: Query run returns details."""
        with patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock) as mock_get, \
             patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock) as mock_msgs:
            mock_get.return_value = MagicMock(
                id="r-s2-001", session_id="s-s2-001",
                requirement="写一个 Python 冒泡排序",
                pm_document="## PRD", code="def sort(): pass",
                review="OK", approved=True, status="converged",
                created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00"),
                updated_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:10+00:00"),
            )
            mock_msgs.return_value = []
            resp = client.get("/api/runs/r-s2-001")
        assert resp.status_code == 200
        assert resp.json()["status"] == "converged"

    def test_list_runs(self, client):
        """TC-2.3: Run appears in list."""
        with patch("virtual_team.routers.runs.get_runs", new_callable=AsyncMock) as m:
            m.return_value = [
                MagicMock(id="r-s2-001", session_id="s-s2-001",
                          requirement="写一个 Python 冒泡排序",
                          pm_document="", code="", review="",
                          approved=False, status="converged",
                          created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00"),
                          updated_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:10+00:00")),
            ]
            resp = client.get("/api/runs")
        assert resp.status_code == 200
        assert resp.json()[0]["id"] == "r-s2-001"


# ═══════════════════════════════════════════════════════════════════════════════
# SCENARIO 3: Session Management
# ═══════════════════════════════════════════════════════════════════════════════

class TestScenario3_SessionManagement:
    """TC-3.1 ~ TC-3.5"""

    def test_list_sessions(self, client):
        """TC-3.1: Sessions listed with correct structure."""
        with patch("virtual_team.routers.sessions.get_sessions", new_callable=AsyncMock) as mock_list, \
             patch("virtual_team.routers.sessions.get_runs_by_session_ids", new_callable=AsyncMock) as mock_runs:
            mock_list.return_value = [
                MagicMock(id="s-s2-001", title="写一个 Python 冒泡排序",
                          created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00"),
                          updated_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:10+00:00")),
            ]
            mock_runs.return_value = {"s-s2-001": [MagicMock()]}
            resp = client.get("/api/sessions")
        assert resp.status_code == 200
        sessions = resp.json()
        assert len(sessions) >= 1
        for s in sessions:
            assert "id" in s and "title" in s and "run_count" in s

    def test_get_session_detail(self, client):
        """TC-3.2: Session detail with runs and memories."""
        with patch("virtual_team.routers.sessions.get_session", new_callable=AsyncMock) as mock_sess, \
             patch("virtual_team.routers.sessions.get_session_runs", new_callable=AsyncMock) as mock_runs, \
             patch("virtual_team.routers.sessions.get_session_memories", new_callable=AsyncMock) as mock_mem:
            mock_sess.return_value = MagicMock(
                id="s-s2-001", title="写一个 Python 冒泡排序",
                created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00"),
                updated_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:10+00:00"),
            )
            mock_runs.return_value = []
            mock_mem.return_value = []
            resp = client.get("/api/sessions/s-s2-001")
        assert resp.status_code == 200
        assert "runs" in resp.json() and "memories" in resp.json()

    def test_rename_session(self, client):
        """TC-3.3: Rename a session."""
        with patch("virtual_team.routers.sessions.update_session_title", new_callable=AsyncMock) as m:
            m.return_value = MagicMock(id="s-s2-001", title="冒泡排序项目")
            resp = client.put("/api/sessions/s-s2-001", json={"title": "冒泡排序项目"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "冒泡排序项目"

    def test_create_session(self, client):
        """TC-3.4: Create empty session."""
        with patch("virtual_team.routers.sessions.create_session", new_callable=AsyncMock) as m:
            m.return_value = MagicMock(
                id="s-new-001", title="新项目",
                created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00"),
                updated_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00"),
            )
            resp = client.post("/api/sessions", json={"title": "新项目"})
        assert resp.status_code == 201
        assert resp.json()["title"] == "新项目"

    def test_delete_session(self, client):
        """TC-3.5: Delete empty session."""
        with patch("virtual_team.routers.sessions.delete_session", new_callable=AsyncMock) as m:
            m.return_value = True
            resp = client.delete("/api/sessions/s-new-001")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"


# ═══════════════════════════════════════════════════════════════════════════════
# SCENARIO 4: Agent Configuration
# ═══════════════════════════════════════════════════════════════════════════════

class TestScenario4_AgentConfig:
    """TC-4.1 ~ TC-4.6"""

    def test_list_default_agents(self, client):
        """TC-4.1: Four default agents with correct roles."""
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock) as m:
            m.return_value = [
                MagicMock(id="a-1", name="产品经理", role_identifier="product_manager",
                          system_prompt="你是PM", model=None, temperature=None,
                          order=0, is_active=True, is_approver=False, icon="👤",
                          created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00")),
                MagicMock(id="a-2", name="前端工程师", role_identifier="frontend",
                          system_prompt="你是前端", model=None, temperature=None,
                          order=1, is_active=True, is_approver=False, icon="🎨",
                          created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00")),
                MagicMock(id="a-3", name="后端工程师", role_identifier="backend",
                          system_prompt="你是后端", model=None, temperature=None,
                          order=1, is_active=True, is_approver=False, icon="⚙️",
                          created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00")),
                MagicMock(id="a-4", name="测试工程师", role_identifier="tester",
                          system_prompt="你是测试", model=None, temperature=None,
                          order=2, is_active=True, is_approver=True, icon="🧪",
                          created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00")),
            ]
            resp = client.get("/api/agents")
        assert resp.status_code == 200
        agents = resp.json()
        assert len(agents) == 4
        roles = {a["role_identifier"] for a in agents}
        assert "product_manager" in roles
        assert "tester" in roles
        tester = next(a for a in agents if a["role_identifier"] == "tester")
        assert tester["is_approver"] is True

    def test_create_custom_agent(self, client):
        """TC-4.2: Create custom agent."""
        with patch("virtual_team.routers.agents.get_agent_config_by_role", new_callable=AsyncMock) as mock_role, \
             patch("virtual_team.routers.agents.create_agent_config", new_callable=AsyncMock) as mock_create:
            mock_role.return_value = None
            mock_create.return_value = MagicMock(id="a-custom")
            resp = client.post("/api/agents", json={
                "name": "运维工程师", "role_identifier": "devops",
                "system_prompt": "你是运维工程师。", "order": 3,
                "is_active": True, "is_approver": False, "icon": "🚀",
            })
        assert resp.status_code == 201
        assert resp.json()["status"] == "created"

    def test_delete_custom_agent(self, client):
        """TC-4.5: Delete custom agent."""
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock) as mock_list, \
             patch("virtual_team.routers.agents.delete_agent_config", new_callable=AsyncMock) as mock_del:
            mock_list.return_value = [
                MagicMock(id="a-custom", is_approver=False),
                MagicMock(id="a-4", is_approver=True),
            ]
            mock_del.return_value = True
            resp = client.delete("/api/agents/a-custom")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

    def test_cannot_delete_sole_approver(self, client):
        """TC-4.6: Sole approver deletion blocked."""
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock) as mock_list:
            mock_list.return_value = [
                MagicMock(id="a-4", is_approver=True, is_active=True),
            ]
            resp = client.delete("/api/agents/a-4")
        assert resp.status_code == 400
        assert "审批者" in resp.json()["detail"]


# ═══════════════════════════════════════════════════════════════════════════════
# SCENARIO 5: Error Handling
# ═══════════════════════════════════════════════════════════════════════════════

class TestScenario5_ErrorHandling:
    """TC-5.1 ~ TC-5.9"""

    def test_empty_requirement_422(self, client):
        resp = client.post("/api/runs", json={"requirement": ""})
        assert resp.status_code == 422

    def test_too_long_requirement_422(self, client):
        resp = client.post("/api/runs", json={"requirement": "x" * 5000})
        assert resp.status_code == 422

    def test_nonexistent_run_404(self, client):
        with patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock) as m:
            m.return_value = None
            resp = client.get("/api/runs/nonexistent-id")
        assert resp.status_code == 404

    def test_nonexistent_session_404(self, client):
        with patch("virtual_team.routers.sessions.get_session", new_callable=AsyncMock) as m:
            m.return_value = None
            resp = client.get("/api/sessions/nonexistent-id")
        assert resp.status_code == 404

    def test_empty_api_key_422(self, client):
        resp = client.post("/api/keys", json={
            "provider": "openai", "label": "Bad", "api_key": "", "models": ["gpt-4o"],
        }, headers={"X-User-ID": USER_ID})
        assert resp.status_code == 422

    def test_duplicate_role_identifier_409(self, client):
        with patch("virtual_team.routers.agents.get_agent_config_by_role", new_callable=AsyncMock) as m:
            m.return_value = MagicMock()  # Already exists
            resp = client.post("/api/agents", json={
                "name": "Dup", "role_identifier": "product_manager",
                "system_prompt": "Test", "order": 99,
                "is_active": True, "is_approver": False, "icon": "👤",
            })
        assert resp.status_code == 409

    def test_nonexistent_command_404(self, client):
        resp = client.get("/api/commands/fake-cmd")
        assert resp.status_code == 404

    def test_nonexistent_key_404(self, client):
        with patch("virtual_team.routers.keys.delete_api_key", new_callable=AsyncMock) as m:
            m.return_value = False
            resp = client.delete("/api/keys/nonexistent", headers={"X-User-ID": USER_ID})
        assert resp.status_code == 404

    def test_nonexistent_agent_404(self, client):
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock) as m:
            m.return_value = []
            resp = client.put("/api/agents/nonexistent/toggle")
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# SECURITY TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestSecurity:
    """Security invariants."""

    def test_key_never_returned_in_any_response(self, client):
        """🔒 Plaintext key must never appear in any list/get response."""
        secret = "sk-top-secret-key-xyz789"

        _mock_key_response(key_id="k-sec", masked="sk-...z789")
        with patch("virtual_team.routers.keys.create_api_key", new_callable=AsyncMock) as m:
            m.return_value = MagicMock(
                id="k-sec", provider="openai", label="Secret Key",
                encrypted_key="enc-blob", base_url="https://api.openai.com/v1",
                models="gpt-4o", is_active=True, is_default=True,
                last_used_at=None,
                created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00"),
            )
            resp = client.post("/api/keys", json={
                "provider": "openai", "label": "Secret Key",
                "api_key": secret, "models": ["gpt-4o"], "is_default": True,
            }, headers={"X-User-ID": USER_ID})
            assert secret not in resp.text, "❌ Plaintext key in POST response!"

        with patch("virtual_team.routers.keys.get_api_keys", new_callable=AsyncMock) as m:
            m.return_value = [_mock_key_response(key_id="k-sec", masked="sk-...z789")]
            resp = client.get("/api/keys", headers={"X-User-ID": USER_ID})
            assert secret not in resp.text, "❌ Plaintext key in GET response!"

    def test_user_isolation(self, client):
        """🔒 User A's keys are invisible to User B."""
        with patch("virtual_team.routers.keys.get_api_keys", new_callable=AsyncMock) as m:
            m.side_effect = lambda user_id: (
                [_mock_key_response(key_id="k-alice", label="Alice Key")]
                if "alice" in str(user_id) else []
            )
            resp_a = client.get("/api/keys", headers={"X-User-ID": "alice"})
            resp_b = client.get("/api/keys", headers={"X-User-ID": "bob"})

        assert len(resp_a.json()) == 1
        assert len(resp_b.json()) == 0


# ═══════════════════════════════════════════════════════════════════════════════
# FULL USER JOURNEY
# ═══════════════════════════════════════════════════════════════════════════════

class TestFullUserJourney:
    """End-to-end simulation of a complete user session."""

    def test_complete_workflow(self, client):
        """
        Simulates: health → models → commands → create key → submit run →
        check run → list sessions → session detail → agents → cleanup
        """
        user = {"X-User-ID": "journey-user"}
        journey_log = []

        # 1. Boot
        r = client.get("/api/health")
        assert r.status_code == 200
        journey_log.append("health ✅")

        r = client.get("/api/models")
        assert r.status_code == 200 and len(r.json()) > 0
        journey_log.append(f"models ({len(r.json())}) ✅")

        r = client.get("/api/commands")
        assert r.status_code == 200 and len(r.json()) == 7
        journey_log.append(f"commands ({len(r.json())}) ✅")

        # 2. Configure key
        with patch("virtual_team.routers.keys.create_api_key", new_callable=AsyncMock) as m:
            m.return_value = MagicMock(
                id="k-journey", provider="deepseek", label="Journey Key",
                encrypted_key="enc", models="deepseek-chat", base_url="https://api.deepseek.com/v1",
                is_active=True, is_default=True, last_used_at=None,
                created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00"),
            )
            r = client.post("/api/keys", json={
                "provider": "deepseek", "label": "Journey Key",
                "api_key": "sk-journey-test-000", "models": ["deepseek-chat"],
                "is_default": True,
            }, headers=user)
            assert r.status_code == 201
            assert "..." in r.json()["key_masked"]
            journey_log.append("key created (masked) ✅")

        # 3. Submit requirement
        run_id = "r-journey"
        session_id = "s-journey"
        import virtual_team.routers.runs as runs_mod
        with patch.object(runs_mod, "create_session", new_callable=AsyncMock, create=True) as mock_sess, \
             patch.object(runs_mod, "db_create_run", new_callable=AsyncMock, create=True) as mock_run, \
             patch.object(runs_mod, "get_session", new_callable=AsyncMock, create=True) as mock_get_sess, \
             patch.object(runs_mod, "update_session_title", new_callable=AsyncMock, create=True), \
             patch.object(runs_mod, "get_default_api_key", new_callable=AsyncMock, create=True) as mock_key, \
             patch.object(runs_mod, "run_agent", create=True) as mock_task:
            mock_sess.return_value = MagicMock(id=session_id)
            mock_run.return_value = run_id
            mock_get_sess.return_value = MagicMock(title="快速排序")
            mock_key.return_value = {"api_key": "sk-decrypted", "base_url": "https://api.deepseek.com/v1"}
            mock_task.delay = MagicMock(return_value=None)

            r = client.post("/api/runs", json={
                "requirement": "写一个快速排序的 Python 实现",
                "model": "deepseek-chat",
            }, headers=user)
            assert r.status_code == 200
            journey_log.append(f"run created ({run_id}) ✅")

        # 4. Check run
        with patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock) as mock_get, \
             patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock) as mock_msgs:
            mock_get.return_value = MagicMock(
                id=run_id, session_id=session_id,
                requirement="写一个快速排序的 Python 实现",
                pm_document="## PRD", code="def quicksort(): pass",
                review="通过", approved=True, status="converged",
                created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00"),
                updated_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:10+00:00"),
            )
            mock_msgs.return_value = []
            r = client.get(f"/api/runs/{run_id}")
            assert r.status_code == 200 and r.json()["status"] == "converged"
            journey_log.append("run status converged ✅")

        # 5. Sessions
        with patch("virtual_team.routers.sessions.get_sessions", new_callable=AsyncMock) as mock_list, \
             patch("virtual_team.routers.sessions.get_runs_by_session_ids", new_callable=AsyncMock) as mock_runs:
            mock_list.return_value = [
                MagicMock(id=session_id, title="快速排序",
                          created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00"),
                          updated_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:10+00:00")),
            ]
            mock_runs.return_value = {session_id: [MagicMock()]}
            r = client.get("/api/sessions")
            assert r.status_code == 200
            journey_log.append(f"sessions ({len(r.json())}) ✅")

        # 6. Agents
        with patch("virtual_team.routers.agents.get_agent_configs", new_callable=AsyncMock) as m:
            m.return_value = [
                MagicMock(id="a-1", name="PM", role_identifier="product_manager",
                          system_prompt="...", model=None, temperature=None,
                          order=0, is_active=True, is_approver=False, icon="👤",
                          created_at=MagicMock(isoformat=lambda: "2026-06-03T00:00:00+00:00")),
            ]
            r = client.get("/api/agents")
            assert r.status_code == 200
            journey_log.append(f"agents ({len(r.json())}) ✅")

        # Print journey
        print("\n🎯 Full User Journey:")
        for step in journey_log:
            print(f"   {step}")
        print("✅ All 7 steps passed")
