"""Locust load test for Virtual Team backend.

Usage:
    # Install locust first:
    pip install locust

    # Start with web UI (http://localhost:8089):
    locust -f virtual_team/loadtests/locustfile.py

    # Headless run (100 users, 10 spawn/s, 5 min):
    locust -f virtual_team/loadtests/locustfile.py \
        --headless --users 100 --spawn-rate 10 --run-time 5m \
        --host http://localhost:8080
"""

import random

from locust import HttpUser, between, task


class WebsiteUser(HttpUser):
    """Simulates a user interacting with the Virtual Team backend."""

    wait_time = between(0.5, 3.0)

    def on_start(self):
        """Log in once at user start (AUTH_MODE=legacy)."""
        resp = self.client.post("/api/auth/login", json={
            "username": "admin",
            "password": "admin123",
        })
        if resp.ok:
            token = resp.json().get("access_token")
            if token:
                self.client.headers.update({"Authorization": f"Bearer {token}"})

    # ── Health & Discovery ────────────────────────────────────────────────

    @task(5)
    def health_check(self):
        self.client.get("/api/health", name="health")

    @task(3)
    def list_models(self):
        self.client.get("/api/models", name="list_models")

    # ── Agents ────────────────────────────────────────────────────────────

    @task(3)
    def list_agents(self):
        self.client.get("/api/agents", name="list_agents")

    @task(2)
    def create_agent(self):
        payload = {
            "name": f"loadtest-agent-{random.randint(1, 99999)}",
            "system_prompt": "You are a helpful assistant.",
            "provider": "openai",
            "model": "deepseek-v4-flash",
            "temperature": 0.7,
            "max_tokens": 2048,
        }
        self.client.post("/api/agents", json=payload, name="create_agent")

    # ── Sessions ──────────────────────────────────────────────────────────

    @task(3)
    def list_sessions(self):
        self.client.get("/api/sessions", name="list_sessions")

    @task(2)
    def create_session(self):
        payload = {"title": f"loadtest-session-{random.randint(1, 99999)}"}
        self.client.post("/api/sessions", json=payload, name="create_session")

    # ── Tools ─────────────────────────────────────────────────────────────

    @task(2)
    def list_tools(self):
        self.client.get("/api/tools", name="list_tools")

    @task(1)
    def list_plugins(self):
        self.client.get("/api/tools/plugins", name="list_plugins")

    # ── Prompts ───────────────────────────────────────────────────────────

    @task(2)
    def list_prompts(self):
        self.client.get("/api/prompts", name="list_prompts")

    @task(1)
    def create_prompt(self):
        payload = {
            "name": f"loadtest-prompt-{random.randint(1, 99999)}",
            "content": "You are a helpful assistant.",
        }
        self.client.post("/api/prompts", json=payload, name="create_prompt")

    # ── Skills ────────────────────────────────────────────────────────────

    @task(2)
    def list_skills(self):
        self.client.get("/api/skills", name="list_skills")

    # ── Teams ─────────────────────────────────────────────────────────────

    @task(2)
    def list_teams(self):
        self.client.get("/api/teams", name="list_teams")

    # ── MCPs ──────────────────────────────────────────────────────────────

    @task(1)
    def list_mcps(self):
        self.client.get("/api/mcps", name="list_mcps")

    # ── Keys ──────────────────────────────────────────────────────────────

    @task(2)
    def list_keys(self):
        self.client.get("/api/keys", name="list_keys")

    # ── Providers ─────────────────────────────────────────────────────────

    @task(1)
    def list_providers(self):
        self.client.get("/api/providers", name="list_providers")

    # ── Workflows ─────────────────────────────────────────────────────────

    @task(1)
    def list_workflows(self):
        self.client.get("/api/workflows", name="list_workflows")

    # ── Admin ─────────────────────────────────────────────────────────────

    @task(1)
    def admin_stats(self):
        self.client.get("/api/admin/stats", name="admin_stats")

    # ── Attachments ───────────────────────────────────────────────────────

    @task(1)
    def list_attachments(self):
        self.client.get("/api/sessions/attachments", name="list_attachments")

    # ── Versions ──────────────────────────────────────────────────────────

    @task(1)
    def list_versions(self):
        self.client.get("/api/versions", name="list_versions")
