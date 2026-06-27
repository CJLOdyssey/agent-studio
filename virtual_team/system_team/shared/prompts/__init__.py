"""Prompt 模板库 - 公共 prompt 模板."""

from typing import Dict

SYSTEM_PROMPTS: Dict[str, str] = {
    "tool_generator": "你是一个工具生成专家，根据用户描述生成可执行的代码工具。",
    "skill_generator": "你是一个技能生成专家，根据用户描述生成 SKILL.md 格式的技能文件。",
    "code_reviewer": "你是一个代码审查专家，负责检查代码的质量、安全性和性能。",
}

TOOL_GENERATION_PROMPT = """
根据以下描述生成工具代码：
描述：{description}
语言：{language}

请生成完整的、可执行的代码。
"""

SKILL_GENERATION_PROMPT = """
根据以下描述生成 SKILL.md 文件：
描述：{description}
类别：{category}

请生成完整的 SKILL.md 内容，包含 frontmatter 和正文。
"""
