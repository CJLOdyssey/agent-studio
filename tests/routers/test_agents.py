"""Tests for Agent CRUD API endpoints."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _mock_async_session_factory():
    """Return a callable that yields an AsyncMock session."""
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
    """Create a TestClient with all external dependencies mocked."""
    mock_redis = MagicMock()
    mock_redis.ping = AsyncMock(return_value=True)
    _mock_factory = _mock_async_session_factory()

    with patch("virtual_team.broker.get_redis", return_value=mock_redis), \
         patch("virtual_team.database.get_async_engine", return_value=MagicMock()), \
         patch("virtual_team.database.get_session_factory", _mock_factory), \
         patch("virtual_team.repository.keys.get_session_factory", _mock_factory), \
         patch("virtual_team.repository.agents.get_session_factory", _mock_factory), \
         patch("virtual_team.repository.core.get_session_factory", _mock_factory), \
         patch("virtual_team.repository.teams.get_session_factory", _mock_factory), \
         patch("virtual_team.database.init_db", new_callable=AsyncMock), \
         patch("virtual_team.repository.seed_default_agents", new_callable=AsyncMock), \
         patch("virtual_team.rate_limit.get_redis", return_value=mock_redis):
        from fastapi.testclient import TestClient

        from virtual_team.app import app
        yield TestClient(app)


class TestCreateAgent:
    """测试创建 Agent"""

    def test_create_agent_success(self, client):
        """创建 Agent 成功"""
        response = client.post("/api/agents", json={
            "name": "产品经理",
            "role_identifier": "pm",
            "system_prompt": "你是一个产品经理，负责需求分析和PRD输出。",
            "description": "负责需求分析和PRD输出",
            "icon": "📋",
            "model": "deepseek-v4-flash",
            "temperature": 0.7,
            "is_approver": False
        })
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["status"] == "created"

    def test_create_agent_duplicate_role_returns_409(self, client):
        """重复角色标识返回 409"""
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_existing = MagicMock()
        mock_existing.role_identifier = "pm"

        with patch("virtual_team.routers.agents.get_agent_config_by_role", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_existing
            response = client.post("/api/agents", json={
                "name": "另一个产品经理",
                "role_identifier": "pm",
                "system_prompt": "你是另一个产品经理。",
            })
            assert response.status_code == 409

    def test_create_agent_missing_name_returns_422(self, client):
        """缺少名称返回 422"""
        response = client.post("/api/agents", json={
            "role_identifier": "pm",
            "system_prompt": "你是一个产品经理。",
        })
        assert response.status_code == 422

    def test_create_agent_missing_role_identifier_returns_422(self, client):
        """缺少角色标识返回 422"""
        response = client.post("/api/agents", json={
            "name": "产品经理",
            "system_prompt": "你是一个产品经理。",
        })
        assert response.status_code == 422

    def test_create_agent_missing_system_prompt_returns_422(self, client):
        """缺少系统提示词返回 422"""
        response = client.post("/api/agents", json={
            "name": "产品经理",
            "role_identifier": "pm",
        })
        assert response.status_code == 422

    def test_create_agent_invalid_role_identifier_returns_422(self, client):
        """无效的角色标识返回 422（包含大写字母）"""
        response = client.post("/api/agents", json={
            "name": "产品经理",
            "role_identifier": "PM",
            "system_prompt": "你是一个产品经理。",
        })
        assert response.status_code == 422

    def test_create_agent_with_all_fields(self, client):
        """创建 Agent 包含所有字段"""
        response = client.post("/api/agents", json={
            "name": "资深程序员",
            "role_identifier": "senior_dev",
            "system_prompt": "你是一个资深程序员。",
            "output_constraints": "输出代码时使用 Markdown 格式。",
            "model": "deepseek-v4-flash",
            "temperature": 0.5,
            "order": 1,
            "is_active": True,
            "is_approver": True,
            "icon": "👨‍💻"
        })
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
