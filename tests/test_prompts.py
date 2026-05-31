"""Tests for role prompts (TDD Phase 3)."""

import pytest

from virtual_team.models import Role
from virtual_team.prompts import (
    get_system_prompt,
    build_pm_task,
    build_programmer_task,
    build_tester_task,
    APPROVAL_KEYWORD,
)


class TestGetSystemPrompt:
    def test_pm_prompt_contains_role(self):
        prompt = get_system_prompt(Role.PM)
        assert "产品经理" in prompt
        assert len(prompt) > 100

    def test_programmer_prompt_contains_role(self):
        prompt = get_system_prompt(Role.PROGRAMMER)
        assert "资深程序员" in prompt or "程序员" in prompt
        assert len(prompt) > 100

    def test_tester_prompt_contains_role(self):
        prompt = get_system_prompt(Role.TESTER)
        assert "测试工程师" in prompt or "测试" in prompt
        assert len(prompt) > 100

    def test_invalid_role_raises(self):
        try:
            get_system_prompt("invalid")  # type: ignore
            assert False, "Should have raised"
        except ValueError:
            pass


class TestBuildPMTask:
    def test_pm_task_contains_requirement(self):
        task = build_pm_task("写一个贪吃蛇游戏")
        assert "贪吃蛇" in task
        assert "产品需求文档" in task or "需求文档" in task

    def test_pm_task_empty_requirement(self):
        with pytest.raises(ValueError):
            build_pm_task("")

    def test_pm_task_mentions_deliverable(self):
        task = build_pm_task("计算器")
        assert len(task) > 40


class TestBuildProgrammerTask:
    def test_programmer_task_contains_pm_doc(self):
        task = build_programmer_task("## 需求文档\n计算器应用")
        assert "计算器" in task
        assert "代码" in task

    def test_programmer_task_empty_doc(self):
        with pytest.raises(ValueError):
            build_programmer_task("")

    def test_programmer_mentions_language(self):
        task = build_programmer_task("计算器", language="python")
        assert "python" in task.lower()


class TestBuildTesterTask:
    def test_tester_task_contains_code_and_doc(self):
        task = build_tester_task("## 需求\ntest", "print('hello')")
        assert "print" in task
        assert "需求" in task

    def test_tester_task_empty_code_raises(self):
        with pytest.raises(ValueError):
            build_tester_task("doc", "")


class TestApprovalKeyword:
    def test_approval_keyword_defined(self):
        assert isinstance(APPROVAL_KEYWORD, str)
        assert len(APPROVAL_KEYWORD) > 0

    def test_approval_in_prompt(self):
        prompt = get_system_prompt(Role.TESTER)
        assert APPROVAL_KEYWORD in prompt
