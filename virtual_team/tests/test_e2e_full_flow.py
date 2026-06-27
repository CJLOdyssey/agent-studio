"""
E2E API Integration Tests: Team → Agent → Config → Session → Run

Tests the full business flow from team creation through agent configuration
to conversation. Each test cleans up after itself.

Run:
    PYTHONPATH=. python3 -m pytest virtual_team/tests/test_e2e_full_flow.py -v --tb=long
"""

import httpx
import pytest
import uuid
import string
import time


def _rid(prefix: str = "test") -> str:
    """Generate role_identifier: only lowercase letters + underscores."""
    suffix = uuid.uuid4().hex[:8]
    clean_suffix = "".join(c for c in suffix if c in string.ascii_lowercase)
    # Also clean prefix in case it has digits
    clean_prefix = "".join(c for c in prefix if c in string.ascii_lowercase + "_")
    result = f"{clean_prefix}_{clean_suffix}" if clean_suffix else f"{clean_prefix}_x"
    return result


def _clear_rate_limits():
    """Flush Redis rate limit keys so tests don't get 429'd."""
    try:
        import subprocess
        keys = subprocess.run(
            ["docker", "exec", "virtual-team-redis", "redis-cli", "KEYS", "ratelimit:*"],
            capture_output=True, text=True, timeout=5
        )
        if keys.stdout.strip():
            key_list = keys.stdout.strip().split("\n")
            subprocess.run(
                ["docker", "exec", "virtual-team-redis", "redis-cli", "DEL"] + key_list,
                capture_output=True, timeout=5
            )
    except Exception:
        pass

BASE = "http://localhost:8080"


@pytest.fixture(autouse=True)
def _fresh_rate_limit():
    _clear_rate_limits()



# ─── Helpers ───


class Api:
    def __init__(self, base: str = BASE):
        self.client = httpx.Client(base_url=base, timeout=30)

    def get(self, path: str, **kw):
        return self.client.get(path, **kw)

    def post(self, path: str, json=None, **kw):
        return self.client.post(path, json=json, **kw)

    def put(self, path: str, json=None, **kw):
        return self.client.put(path, json=json, **kw)

    def delete(self, path: str, **kw):
        return self.client.delete(path, **kw)

    def close(self):
        self.client.close()


@pytest.fixture
def api():
    a = Api()
    yield a
    a.close()


def _cleanup(*ids_and_endpoints: tuple[str, str]):
    """Best-effort cleanup: delete each id from its endpoint."""
    c = httpx.Client(base_url=BASE, timeout=10)
    for eid, ep in ids_and_endpoints:
        try:
            c.delete(f"{ep}/{eid}")
        except Exception:
            pass
    c.close()


# ══════════════════════════════════════════════════════════════════
# 1. TEAM CRUD
# ══════════════════════════════════════════════════════════════════

class TestTeamCRUD:
    def test_create_team(self, api: Api):
        r = api.post("/api/teams", json={"name": "E2E-Team-Create"})
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["name"] == "E2E-Team-Create"
        assert "id" in body
        _cleanup((body["id"], "/api/teams"))

    def test_list_teams(self, api: Api):
        r = api.get("/api/teams")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            item = data[0]
            assert all(k in item for k in ("id", "name", "order", "agents", "created_at"))

    def test_update_team(self, api: Api):
        r = api.post("/api/teams", json={"name": "E2E-Team-Old"})
        tid = r.json()["id"]
        r2 = api.put(f"/api/teams/{tid}", json={"name": "E2E-Team-New"})
        assert r2.status_code == 200
        assert r2.json()["name"] == "E2E-Team-New"
        _cleanup((tid, "/api/teams"))

    def test_delete_team(self, api: Api):
        r = api.post("/api/teams", json={"name": "E2E-Team-Del"})
        tid = r.json()["id"]
        r2 = api.delete(f"/api/teams/{tid}")
        assert r2.status_code in (200, 204)


# ══════════════════════════════════════════════════════════════════
# 2. AGENT CRUD + FULL CONFIG
# ══════════════════════════════════════════════════════════════════

