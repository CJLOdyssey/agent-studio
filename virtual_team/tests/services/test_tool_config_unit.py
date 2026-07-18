"""Unit tests for _ToolWrapper init and build_tool_definition."""
from unittest.mock import MagicMock

import pytest

from virtual_team.services.tool_config import _ToolWrapper, ToolConfig, build_tool_definition, sanitize_tool_name


class TestSanitizeToolName:
    def test_allows_alphanumeric_and_underscores(self):
        assert sanitize_tool_name("hello_world-123") == "hello_world-123"

    def test_strips_special_chars(self):
        assert sanitize_tool_name("foo@bar#baz") == "foobarbaz"

    def test_empty_fallback(self):
        name = sanitize_tool_name("!!!")
        assert name.startswith("tool_")


class TestToolWrapperInit:
    def test_sets_all_fields(self):
        tw = _ToolWrapper(
            name="test_tool",
            description="A test",
            instructions="do stuff",
            mcp_type="remote",
            mcp_endpoint="https://mcp.example.com",
            mcp_tool_name="my_tool",
            endpoint="https://api.example.com",
            method="POST",
            headers='{"X-Api-Key": "secret"}',
        )
        assert tw.name == "test_tool"
        assert tw.description == "A test"
        assert tw.mcp_type == "remote"
        assert tw.mcp_endpoint == "https://mcp.example.com"
        assert tw.endpoint == "https://api.example.com"

    def test_llm_and_run_id_default_none(self):
        tw = _ToolWrapper(name="t")
        assert tw._llm is None
        assert tw._run_id is None


class TestResolveHandler:
    def test_mcp_when_mcp_type(self):
        tw = _ToolWrapper(name="t", mcp_type="remote")
        assert tw._resolve_handler() == "mcp"

    def test_http_when_endpoint_is_url(self):
        tw = _ToolWrapper(name="t", endpoint="https://api.example.com")
        assert tw._resolve_handler() == "http"

    def test_skill_when_instructions(self):
        tw = _ToolWrapper(name="t", instructions="do something")
        assert tw._resolve_handler() == "skill"

    def test_none_when_no_fields(self):
        tw = _ToolWrapper(name="t")
        assert tw._resolve_handler() is None


class TestBuildToolDefinition:
    def test_builds_wrapper_and_definition(self):
        tc = ToolConfig(name="my_api", description="Call API", endpoint="https://api.example.com")
        llm = MagicMock()
        api_name, wrapper, definition = build_tool_definition(tc, llm=llm)
        assert api_name == "my_api"
        assert isinstance(wrapper, _ToolWrapper)
        assert wrapper._llm is llm
        assert definition["type"] == "function"
        assert definition["function"]["name"] == "my_api"
        assert definition["function"]["description"] == "Call API"
