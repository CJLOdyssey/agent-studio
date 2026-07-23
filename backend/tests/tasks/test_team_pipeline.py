"""Tests for backend.tasks.team_pipeline — _run_team_pipeline."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture
def mock_team_deps():
    """Mock all external dependencies for _run_team_pipeline."""
    patchers = [
        patch("backend.tasks.team_pipeline.load_config"),
        patch("backend.tasks.team_pipeline.get_workflow_config_by_team", new_callable=AsyncMock),
        patch("backend.tasks.team_pipeline.update_run_status", new_callable=AsyncMock),
        patch("backend.tasks.team_pipeline.update_run_result", new_callable=AsyncMock),
        patch("backend.tasks.team_pipeline.publish_run_message", new_callable=AsyncMock),
        patch("backend.tasks.team_pipeline.create_checkpointer_async", new_callable=AsyncMock),
        patch("backend.tasks.team_pipeline.DynamicTeamGraph"),
        patch("backend.tasks.team_pipeline.log_memory_diff"),
    ]
    mocks = {}
    for p in patchers:
        m = p.start()
        mocks[p.attribute] = m
    cfg = MagicMock()
    cfg.model = "test-model"
    cfg.api_key = "sk-test"
    cfg.api_base = "http://test.api"
    mocks["load_config"].return_value = cfg
    yield mocks
    for p in patchers:
        p.stop()


class TestRunTeamPipeline:

    async def test_success(self, mock_team_deps):
        from backend.tasks.team_pipeline import _run_team_pipeline

        wf = MagicMock()
        wf.nodes = [MagicMock(), MagicMock()]
        mock_team_deps["get_workflow_config_by_team"].return_value = wf

        graph = MagicMock()
        graph.set_workflow = AsyncMock()
        graph.run = AsyncMock()
        graph.run.return_value = {
            "artifacts": {"_final_report": "final report"},
            "messages": [MagicMock(content="last msg")],
        }
        mock_team_deps["DynamicTeamGraph"].return_value = graph

        await _run_team_pipeline(
            requirement="build feature X",
            run_id="run-1",
            session_id="sess-1",
            team_id="team-1",
        )

        mock_team_deps["update_run_status"].assert_any_await("run-1", "in_progress")
        mock_team_deps["update_run_result"].assert_awaited_once()
        mock_team_deps["publish_run_message"].assert_awaited_once()

    async def test_no_workflow_config(self, mock_team_deps):
        from backend.tasks.team_pipeline import _run_team_pipeline
        mock_team_deps["get_workflow_config_by_team"].return_value = None

        await _run_team_pipeline(
            requirement="test",
            run_id="run-2",
            session_id=None,
            team_id="team-x",
        )

        mock_team_deps["update_run_status"].assert_not_awaited()
        mock_team_deps["update_run_result"].assert_not_awaited()

    async def test_graph_error_sets_error_status(self, mock_team_deps):
        from backend.tasks.team_pipeline import _run_team_pipeline

        wf = MagicMock()
        wf.nodes = [MagicMock()]
        mock_team_deps["get_workflow_config_by_team"].return_value = wf

        graph = MagicMock()
        graph.set_workflow = AsyncMock()
        graph.run = AsyncMock(side_effect=Exception("graph failed"))
        mock_team_deps["DynamicTeamGraph"].return_value = graph

        await _run_team_pipeline(
            requirement="test",
            run_id="run-3",
            session_id=None,
            team_id="team-1",
        )

        mock_team_deps["update_run_status"].assert_any_await("run-3", "error")

    async def test_custom_model_and_key(self, mock_team_deps):
        from backend.tasks.team_pipeline import _run_team_pipeline

        wf = MagicMock()
        wf.nodes = [MagicMock()]
        mock_team_deps["get_workflow_config_by_team"].return_value = wf

        graph = MagicMock()
        graph.set_workflow = AsyncMock()
        graph.run = AsyncMock(return_value={"artifacts": {}, "messages": []})
        mock_team_deps["DynamicTeamGraph"].return_value = graph

        await _run_team_pipeline(
            requirement="test",
            run_id="run-4",
            session_id=None,
            team_id="team-1",
            model="custom-model",
            api_key="sk-custom",
            api_base="https://custom.api",
        )

        call_kwargs = mock_team_deps["DynamicTeamGraph"].call_args[1]
        assert call_kwargs["model"] == "custom-model"
        assert call_kwargs["api_key"] == "sk-custom"
        assert call_kwargs["base_url"] == "https://custom.api"

    async def test_result_without_dict(self, mock_team_deps):
        """Graph.run returns a non-dict result — should not crash."""
        from backend.tasks.team_pipeline import _run_team_pipeline

        wf = MagicMock()
        wf.nodes = [MagicMock()]
        mock_team_deps["get_workflow_config_by_team"].return_value = wf

        graph = MagicMock()
        graph.set_workflow = AsyncMock()
        graph.run = AsyncMock(return_value="not a dict")
        mock_team_deps["DynamicTeamGraph"].return_value = graph

        await _run_team_pipeline(
            requirement="test",
            run_id="run-5",
            session_id=None,
            team_id="team-1",
        )

        mock_team_deps["update_run_result"].assert_awaited_once()

    async def test_empty_artifacts_and_messages(self, mock_team_deps):
        """Empty artifacts and messages."""
        from backend.tasks.team_pipeline import _run_team_pipeline

        wf = MagicMock()
        wf.nodes = [MagicMock()]
        mock_team_deps["get_workflow_config_by_team"].return_value = wf

        graph = MagicMock()
        graph.set_workflow = AsyncMock()
        graph.run = AsyncMock(return_value={"artifacts": {}, "messages": []})
        mock_team_deps["DynamicTeamGraph"].return_value = graph

        await _run_team_pipeline(
            requirement="test",
            run_id="run-6",
            session_id=None,
            team_id="team-1",
        )

        mock_team_deps["update_run_result"].assert_awaited_once()

    async def test_result_with_fallback_report(self, mock_team_deps):
        """When _final_report is not in artifacts, use last message content."""
        from backend.tasks.team_pipeline import _run_team_pipeline

        wf = MagicMock()
        wf.nodes = [MagicMock()]
        mock_team_deps["get_workflow_config_by_team"].return_value = wf

        graph = MagicMock()
        graph.set_workflow = AsyncMock()
        graph.run = AsyncMock(return_value={
            "artifacts": {"other": "data"},
            "messages": [MagicMock(content="fallback content")],
        })
        mock_team_deps["DynamicTeamGraph"].return_value = graph

        await _run_team_pipeline(
            requirement="test",
            run_id="run-7",
            session_id=None,
            team_id="team-1",
        )

        call_kwargs = mock_team_deps["update_run_result"].call_args[1]
        assert call_kwargs["code"] == "fallback content"
