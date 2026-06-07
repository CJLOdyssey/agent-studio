"""Tests for skill generation API routes."""
from virtual_team.routers.skills import (
    _generate_skill_from_description,
    _validate_skill_content,
)


class TestGenerateSkillFromDescription:
    def test_code_review_keyword(self):
        skill = _generate_skill_from_description("我需要代码审查能力", "code-quality")
        assert skill.name == "code-review-standard"
        assert skill.is_valid

    def test_security_keyword(self):
        skill = _generate_skill_from_description("安全漏洞扫描", "security")
        assert skill.name == "security-audit"
        assert skill.is_valid

    def test_api_keyword(self):
        skill = _generate_skill_from_description("设计RESTful API接口", "general")
        assert skill.is_valid
        assert "api" in skill.name

    def test_testing_keyword(self):
        skill = _generate_skill_from_description("编写单元测试", "testing")
        assert skill.is_valid
        assert "test" in skill.name

    def test_documentation_keyword(self):
        skill = _generate_skill_from_description("生成项目文档", "docs")
        assert skill.is_valid
        assert "doc" in skill.name

    def test_performance_keyword(self):
        skill = _generate_skill_from_description("性能优化检查", "performance")
        assert skill.is_valid

    def test_refactoring_keyword(self):
        skill = _generate_skill_from_description("代码重构建议", "refactor")
        assert skill.is_valid

    def test_git_keyword(self):
        skill = _generate_skill_from_description("git提交规范", "git")
        assert skill.is_valid

    def test_database_keyword(self):
        skill = _generate_skill_from_description("数据库迁移脚本", "database")
        assert skill.is_valid

    def test_deployment_keyword(self):
        skill = _generate_skill_from_description("Docker部署配置", "deploy")
        assert skill.is_valid

    def test_fallback_to_custom(self):
        skill = _generate_skill_from_description("一些无关的描述", "general")
        assert skill.is_valid
        # fallback 使用 description 前 30 字符作为 name
        assert skill.name == "一些无关的描述"

    def test_generates_consistent_id(self):
        skill1 = _generate_skill_from_description("代码审查", "code-quality")
        skill2 = _generate_skill_from_description("代码审查", "code-quality")
        assert skill1.id == skill2.id

    def test_different_descriptions_different_ids(self):
        skill1 = _generate_skill_from_description("代码审查", "code-quality")
        skill2 = _generate_skill_from_description("安全审计", "security")
        assert skill1.id != skill2.id


class TestValidateSkillContent:
    def test_valid_skill_with_frontmatter(self):
        content = """---
name: test-skill
description: a test
---

# Content
"""
        result = _validate_skill_content(content)
        assert result.is_valid

    def test_skill_without_frontmatter_is_invalid(self):
        content = "# Just content"
        result = _validate_skill_content(content)
        assert not result.is_valid
        assert "frontmatter" in result.suggestions[0]

    def test_empty_content_is_invalid(self):
        result = _validate_skill_content("")
        assert not result.is_valid

    def test_invalid_yaml_frontmatter_returns_suggestions(self):
        content = """---
invalid: unclosed
"""
        result = _validate_skill_content(content)
        assert not result.is_valid
        assert result.suggestions
