"""Tests for prompt generation from natural language."""
from virtual_team.routers.prompts import _generate_prompt_from_description


class TestGeneratePromptFromDescription:
    def test_code_review_keyword(self):
        prompt = _generate_prompt_from_description("帮我写代码审查提示词")
        assert prompt.name == "代码审查助手"
        assert len(prompt.content) > 50

    def test_testing_keyword(self):
        prompt = _generate_prompt_from_description("生成测试工程师提示词")
        assert len(prompt.content) > 50

    def test_security_keyword(self):
        prompt = _generate_prompt_from_description("安全审计提示词")
        assert "安全" in prompt.description or "security" in prompt.description.lower()

    def test_api_keyword(self):
        prompt = _generate_prompt_from_description("API接口设计提示词")
        assert "接口" in prompt.description or "api" in prompt.description.lower()

    def test_fallback_to_custom(self):
        prompt = _generate_prompt_from_description("一些无关的描述内容")
        assert len(prompt.content) > 50

    def test_generates_consistent_id(self):
        p1 = _generate_prompt_from_description("代码审查")
        p2 = _generate_prompt_from_description("代码审查")
        assert p1.id == p2.id

    def test_different_descriptions_different_ids(self):
        p1 = _generate_prompt_from_description("代码审查")
        p2 = _generate_prompt_from_description("安全审计")
        assert p1.id != p2.id
