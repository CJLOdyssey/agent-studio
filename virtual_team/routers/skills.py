"""Skill generation API routes: Generate SKILL.md from natural language."""

import hashlib

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from virtual_team.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["skills"])


class SkillGenerateRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=500, description="自然语言描述")
    category: str = Field(default="general", description="Skill 类别")


class GeneratedSkill(BaseModel):
    id: str
    name: str
    description: str
    content: str
    category: str
    is_valid: bool
    error_message: str | None = None


class SkillValidateRequest(BaseModel):
    content: str


class SkillValidateResponse(BaseModel):
    is_valid: bool
    error_message: str | None = None
    suggestions: list[str] = []


@router.post("/api/skills/generate", response_model=GeneratedSkill)
async def generate_skill(req: SkillGenerateRequest):
    try:
        from virtual_team.generation import registry
        from virtual_team.generation.generators.base import GenerateRequest as GenReq

        generator = registry.get("skill")
        if not generator:
            raise HTTPException(status_code=500, detail="Skill generator not available")

        result = generator.generate(GenReq(description=req.description, context={"category": req.category}))
        return GeneratedSkill(
            id=result.id,
            name=result.name,
            description=result.description,
            content=result.content,
            category=result.metadata.get("category", "general"),
            is_valid=result.metadata.get("is_valid", True),
            error_message=result.metadata.get("error_message"),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Skill generation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Skill 生成失败: {e}")


@router.post("/api/skills/validate", response_model=SkillValidateResponse)
async def validate_skill(req: SkillValidateRequest):
    try:
        result = _validate_skill_content(req.content)
        return result
    except Exception as e:
        logger.error("Skill validation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"验证失败: {e}")

    skill_id = f"skill_{hashlib.md5(description.encode()).hexdigest()[:8]}"  # nosec

    if any(kw in desc_lower for kw in ['代码审查', 'code review', '审查', 'review']):
        return _generate_code_review_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ['安全', 'security', '漏洞', 'vulnerability']):
        return _generate_security_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ['api', '接口', '接口设计', 'restful']):
        return _generate_api_design_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ['测试', 'test', '单元测试', 'unit test']):
        return _generate_testing_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ['文档', 'documentation', 'readme']):
        return _generate_documentation_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ['性能', 'performance', '优化', 'optimization']):
        return _generate_performance_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ['重构', 'refactor', '代码质量']):
        return _generate_refactoring_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ['git', '提交', 'commit', '版本控制']):
        return _generate_git_workflow_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ['数据库', 'database', 'sql', '迁移']):
        return _generate_database_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ['部署', 'deploy', 'ci/cd', 'docker']):
        return _generate_deployment_skill(skill_id, description)
    else:
        return _generate_custom_skill(skill_id, description)



def _validate_skill_content(content: str) -> SkillValidateResponse:
    suggestions = []

    if "---" not in content:
        suggestions.append("缺少 YAML frontmatter（用 --- 包围）")

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

    return SkillValidateResponse(
        is_valid=is_valid,
        suggestions=suggestions
    )
