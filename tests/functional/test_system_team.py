"""Tests for system team API routes."""
from unittest.mock import MagicMock, patch

import pytest


class TestSystemTeamInfo:
    @patch("virtual_team.routers.system_team.get_system_team_manager")
    async def test_get_team_info(self, mock_get_manager):
        mock_mgr = MagicMock()
        mock_mgr.get_team_info.return_value = {"name": "System Team", "agents": 3}
        mock_get_manager.return_value = mock_mgr

        from virtual_team.routers.system_team import get_team_info
        result = await get_team_info()
        assert result["name"] == "System Team"
        assert result["agents"] == 3

    @patch("virtual_team.routers.system_team.get_system_team_manager")
    async def test_list_agents(self, mock_get_manager):
        mock_mgr = MagicMock()
        mock_mgr.list_agents.return_value = [
            {"id": "tools_agent", "name": "Tools Agent"},
            {"id": "skill_agent", "name": "Skill Agent"},
        ]
        mock_get_manager.return_value = mock_mgr

        from virtual_team.routers.system_team import list_agents
        result = await list_agents()
        assert len(result) == 2

    @patch("virtual_team.routers.system_team.get_system_team_manager")
    async def test_get_agent_config_found(self, mock_get_manager):
        mock_mgr = MagicMock()
        mock_mgr.get_agent_config.return_value = {"id": "tools_agent", "model": "gpt-4"}
        mock_get_manager.return_value = mock_mgr

        from virtual_team.routers.system_team import get_agent_config
        result = await get_agent_config("tools_agent")
        assert result["id"] == "tools_agent"

    @patch("virtual_team.routers.system_team.get_system_team_manager")
    async def test_get_agent_config_not_found(self, mock_get_manager):
        mock_mgr = MagicMock()
        mock_mgr.get_agent_config.return_value = None
        mock_get_manager.return_value = mock_mgr

        from virtual_team.routers.system_team import get_agent_config
        with pytest.raises(Exception) as exc:
            await get_agent_config("nonexistent")
        assert "不存在" in str(exc.value)

    @patch("virtual_team.routers.system_team.get_system_team_manager")
    async def test_list_agent_tools(self, mock_get_manager):
        mock_mgr = MagicMock()
        mock_mgr.get_agent_tools.return_value = [{"name": "web_search"}]
        mock_get_manager.return_value = mock_mgr

        from virtual_team.routers.system_team import list_agent_tools
        result = await list_agent_tools("tools_agent")
        assert len(result) == 1

    @patch("virtual_team.routers.system_team.get_system_team_manager")
    async def test_list_agent_skills(self, mock_get_manager):
        mock_mgr = MagicMock()
        mock_mgr.get_agent_skills.return_value = [{"name": "code_review"}]
        mock_get_manager.return_value = mock_mgr

        from virtual_team.routers.system_team import list_agent_skills
        result = await list_agent_skills("skill_agent")
        assert len(result) == 1

    @patch("virtual_team.routers.system_team.get_system_team_manager")
    async def test_list_shared_resources(self, mock_get_manager):
        mock_mgr = MagicMock()
        mock_mgr.get_shared_resources.return_value = {"tools": [], "skills": []}
        mock_get_manager.return_value = mock_mgr

        from virtual_team.routers.system_team import list_shared_resources
        result = await list_shared_resources()
        assert "tools" in result

    @patch("virtual_team.routers.system_team.llm_client")
    async def test_llm_status_available(self, mock_llm):
        mock_llm.is_available.return_value = True
        from virtual_team.routers.system_team import get_llm_status
        result = await get_llm_status()
        assert result["available"] is True

    @patch("virtual_team.routers.system_team.llm_client")
    async def test_llm_status_unavailable(self, mock_llm):
        mock_llm.is_available.return_value = False
        from virtual_team.routers.system_team import get_llm_status
        result = await get_llm_status()
        assert result["available"] is False
