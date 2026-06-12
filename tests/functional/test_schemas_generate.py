"""Tests for schema generation from natural language."""

from virtual_team.generation.generators.base import GenerateRequest
from virtual_team.generation.generators.schema_generator import SchemaGenerator

_gen = SchemaGenerator()


def _generate_schema_from_description(desc: str, fmt: str = "json"):
    return _gen.generate(GenerateRequest(description=desc, context={"format_type": fmt}))


class TestGenerateSchemaFromDescription:
    def test_prd_keyword(self):
        schema = _generate_schema_from_description("帮我生成PRD文档模板", "json")
        assert schema.name == "prd-output"
        assert schema.schema_def is not None

    def test_code_review_keyword(self):
        schema = _generate_schema_from_description("代码审查报告模板", "json")
        assert schema.name == "code-review-output"
        assert schema.schema_def is not None

    def test_test_report_keyword(self):
        schema = _generate_schema_from_description("生成测试报告模板", "json")
        assert schema.name == "test-report-output"

    def test_technical_design_keyword(self):
        schema = _generate_schema_from_description("技术方案设计文档模板", "json")
        assert schema.name == "technical-design-output"

    def test_fallback_to_custom(self):
        schema = _generate_schema_from_description("一些普通的描述内容", "json")
        assert schema.name == "custom-output"

    def test_generates_consistent_id(self):
        s1 = _generate_schema_from_description("PRD文档", "json")
        s2 = _generate_schema_from_description("PRD文档", "json")
        assert s1.id == s2.id

    def test_different_descriptions_different_ids(self):
        s1 = _generate_schema_from_description("PRD文档", "json")
        s2 = _generate_schema_from_description("测试报告", "json")
        assert s1.id != s2.id
