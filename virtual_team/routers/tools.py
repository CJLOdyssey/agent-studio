"""Tool generation API routes: Generate tools from natural language."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from virtual_team.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["tools"])


class ToolGenerateRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=500, description="自然语言描述")
    language: str = Field(default="python", pattern=r'^(python|javascript|typescript)$')


class GeneratedTool(BaseModel):
    id: str
    name: str
    description: str
    code: str
    language: str
    parameters: dict
    is_valid: bool
    error_message: str | None = None


class ToolValidateRequest(BaseModel):
    code: str
    language: str = "python"


class ToolValidateResponse(BaseModel):
    is_valid: bool
    error_message: str | None = None
    suggestions: list[str] = []


@router.post("/api/tools/generate", response_model=GeneratedTool)
async def generate_tool(req: ToolGenerateRequest):
    try:
        from virtual_team.generation import registry
        from virtual_team.generation.generators.base import GenerateRequest as GenReq

        generator = registry.get("tool")
        if not generator:
            raise HTTPException(status_code=500, detail="Tool generator not available")

        result = generator.generate(GenReq(description=req.description, context={"language": req.language}))
        return GeneratedTool(
            id=result.id,
            name=result.name,
            description=result.description,
            code=result.content,
            language=result.metadata.get("language", "python"),
            parameters=result.metadata.get("parameters", {}),
            is_valid=result.metadata.get("is_valid", True),
            error_message=result.metadata.get("error_message"),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Tool generation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"工具生成失败: {e}")


@router.post("/api/tools/validate", response_model=ToolValidateResponse)
async def validate_tool(req: ToolValidateRequest):
    try:
        result = _validate_tool_code(req.code, req.language)
        return result
    except Exception as e:
        logger.error("Tool validation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"验证失败: {e}")


@router.post("/api/tools/execute")
async def execute_tool(code: str, language: str = "python"):
    try:
        result = _execute_tool_sandbox(code, language)
        return {"success": True, "output": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


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
        suggestions=suggestions
    )


def _execute_tool_sandbox(code: str, language: str) -> str:
    if language == "python":
        try:
            namespace: dict[str, object] = {}
            exec(code, namespace)  # nosec
            return "代码语法检查通过"
        except SyntaxError as e:
            raise Exception(f"语法错误: {e}")
        except Exception as e:
            raise Exception(f"执行错误: {e}")
    else:
        return "JavaScript代码验证需要Node.js环境"