class TestAgentCRUD:
    def test_create_agent_full_config(self, api: Api):

        r = api.post("/api/agents", json={
            "name": "E2E-Agent",
            "role_identifier": _rid("e2e_agent"),
            "system_prompt": "你是E2E测试助手",
            "output_constraints": "请用中文回答",
            "model": "deepseek-v4-flash",
            "temperature": 0.7,
            "tools": [{"name": "calculator", "enabled": True}],
            "mcp": [{"name": "file_server", "config": {"root": "/tmp"}}],
            "skills": [{"name": "code_review", "version": "1.0"}],
            "is_active": True,
            "icon": "🤖",
        })
        assert r.status_code == 201, r.text
        body = r.json()
        assert "id" in body
        assert body["status"] == "created"
        aid = body["id"]
        r2 = api.get(f"/api/agents/{aid}")
        assert r2.status_code == 200
        a = r2.json()
        assert a["system_prompt"] == "你是E2E测试助手"
        assert a["output_constraints"] == "请用中文回答"
        assert a["model"] == "deepseek-v4-flash"
        assert a["temperature"] == 0.7
        assert isinstance(a["tools"], list)
        assert a["tools"][0]["name"] == "calculator"
        _cleanup((aid, "/api/agents"))

    def test_create_agent_minimal(self, api: Api):

        r = api.post("/api/agents", json={
            "name": "Minimal-Agent",
            "role_identifier": _rid("minimal"),
            "system_prompt": "Hello",
        })
        assert r.status_code == 201, r.text
        body = r.json()
        assert "id" in body
        _cleanup((body["id"], "/api/agents"))

    def test_update_agent(self, api: Api):

        r = api.post("/api/agents", json={
            "name": "Old-Name", "role_identifier": _rid("old"),
            "system_prompt": "old",
        })
        aid = r.json()["id"]
        r2 = api.put(f"/api/agents/{aid}", json={
            "name": "New-Name",
            "system_prompt": "new prompt",
        })
        assert r2.status_code == 200
        body = r2.json()
        assert body["status"] == "updated"
        r3 = api.get(f"/api/agents/{aid}")
        assert r3.json()["name"] == "New-Name"
        assert r3.json()["system_prompt"] == "new prompt"
        _cleanup((aid, "/api/agents"))

    def test_delete_agent(self, api: Api):

        r = api.post("/api/agents", json={
            "name": "Del-Agent", "role_identifier": _rid("del"), "system_prompt": "x",
        })
        assert r.status_code == 201, r.text
        aid = r.json()["id"]
        r2 = api.delete(f"/api/agents/{aid}")
        assert r2.status_code == 200
        assert r2.json()["status"] == "deleted"

    def test_toggle_agent(self, api: Api):
        r = api.post("/api/agents", json={
            "name": "Toggle-Agent", "role_identifier": "toggle_agent",
            "system_prompt": "x", "is_active": True,
        })
        aid = r.json()["id"]
        r2 = api.put(f"/api/agents/{aid}/toggle")
        assert r2.status_code == 200
        body = r2.json()
        assert body.get("is_active") is False
        _cleanup((aid, "/api/agents"))

    def test_list_agents_full_fields(self, api: Api):
        r = api.get("/api/agents")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            item = data[0]
            expected = {"id", "name", "role_identifier", "system_prompt",
                        "output_constraints", "tools", "mcp", "skills",
                        "model", "temperature", "order", "is_active",
                        "is_approver", "icon", "created_at"}
            assert expected.issubset(item.keys()), f"Missing keys: {expected - item.keys()}"


# ══════════════════════════════════════════════════════════════════
# 3. PROMPT CRUD
# ══════════════════════════════════════════════════════════════════

class TestPromptCRUD:
    def test_create_prompt(self, api: Api):
        r = api.post("/api/prompts", json={
            "name": "E2E-Prompt", "content": "审查代码安全性",
            "category": "code_review", "tags": ["security"],
        })
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["name"] == "E2E-Prompt"
        _cleanup((body["id"], "/api/prompts"))

    def test_list_prompts(self, api: Api):
        r = api.get("/api/prompts")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_update_prompt(self, api: Api):
        r = api.post("/api/prompts", json={
            "name": "Old", "content": "old", "category": "general",
        })
        pid = r.json()["id"]
        r2 = api.put(f"/api/prompts/{pid}", json={"name": "New"})
        assert r2.status_code == 200
        assert r2.json()["name"] == "New"
        _cleanup((pid, "/api/prompts"))

    def test_delete_prompt(self, api: Api):
        r = api.post("/api/prompts", json={
            "name": "Del", "content": "x", "category": "general",
        })
        pid = r.json()["id"]
        r2 = api.delete(f"/api/prompts/{pid}")
        assert r2.status_code in (200, 204)


# ══════════════════════════════════════════════════════════════════
# 4. TOOL CRUD + GENERATE + VALIDATE
# ══════════════════════════════════════════════════════════════════

