"""Tests for TeamGraph multi-agent collaboration."""
import pytest

pytest.importorskip("langchain_openai", reason="langchain-openai not installed")

from virtual_team.team_graph import TeamGraph, TeamState


class TestTeamState:
    def test_team_state_is_dict_like(self):
        state: TeamState = {
            "messages": [],
            "requirement": "写一个计算器",
            "pm_document": "",
            "code": "",
            "review": "",
            "approved": False,
            "round_number": 0,
        }
        assert state["requirement"] == "写一个计算器"
        assert state["approved"] is False
        assert state["round_number"] == 0
        assert len(state) == 7


class TestTeamGraphInit:
    def test_graph_initializes(self):
        team = TeamGraph(
            model="deepseek-chat",
            api_key="test-key",
            max_rounds=3,
        )
        assert team.max_rounds == 3
        assert team._graph is not None

    def test_set_agents(self):
        team = TeamGraph(model="deepseek-chat", api_key="test-key")
        team.set_agents([
            {"role_identifier": "product_manager", "system_prompt": "你是PM", "name": "PM"},
            {"role_identifier": "frontend", "system_prompt": "你是前端", "name": "FE"},
            {"role_identifier": "backend", "system_prompt": "你是后端", "name": "BE"},
            {"role_identifier": "tester", "system_prompt": "你是测试", "name": "QA"},
        ])
        assert "product_manager" in team._agent_prompts
        assert team._agent_prompts["product_manager"] == "你是PM"

    def test_graph_has_required_methods(self):
        team = TeamGraph(model="deepseek-chat", api_key="test-key")
        assert hasattr(team, "run")
        assert hasattr(team, "invoke_sync")
        assert hasattr(team, "set_agents")
