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
        mcp = _generate_mcp_from_description(req.description)
        return mcp
    except Exception as e:
        logger.error("MCP generation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"MCP生成失败: {e}")


def _generate_mcp_from_description(description: str) -> GeneratedMcp:
    import hashlib

    mcp_id = f"mcp_{hashlib.md5(description.encode()).hexdigest()[:8]}"  # nosec
    desc_lower = description.lower()

    if any(kw in desc_lower for kw in ['database', '数据库', 'sql', 'db', 'mongo', 'postgres', 'mysql', 'redis']):
        name = "database_mcp"
        desc = "数据库操作MCP服务器"
        endpoint = "http://localhost:8001/mcp/database"
        tool_filter = "(db|query|table|schema|insert|select|update|delete)"
        config = {
            "type": "database",
            "driver": "postgresql",
            "pool_size": 10,
            "timeout": 30,
            "max_connections": 20,
        }

    elif any(kw in desc_lower for kw in ['search', '搜索', 'web', '网页', 'browser', '浏览', 'google', 'bing']):
        name = "web_search_mcp"
        desc = "网页搜索MCP服务器"
        endpoint = "http://localhost:8001/mcp/web-search"
        tool_filter = "(search|query|browse|fetch|scrape|lookup)"
        config = {
            "type": "web_search",
            "engine": "google",
            "max_results": 10,
            "timeout": 15,
            "user_agent": "MCP-WebSearch/1.0",
        }

    elif any(kw in desc_lower for kw in ['file', '文件', 'fs', 'filesystem', 'directory', '目录', 'path', 'read', 'write']):
        name = "filesystem_mcp"
        desc = "文件系统MCP服务器"
        endpoint = "http://localhost:8001/mcp/filesystem"
        tool_filter = "(file|read|write|list|mkdir|delete|move|copy|stat)"
        config = {
            "type": "filesystem",
            "root_path": "/workspace",
            "allowed_extensions": ["*"],
            "max_file_size_mb": 100,
            "readonly": False,
        }

    elif any(kw in desc_lower for kw in ['api', 'rest', 'http', '接口', 'external', '外部', 'graphql']):
        name = "external_api_mcp"
        desc = "外部API调用MCP服务器"
        endpoint = "http://localhost:8001/mcp/api"
        tool_filter = "(api|request|fetch|post|get|put|patch|delete)"
        config = {
            "type": "api_gateway",
            "base_url": "https://api.example.com",
            "auth_type": "bearer",
            "rate_limit": 100,
            "retry_count": 3,
            "timeout": 30,
        }

    elif any(kw in desc_lower for kw in ['ai', 'llm', '人工智能', 'gpt', 'claude', 'model', '模型', 'chat', '对话', '语言模型']):
        name = "llm_mcp"
        desc = "LLM大语言模型MCP服务器"
        endpoint = "http://localhost:8001/mcp/llm"
        tool_filter = "(chat|complete|embed|generate|tokenize|classify|summarize)"
        config = {
            "type": "llm",
            "provider": "openai",
            "model": "gpt-4",
            "max_tokens": 4096,
            "temperature": 0.7,
            "streaming": True,
        }

    elif any(kw in desc_lower for kw in ['storage', '存储', 'bucket', 's3', 'oss', 'cloud', 'upload', 'download']):
        name = "storage_mcp"
        desc = "云存储MCP服务器"
        endpoint = "http://localhost:8001/mcp/storage"
        tool_filter = "(upload|download|delete|list|bucket|object|presign)"
        config = {
            "type": "storage",
            "provider": "s3",
            "region": "us-east-1",
            "bucket": "default-bucket",
            "acl": "private",
            "presigned_url_expiry": 3600,
        }

    else:
        name = "custom_mcp"
        desc = "自定义MCP服务器"
        endpoint = "http://localhost:8001/mcp/custom"
        tool_filter = "(custom|execute|run)"
        config = {
            "type": "custom",
            "runtime": "python",
            "entrypoint": "main.py",
            "sandbox": True,
            "timeout": 60,
        }

    return GeneratedMcp(
        id=mcp_id,
        name=name,
        description=desc,
        endpoint=endpoint,
        tool_filter=tool_filter,
        config=config,
    )
