"""Agent binding management endpoints (Tools, MCP, Skills)."""
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from virtual_team.repository.bindings import (
    bind_mcp,
    bind_skill,
    bind_tool,
    get_agent_mcp,
    get_agent_skills,
    get_agent_tools,
    unbind_mcp,
    unbind_skill,
    unbind_tool,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class BindToolRequest(BaseModel):
    tool_id: str
    config_override: str | None = None


class BindMcpRequest(BaseModel):
    mcp_id: str
    tool_filter: str | None = None


class BindSkillRequest(BaseModel):
    skill_id: str


class McpGenerateRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=500, description="自然语言描述")


class GeneratedMcp(BaseModel):
    id: str
    name: str
    description: str
    endpoint: str
    tool_filter: str | None = None
    config: dict


# ── Tool Binding Routes ────────────────────────────────────────

@router.post("/api/agents/{agent_id}/tools", status_code=201)
async def bind_agent_tool(agent_id: str, req: BindToolRequest):
    try:
        binding = await bind_tool(agent_id=agent_id, tool_id=req.tool_id, config_override=req.config_override)
        return {"id": binding.id, "agent_id": binding.agent_id, "tool_id": binding.tool_id, "status": "bound"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error binding tool: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/agents/{agent_id}/tools/{tool_id}")
async def unbind_agent_tool(agent_id: str, tool_id: str):
    try:
        deleted = await unbind_tool(agent_id, tool_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="未找到绑定记录")
        return {"status": "unbound"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error unbinding tool: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/agents/{agent_id}/tools")
async def list_agent_tools(agent_id: str):
    try:
        bindings = await get_agent_tools(agent_id)
        return [{"id": b.id, "tool_id": b.tool_id, "config_override": b.config_override} for b in bindings]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error listing tools: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── MCP Binding Routes ─────────────────────────────────────────

@router.post("/api/agents/{agent_id}/mcp", status_code=201)
async def bind_agent_mcp(agent_id: str, req: BindMcpRequest):
    try:
        binding = await bind_mcp(agent_id=agent_id, mcp_id=req.mcp_id, tool_filter=req.tool_filter)
        return {"id": binding.id, "agent_id": binding.agent_id, "mcp_id": binding.mcp_id, "status": "bound"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error binding MCP: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/agents/{agent_id}/mcp/{mcp_id}")
async def unbind_agent_mcp(agent_id: str, mcp_id: str):
    try:
        deleted = await unbind_mcp(agent_id, mcp_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="未找到绑定记录")
        return {"status": "unbound"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error unbinding MCP: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/agents/{agent_id}/mcp")
async def list_agent_mcp(agent_id: str):
    try:
        bindings = await get_agent_mcp(agent_id)
        return [{"id": b.id, "mcp_id": b.mcp_id, "tool_filter": b.tool_filter} for b in bindings]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error listing MCP: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── Skill Binding Routes ───────────────────────────────────────

@router.post("/api/agents/{agent_id}/skills", status_code=201)
async def bind_agent_skill(agent_id: str, req: BindSkillRequest):
    try:
        binding = await bind_skill(agent_id=agent_id, skill_id=req.skill_id)
        return {"id": binding.id, "agent_id": binding.agent_id, "skill_id": binding.skill_id, "status": "bound"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error binding skill: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/agents/{agent_id}/skills/{skill_id}")
async def unbind_agent_skill(agent_id: str, skill_id: str):
    try:
        deleted = await unbind_skill(agent_id, skill_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="未找到绑定记录")
        return {"status": "unbound"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error unbinding skill: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/agents/{agent_id}/skills")
async def list_agent_skills(agent_id: str):
    try:
        bindings = await get_agent_skills(agent_id)
        return [{"id": b.id, "skill_id": b.skill_id} for b in bindings]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error listing skills: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── MCP Generation Route ────────────────────────────────────────


@router.post("/api/mcp/generate", response_model=GeneratedMcp)
async def generate_mcp(req: McpGenerateRequest):
    try:
        from virtual_team.generation import registry
        from virtual_team.generation.generators.base import GenerateRequest as GenReq

        generator = registry.get("mcp")
        if not generator:
            raise HTTPException(status_code=500, detail="MCP generator not available")

        result = generator.generate(GenReq(description=req.description))
        return GeneratedMcp(
            id=result.id,
            name=result.name,
            description=result.description,
            endpoint=result.content,
            tool_filter=result.metadata.get("tool_filter"),
            config=result.metadata.get("config", {}),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("MCP generation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"MCP生成失败: {e}")
