"""Tests for CLI entry point (main.py)."""
import sys
from unittest.mock import patch

from virtual_team.main import _build_context, main


class TestBuildContext:
    def test_empty_memories(self):
        assert _build_context([]) == ""

    def test_with_memories(self):
        memories = [
            type("M", (), {"content_type": "pm_document", "agent_role": "pm", "summary": "需求A"})(),
            type("M", (), {"content_type": "code", "agent_role": "programmer", "summary": "代码B"})(),
        ]
        result = _build_context(memories)
        assert "【历史上下文】" in result
        assert "需求A" in result
        assert "代码B" in result
        assert "pm_document" in result

    def test_context_format(self):
        memories = [
            type("M", (), {"content_type": "review", "agent_role": "tester", "summary": "OK"})(),
        ]
        result = _build_context(memories)
        assert result.startswith("\n\n")
        assert "[review]" in result


class TestMainCLI:
    def test_main_no_args_returns_error(self):
        with patch.object(sys, "argv", ["main.py"]):
            assert main() == 1

    def test_main_with_requirement_too_long_returns_error(self, mocker):
        mock_cfg = mocker.Mock()
        mock_cfg.max_requirement_length = 2000
        mocker.patch("virtual_team.main.load_config", return_value=mock_cfg)
        long_req = "a" * 3000
        with patch.object(sys, "argv", ["main.py", long_req]):
            assert main() == 1

    def test_main_runs_cli_successfully(self, mocker):
        mock_cfg = mocker.Mock()
        mock_cfg.max_requirement_length = 2000
        mocker.patch("virtual_team.main.load_config", return_value=mock_cfg)
        mocker.patch("virtual_team.main.run_cli", return_value={"requirement": "hello"})
        with patch.object(sys, "argv", ["main.py", "hello"]):
            assert main() == 0

    def test_main_handles_run_cli_error(self, mocker):
        mock_cfg = mocker.Mock()
        mock_cfg.max_requirement_length = 2000
        mocker.patch("virtual_team.main.load_config", return_value=mock_cfg)
        mocker.patch("virtual_team.main.run_cli", side_effect=RuntimeError("fail"))
        with patch.object(sys, "argv", ["main.py", "test"]):
            assert main() == 1
