import pytest

from virtual_team.config import TeamConfig
from virtual_team.main import run_team, main


@pytest.fixture
def mock_db_agents(mocker):
    """Mock get_active_agent_configs to return a list."""
    from virtual_team.models import AgentConfig
    agents = [
        AgentConfig(
            id="test-id-1",
            name="前端工程师",
            role_identifier="frontend",
            system_prompt="前端。",
            order=0,
        ),
    ]
    async def _mock():
        return agents
    mocker.patch("virtual_team.main.get_active_agent_configs", side_effect=_mock)


class TestRunTeam:
    def test_run_team_with_mocked_conversation(self, mocker, mock_db_agents):
        mock_output = mocker.MagicMock()
        mock_output.requirement = "test"
        mock_output.pm_document = "doc"
        mock_output.code = "code"
        mock_output.review = "review"
        mock_output.approved = True
        mock_output.model_dump.return_value = {
            "requirement": "test",
            "pm_document": "doc",
            "code": "code",
            "review": "review",
            "approved": True,
        }

        mock_manager = mocker.MagicMock()
        mock_manager.run.return_value = mock_output
        mocker.patch("virtual_team.main.TeamManager", return_value=mock_manager)

        config = TeamConfig(api_key="sk-test")
        result = run_team("测试", config=config)
        assert result["approved"] is True
        assert result["requirement"] == "test"

    def test_run_team_default_config(self, mocker, mock_db_agents):
        mock_output = mocker.MagicMock()
        mock_output.model_dump.return_value = {"requirement": "test"}
        mock_manager = mocker.MagicMock()
        mock_manager.run.return_value = mock_output
        mocker.patch("virtual_team.main.TeamManager", return_value=mock_manager)
        mocker.patch("virtual_team.main.load_config",
                     return_value=TeamConfig(api_key="sk-test"))

        result = run_team("测试")
        assert result["requirement"] == "test"

    def test_run_team_error(self, mocker, mock_db_agents):
        mock_manager = mocker.MagicMock()
        mock_manager.run.side_effect = RuntimeError("Failed")
        mocker.patch("virtual_team.main.TeamManager", return_value=mock_manager)

        with pytest.raises(RuntimeError):
            run_team("测试", config=TeamConfig(api_key="sk-test"))


class TestMainCLI:
    def test_main_with_requirement_arg(self, mocker, mock_db_agents):
        mock_output = mocker.MagicMock()
        mock_output.model_dump_json.return_value = '{"requirement": "test"}'
        mock_manager = mocker.MagicMock()
        mock_manager.run.return_value = mock_output
        mocker.patch("virtual_team.main.TeamManager", return_value=mock_manager)
        mocker.patch("sys.argv", ["main.py", "测试需求"])

        result = main()
        assert result == 0

    def test_main_prints_json(self, mocker, mock_db_agents):
        mock_output = mocker.MagicMock()
        mock_output.model_dump_json.return_value = '{"approved": true}'
        mock_manager = mocker.MagicMock()
        mock_manager.run.return_value = mock_output
        mocker.patch("virtual_team.main.TeamManager", return_value=mock_manager)
        mocker.patch("sys.argv", ["main.py", "测试需求"])

        result = main()
        assert result == 0
        mock_output.model_dump_json.assert_called_once_with(indent=2, ensure_ascii=False)

    def test_main_no_args(self, mocker):
        mocker.patch("sys.argv", ["main.py"])
        result = main()
        assert result == 1
