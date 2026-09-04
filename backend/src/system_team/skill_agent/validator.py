"""技能内容校验器——检查 frontmatter 与结构。"""

from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)


class SkillValidator:
    """校验技能 markdown 内容的结构完整性。"""

    @staticmethod
    def validate(content: str) -> dict[str, Any]:
        """校验技能 markdown 并返回改进建议。"""
        suggestions = []

        if "---" not in content:
            suggestions.append("缺少 YAML frontmatter")

        if "name:" not in content:
            suggestions.append("frontmatter 中缺少 name 字段")

        if "description:" not in content:
            suggestions.append("frontmatter 中缺少 description 字段")

        if "# " not in content:
            suggestions.append("建议添加一级标题")

        if "## " not in content:
            suggestions.append("建议添加二级标题划分章节")

        if len(content) < 100:
            suggestions.append("内容较短，建议补充更多细节")

        is_valid = len([s for s in suggestions if "缺少" in s]) == 0

        return {
            "is_valid": is_valid,
            "suggestions": suggestions,
        }
