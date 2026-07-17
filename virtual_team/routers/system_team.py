"""系统团队 API 路由."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from virtual_team.error_codes import ErrorCode, error_response
from virtual_team.logging_config import get_logger
from virtual_team.system_team.main import get_system_team_manager
from virtual_team.system_team.shared.llm import llm_client
from virtual_team.system_team.skill_agent.generator import SkillGenerator
from virtual_team.system_team.skill_agent.validator import SkillValidator
from virtual_team.system_team.tools_agent.generator import ToolGenerator
from virtual_team.system_team.tools_agent.validator import ToolValidator

logger = get_logger(__name__)
router = APIRouter(prefix="/api/system-team", tags=["system-team"])

tool_generator = ToolGenerator()
tool_validator = ToolValidator()
skill_generator = SkillGenerator()
skill_validator = SkillValidator()


class ToolGenerateRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    language: str = Field(default="python", pattern=r"^(python|javascript|typescript)$")


class SkillGenerateRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    category: str = Field(default="general")


@router.get("/info")
async def get_team_info() -> Any:
    manager = get_system_team_manager()
    return manager.get_team_info()


@router.get("/agents")
async def list_agents() -> Any:
    manager = get_system_team_manager()
    return manager.list_agents()


@router.get("/agents/{agent_id}/config")
async def get_agent_config(agent_id: str) -> Any:
    manager = get_system_team_manager()
    config = manager.get_agent_config(agent_id)
    if config is None:
        raise error_response(ErrorCode.AGENT_NOT_FOUND, detail="Agent 不存在")
    return config


@router.get("/agents/{agent_id}/tools")
async def list_agent_tools(agent_id: str) -> Any:
    manager = get_system_team_manager()
    return manager.get_agent_tools(agent_id)


@router.get("/agents/{agent_id}/skills")
async def list_agent_skills(agent_id: str) -> Any:
    manager = get_system_team_manager()
    return manager.get_agent_skills(agent_id)


@router.get("/shared")
async def list_shared_resources() -> Any:
    manager = get_system_team_manager()
    return manager.get_shared_resources()


@router.get("/llm/status")
async def get_llm_status() -> Any:
    return {"available": llm_client.is_available()}


@router.post("/tools/generate")
async def generate_tool(req: ToolGenerateRequest) -> Any:
    try:
        result = await tool_generator.generate_with_llm(req.description, req.language)
        return result
    except Exception as e:
        logger.error("Tool generation failed: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.post("/tools/save")
async def save_tool(tool_data: dict[str, Any]) -> Any:
    try:
        path = tool_generator.save_tool(tool_data)
        return {"success": True, "path": str(path)}
    except Exception as e:
        logger.error("Tool save failed: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.post("/skills/generate")
async def generate_skill(req: SkillGenerateRequest) -> Any:
    try:
        result = skill_generator.generate(req.description, req.category)
        return result
    except Exception as e:
        logger.error("Skill generation failed: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.post("/skills/save")
async def save_skill(skill_data: dict[str, Any]) -> Any:
    try:
        path = skill_generator.save_skill(skill_data)
        return {"success": True, "path": str(path)}
    except Exception as e:
        logger.error("Skill save failed: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e