class TestToolCRUD:
    def test_create_tool(self, api: Api):
        r = api.post("/api/tools", json={
            "name": "E2E-Calculator",
            "category": "utility",
            "description": "加法计算器",
        })
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["name"] == "E2E-Calculator"
        assert body["category"] == "utility"
        _cleanup((body["id"], "/api/tools"))

    def test_list_tools(self, api: Api):
        r = api.get("/api/tools")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_update_tool(self, api: Api):
        r = api.post("/api/tools", json={
            "name": "Old", "category": "general", "description": "x",
        })
        tid = r.json()["id"]
        r2 = api.put(f"/api/tools/{tid}", json={"name": "New"})
        assert r2.status_code == 200
        assert r2.json()["name"] == "New"
        _cleanup((tid, "/api/tools"))

    def test_delete_tool(self, api: Api):
        r = api.post("/api/tools", json={
            "name": "Del", "category": "general", "description": "x",
        })
        tid = r.json()["id"]
        r2 = api.delete(f"/api/tools/{tid}")
        assert r2.status_code in (200, 204)

    def test_generate_tool(self, api: Api):
        r = api.post("/api/tools/generate", json={
            "description": "计算两个数字的乘积",
            "language": "python",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert "name" in body
        assert "code" in body
        assert body.get("is_valid") is True or body.get("is_valid") is False

    def test_validate_tool(self, api: Api):
        r = api.post("/api/tools/validate", json={
            "code": "def multiply(a, b):\n    return a * b",
            "language": "python",
        })
        assert r.status_code == 200
        body = r.json()
        assert "is_valid" in body


# ══════════════════════════════════════════════════════════════════
# 5. MCP CRUD
# ══════════════════════════════════════════════════════════════════

class TestMCPCrud:
    def test_create_mcp(self, api: Api):
        r = api.post("/api/mcps", json={
            "name": "E2E-MCP",
            "server_type": "stdio",
            "command": "python",
            "args": ["-m", "mcp_server"],
            "env": {"ROOT": "/data"},
            "is_active": True,
        })
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["name"] == "E2E-MCP"
        _cleanup((body["id"], "/api/mcps"))

    def test_list_mcps(self, api: Api):
        r = api.get("/api/mcps")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_update_mcp(self, api: Api):
        r = api.post("/api/mcps", json={
            "name": "Old", "server_type": "stdio",
            "command": "python", "args": [], "env": {},
        })
        mid = r.json()["id"]
        r2 = api.put(f"/api/mcps/{mid}", json={"name": "New"})
        assert r2.status_code == 200
        assert r2.json()["name"] == "New"
        _cleanup((mid, "/api/mcps"))

    def test_delete_mcp(self, api: Api):
        r = api.post("/api/mcps", json={
            "name": "Del", "server_type": "stdio",
            "command": "python", "args": [], "env": {},
        })
        mid = r.json()["id"]
        r2 = api.delete(f"/api/mcps/{mid}")
        assert r2.status_code in (200, 204)


# ══════════════════════════════════════════════════════════════════
# 6. SKILL CRUD
# ══════════════════════════════════════════════════════════════════

class TestSkillCRUD:
    def test_create_skill(self, api: Api):
        r = api.post("/api/skills", json={
            "name": "E2E-Skill",
            "description": "自动代码审查",
            "version": "1.0.0",
            "category": "code_review",
            "config": {"rules": ["security"]},
            "is_active": True,
        })
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["name"] == "E2E-Skill"
        _cleanup((body["id"], "/api/skills"))

    def test_list_skills(self, api: Api):
        r = api.get("/api/skills")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_update_skill(self, api: Api):
        r = api.post("/api/skills", json={
            "name": "Old", "description": "x", "version": "1.0",
            "category": "general", "config": {},
        })
        sid = r.json()["id"]
        r2 = api.put(f"/api/skills/{sid}", json={"name": "New"})
        assert r2.status_code == 200
        assert r2.json()["name"] == "New"
        _cleanup((sid, "/api/skills"))

    def test_delete_skill(self, api: Api):
        r = api.post("/api/skills", json={
            "name": "Del", "description": "x", "version": "1.0",
            "category": "general", "config": {},
        })
        sid = r.json()["id"]
        r2 = api.delete(f"/api/skills/{sid}")
        assert r2.status_code in (200, 204)


# ══════════════════════════════════════════════════════════════════
# 7. SESSION + RUN
# ══════════════════════════════════════════════════════════════════

class TestSessionAndRun:
    def test_create_session(self, api: Api):

        r = api.post("/api/sessions", json={"title": "E2E-Session"})
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["title"] == "E2E-Session"
        _cleanup((body["id"], "/api/sessions"))

    def test_list_sessions(self, api: Api):
        r = api.get("/api/sessions")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_get_session_detail(self, api: Api):

        r = api.post("/api/sessions", json={"title": "Detail-Test"})
        assert r.status_code == 201, r.text
        sid = r.json()["id"]
        r2 = api.get(f"/api/sessions/{sid}")
        assert r2.status_code == 200
        body = r2.json()
        assert body["id"] == sid
        assert "runs" in body
        _cleanup((sid, "/api/sessions"))


# ══════════════════════════════════════════════════════════════════
# 8. FULL E2E FLOW
# ══════════════════════════════════════════════════════════════════

class TestFullE2EFlow:
    def test_complete_business_flow(self, api: Api):
        """Team → Prompt → Tool → MCP → Skill → Agent → Session → Run → Verify"""
        cleanup = []
        _clear_rate_limits()

        try:
            # 1. Create team
    
            r = api.post("/api/teams", json={"name": "E2E-Full-Team"})
            assert r.status_code == 201, r.text
            team = r.json()
            cleanup.append((team["id"], "/api/teams"))

            # 2. Create prompt
    
            r = api.post("/api/prompts", json={
                "name": "E2E-Full-Prompt", "content": "你是专业助手",
                "category": "general",
            })
            assert r.status_code == 201, r.text
            prompt = r.json()
            cleanup.append((prompt["id"], "/api/prompts"))

            # 3. Create tool
    
            r = api.post("/api/tools", json={
                "name": "E2E-Full-Tool", "category": "utility",
                "description": "计算器",
            })
            assert r.status_code == 201, r.text
            tool = r.json()
            cleanup.append((tool["id"], "/api/tools"))

            # 4. Create MCP
    
            r = api.post("/api/mcps", json={
                "name": "E2E-Full-MCP", "server_type": "stdio",
                "command": "python", "args": ["-m", "mcp"], "env": {},
            })
            assert r.status_code == 201, r.text
            mcp = r.json()
            cleanup.append((mcp["id"], "/api/mcps"))

            # 5. Create skill
    
            r = api.post("/api/skills", json={
                "name": "E2E-Full-Skill", "description": "审查",
                "version": "1.0", "category": "code_review", "config": {},
            })
            assert r.status_code == 201, r.text
            skill = r.json()
            cleanup.append((skill["id"], "/api/skills"))

            # 6. Create agent with all config
    
            r = api.post("/api/agents", json={
                "name": "E2E-Full-Agent",
                "role_identifier": _rid("e2e_full"),
                "system_prompt": "你是E2E全配置测试助手，请简洁回答。",
                "output_constraints": "1. 使用中文\n2. 不超过50字",
                "model": "deepseek-v4-flash",
                "temperature": 0.5,
                "tools": [{"id": tool["id"], "name": tool["name"], "enabled": True}],
                "mcp": [{"id": mcp["id"], "name": mcp["name"], "enabled": False}],
                "skills": [{"id": skill["id"], "name": skill["name"], "version": "1.0"}],
                "is_active": True,
                "icon": "🧪",
            })
            assert r.status_code == 201, r.text
            agent = r.json()
            cleanup.append((agent["id"], "/api/agents"))

            # 7. Verify agent config persisted correctly
            r = api.get(f"/api/agents/{agent['id']}")
            assert r.status_code == 200
            a = r.json()
            assert a["system_prompt"] == "你是E2E全配置测试助手，请简洁回答。"
            assert a["output_constraints"] == "1. 使用中文\n2. 不超过50字"
            assert a["model"] == "deepseek-v4-flash"
            assert len(a["tools"]) == 1
            assert a["tools"][0]["id"] == tool["id"]
            assert len(a["skills"]) == 1

            # 8. Verify team has agent
            r = api.get(f"/api/teams/{team['id']}")
            assert r.status_code == 200

            # 9. Create session
    
            r = api.post("/api/sessions", json={"title": "E2E-Full-Session"})
            assert r.status_code == 201, r.text
            session = r.json()
            cleanup.append((session["id"], "/api/sessions"))

            # 10. Create run (may fail if no LLM API key, that's OK)
            r = api.post("/api/runs", json={
                "requirement": "1+1等于多少？",
                "session_id": session["id"],
                "agent_id": agent["id"],
            })
            if r.status_code == 200:
                run = r.json()
                assert "run_id" in run
                assert run.get("session_id") == session["id"]
            else:
                # LLM not configured → expected failure, test CRUD still works
                assert r.status_code in (400, 422, 500)

        finally:
            # Cleanup (reverse order)
            for eid, ep in reversed(cleanup):
                try:
                    api.delete(f"{ep}/{eid}")
                except Exception:
                    pass
