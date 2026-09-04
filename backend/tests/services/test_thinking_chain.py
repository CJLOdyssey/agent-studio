"""Tests for services/thinking_chain.py — get_tool_prefix, format_result_preview, build_config_thinking."""

import json

import pytest

from services.thinking_chain import build_config_thinking, format_result_preview, get_tool_prefix


class TestGetToolPrefix:
    def test_mcp_tool_prefix(self):
        assert get_tool_prefix("mcp_github_list_repos") == "[mcp]"

    def test_skill_tool_prefix(self):
        assert get_tool_prefix("skill_playwright_run") == "[skill]"

    def test_regular_tool_prefix(self):
        assert get_tool_prefix("bash") == "[tools]"

    def test_regular_tool_with_underscore(self):
        assert get_tool_prefix("read_file") == "[tools]"

    def test_empty_string(self):
        assert get_tool_prefix("") == "[tools]"

    def test_mcp_only_prefix(self):
        assert get_tool_prefix("mcp_") == "[mcp]"


class TestFormatResultPreview:
    def test_dict_strips_tool_and_query(self):
        result = format_result_preview({"tool": "bash", "query": "ls", "output": "file.txt"})
        parsed = json.loads(result)
        assert "tool" not in parsed
        assert "query" not in parsed
        assert parsed["output"] == "file.txt"

    def test_dict_all_fields_stripped(self):
        result = format_result_preview({"tool": "x", "query": "y"})
        assert result == "{}"

    def test_string_passthrough(self):
        assert format_result_preview("hello") == "hello"

    def test_empty_string_returns_empty_placeholder(self):
        assert format_result_preview("") == "(empty)"

    def test_none_returns_empty_placeholder(self):
        assert format_result_preview(None) == "(empty)"

    def test_dict_json_string_strips_fields(self):
        # ToolWrapper serializes dict to JSON string
        data = {"tool": "bash", "query": "ls", "result": "ok"}
        text = json.dumps(data)
        result = format_result_preview(text)
        parsed = json.loads(result)
        assert "tool" not in parsed
        assert "query" not in parsed
        assert parsed["result"] == "ok"

    def test_non_json_string_passthrough(self):
        assert format_result_preview("not json {broken}") == "not json {broken}"

    def test_max_len_truncation(self):
        result = format_result_preview("a" * 100, max_len=10)
        assert len(result) == 13  # 10 + "..."
        assert result.endswith("...")

    def test_max_len_no_truncation_when_short(self):
        result = format_result_preview("short", max_len=100)
        assert result == "short"

    def test_max_len_zero_no_truncation(self):
        result = format_result_preview("a" * 200, max_len=0)
        assert len(result) == 200

    def test_non_dict_non_string_input(self):
        result = format_result_preview(42)
        assert result == "42"

    def test_dict_strips_url_key(self):
        result = format_result_preview('{"tool": "fetch", "url": "http://x.com", "data": "ok"}')
        parsed = json.loads(result)
        assert "url" not in parsed
        assert parsed["data"] == "ok"


class TestBuildConfigThinking:
    def test_empty_inputs(self):
        result = build_config_thinking("", [])
        assert result == ""

    def test_system_prompt_only(self):
        result = build_config_thinking("You are helpful", [])
        assert "系统提示词" in result
        assert "You are helpful" in result

    def test_system_prompt_long_truncated(self):
        long_prompt = "A" * 200
        result = build_config_thinking(long_prompt, [])
        assert "..." in result

    def test_output_constraints_extracted(self):
        prompt = "Be nice\n输出约束：No profanity"
        result = build_config_thinking(prompt, [])
        assert "输出约束" in result
        assert "No profanity" in result

    def test_regular_tools(self):
        tools = [{"function": {"name": "bash"}}, {"function": {"name": "read_file"}}]
        result = build_config_thinking("sys", tools)
        assert "[tools] 可用工具" in result
        assert "bash" in result
        assert "read_file" in result

    def test_mcp_tools_grouped(self):
        tools = [
            {"function": {"name": "mcp_github_list"}},
            {"function": {"name": "mcp_github_search"}},
        ]
        result = build_config_thinking("sys", tools)
        assert "[mcp] MCP 服务" in result
        assert "github" in result

    def test_skill_tools_grouped(self):
        tools = [{"function": {"name": "skill_playwright_run"}}]
        result = build_config_thinking("sys", tools)
        assert "[skill] Skills" in result
        assert "playwright_run" in result

    def test_mixed_tool_categories(self):
        tools = [
            {"function": {"name": "bash"}},
            {"function": {"name": "mcp_github_list"}},
            {"function": {"name": "skill_playwright"}},
        ]
        result = build_config_thinking("sys", tools)
        assert "[tools]" in result
        assert "[mcp]" in result
        assert "[skill]" in result

    def test_tool_with_empty_name_ignored(self):
        tools = [{"function": {"name": ""}}, {"function": {}}]
        result = build_config_thinking("sys", tools)
        # No tools section should appear for empty names
        assert "bash" not in result

    def test_segments_separated_by_double_newline(self):
        tools = [{"function": {"name": "bash"}}]
        result = build_config_thinking("System prompt", tools)
        segments = [s for s in result.split("\n\n") if s.strip()]
        assert len(segments) >= 2  # prompt + tools
