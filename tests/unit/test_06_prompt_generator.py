"""01-01-06 自然语言生成提示词 — 全 mock 单元测试.

隔离策略:
  - _generate_prompt_from_description 是纯函数，无外部依赖
  - 验证关键词匹配、内容生成、ID 一致性
  - 不修改被测代码
"""

from __future__ import annotations

import pytest

from virtual_team.generation.generators.prompt_generator import PromptGenerator
from virtual_team.generation.generators.base import GenerateRequest

_gen = PromptGenerator()


def _generate_prompt_from_description(desc: str):
    return _gen.generate(GenerateRequest(description=desc))


class TestGeneratePromptFromDescription:
    """功能路径: 自然语言描述 → 提示词模板."""

    def test_code_review_keyword(self):
        """含"审查"关键词 → 生成代码审查提示词."""
        result = _generate_prompt_from_description("代码审查助手，帮我审查Python代码")
        assert "代码审查" in result.name or "助手" in result.name
        assert "代码" in result.content

    def test_testing_keyword(self):
        """含"测试"关键词 → 生成测试提示词."""
        result = _generate_prompt_from_description("测试工程师，帮我写单元测试")
        assert "测试" in result.content or "test" in result.content.lower()

    def test_security_keyword(self):
        """含"安全"关键词 → 生成安全审计提示词."""
        result = _generate_prompt_from_description("安全审计，检查代码漏洞")
        assert "安全" in result.content or "security" in result.content.lower()

    def test_api_keyword(self):
        """含"API"关键词 → 生成 API 设计提示词."""
        result = _generate_prompt_from_description("API接口设计，RESTful规范")
        assert "api" in result.content.lower() or "接口" in result.content

    def test_fallback_to_custom(self):
        """无关描述 → 使用默认模板."""
        result = _generate_prompt_from_description("帮我写一个自定义内容")
        assert "自定义" in result.name
        assert len(result.content) > 10

    def test_generates_consistent_id(self):
        """相同描述 → 相同 ID."""
        id1 = _generate_prompt_from_description("代码审查").id
        id2 = _generate_prompt_from_description("代码审查").id
        assert id1 == id2

    def test_different_descriptions_different_ids(self):
        """不同描述 → 不同 ID."""
        id1 = _generate_prompt_from_description("代码审查").id
        id2 = _generate_prompt_from_description("安全审计").id
        assert id1 != id2

    def test_version_default(self):
        """未指定版本 → 默认 v1.0."""
        result = _generate_prompt_from_description("测试")
        assert result.metadata.get("version") == "v1.0"

    def test_tags_not_empty(self):
        """生成结果 → tags 有值."""
        result = _generate_prompt_from_description("代码审查")
        assert len(result.metadata.get("tags", [])) > 0
