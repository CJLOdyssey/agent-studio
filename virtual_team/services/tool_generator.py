"""Tool generation service: Generate tools from natural language descriptions."""

from typing import Any

from pydantic import BaseModel

from virtual_team.services.generators import GeneratedTool, _generate_javascript_tool, _generate_python_tool


class ToolValidateRequest(BaseModel):
    code: str
    language: str = "python"


class ToolValidateResponse(BaseModel):
    is_valid: bool
    error_message: str | None = None
    suggestions: list[str] = []


def _generate_tool_from_description(description: str, language: str) -> GeneratedTool:
    import hashlib

    tool_id = f"tool_{hashlib.md5(description.encode()).hexdigest()[:8]}"

    if language == "python":
        return _generate_python_tool(tool_id, description)
    else:
        return _generate_javascript_tool(tool_id, description)


def _validate_tool_code(code: str, language: str) -> ToolValidateResponse:
    suggestions = []

    if language == "python":
        if "def " not in code:
            suggestions.append("建议添加函数定义")
        if '"""' not in code and "'''" not in code:
            suggestions.append("建议添加文档字符串（docstring）")
        if "import" not in code:
            suggestions.append("检查是否需要导入模块")
        if "try" not in code and "except" not in code:
            suggestions.append("建议添加异常处理")

    elif language in ["javascript", "typescript"]:
        if "function " not in code and "=>" not in code:
            suggestions.append("建议添加函数定义")
        if "/**" not in code:
            suggestions.append("建议添加JSDoc注释")
        if "try" not in code and "catch" not in code:
            suggestions.append("建议添加异常处理")

    is_valid = len(suggestions) == 0 or (len(suggestions) <= 1 and "建议添加" in suggestions[0])

    return ToolValidateResponse(
        is_valid=is_valid,
        error_message=None if is_valid else "代码需要优化",
        suggestions=suggestions,
    )


def _execute_tool_sandbox(code: str, language: str) -> str:
    if language == "python":
        try:
            namespace: list[Any] = {}  # type: ignore[assignment]
            exec(code, namespace)  # type: ignore[arg-type]
            return "代码语法检查通过"
        except SyntaxError as e:
            raise Exception(f"语法错误: {e}") from e
        except Exception as e:
            raise Exception(f"执行错误: {e}") from e
    else:
        return "JavaScript代码验证需要Node.js环境"
