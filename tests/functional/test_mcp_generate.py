"""Tests for MCP generation from natural language."""

from virtual_team.generation.generators.base import GenerateRequest
from virtual_team.generation.generators.mcp_generator import McpGenerator

_gen = McpGenerator()


def _generate_mcp_from_description(desc: str):
    result = _gen.generate(GenerateRequest(description=desc))
    return result


class TestGenerateMcpFromDescription:
    def test_database_keyword(self):
        mcp = _generate_mcp_from_description("连接PostgreSQL数据库")
        assert mcp.name == "database_mcp"
        assert "database" in mcp.endpoint

    def test_search_keyword(self):
        mcp = _generate_mcp_from_description("实现网页搜索能力")
        assert mcp.name == "web_search_mcp"
        assert "search" in mcp.endpoint

    def test_file_system_keyword(self):
        mcp = _generate_mcp_from_description("文件读写操作")
        assert mcp.name == "filesystem_mcp"
        assert "filesystem" in mcp.endpoint

    def test_api_keyword(self):
        mcp = _generate_mcp_from_description("调用外部REST API")
        assert "api" in mcp.name
        assert mcp.endpoint is not None

    def test_storage_keyword(self):
        mcp = _generate_mcp_from_description("云存储文件管理")
        assert mcp.name is not None
        assert mcp.config is not None

    def test_fallback_to_custom(self):
        mcp = _generate_mcp_from_description("一些普通的描述")
        assert mcp.name == "custom_mcp"
        assert mcp.tool_filter == "(custom|execute|run)"

    def test_generates_consistent_id(self):
        m1 = _generate_mcp_from_description("连接数据库")
        m2 = _generate_mcp_from_description("连接数据库")
        assert m1.id == m2.id

    def test_different_descriptions_different_ids(self):
        m1 = _generate_mcp_from_description("连接数据库")
        m2 = _generate_mcp_from_description("网页搜索")
        assert m1.id != m2.id
