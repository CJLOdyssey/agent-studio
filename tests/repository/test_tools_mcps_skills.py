"""Repository tests for Tools, MCPs, and Skills CRUD operations."""

import uuid

import pytest

from backend.repository.mcps import (
    create_mcp,
    delete_mcp,
    get_mcps,
    update_mcp,
)
from backend.repository.skills import (
    create_skill,
    delete_skill,
    get_skills,
    update_skill,
)
from backend.repository.tools import (
    create_tool,
    delete_tool,
    get_tools,
    update_tool,
)

# ──────────────────────────────────────────────────────────────────────────────
# Tools tests
# ──────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_tool(db_engine):
    """create_tool persists a RegisteredToolDB row."""
    tool = await create_tool(
        {
            "name": f"tool-{uuid.uuid4().hex[:6]}",
            "category": "utility",
            "description": "A test tool",
            "endpoint": "/api/tools/test",
        }
    )
    assert tool is not None
    assert tool.id is not None
    assert tool.name.startswith("tool-")
    assert tool.category == "utility"
    assert tool.status == "active"


@pytest.mark.asyncio
async def test_list_tools(db_engine):
    """get_tools returns a list of dicts with expected keys."""
    await create_tool(
        {
            "name": f"list-tool-{uuid.uuid4().hex[:6]}",
            "category": "search",
            "description": "List test",
            "endpoint": "",
        }
    )
    tools = await get_tools()
    assert isinstance(tools, list)
    assert len(tools) >= 1
    first = tools[0]
    assert "id" in first
    assert "name" in first
    assert "category" in first
    assert "description" in first
    assert "endpoint" in first
    assert "parameters" in first


@pytest.mark.asyncio
async def test_update_tool_description(db_engine):
    """update_tool modifies the description field."""
    tool = await create_tool(
        {
            "name": f"update-tool-{uuid.uuid4().hex[:6]}",
            "category": "data",
            "description": "Original desc",
            "endpoint": "",
        }
    )
    updated = await update_tool(tool.id, {"description": "Updated desc"})
    assert updated is not None
    assert updated.description == "Updated desc"


@pytest.mark.asyncio
async def test_delete_tool(db_engine):
    """delete_tool removes the tool and returns True."""
    tool = await create_tool(
        {
            "name": f"del-tool-{uuid.uuid4().hex[:6]}",
            "category": "test",
            "description": "Delete me",
            "endpoint": "",
        }
    )
    deleted = await delete_tool(tool.id)
    assert deleted is True
    tools = await get_tools()
    assert all(t["id"] != tool.id for t in tools)


# ──────────────────────────────────────────────────────────────────────────────
# MCP tests
# ──────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_mcp(db_engine):
    """create_mcp persists an MCPServerDB row."""
    mcp = await create_mcp(
        {
            "name": f"mcp-{uuid.uuid4().hex[:6]}",
            "type": "stdio",
            "endpoint": "/usr/local/bin/my-tool",
        }
    )
    assert mcp is not None
    assert mcp.id is not None
    assert mcp.name.startswith("mcp-")
    assert mcp.type == "stdio"


@pytest.mark.asyncio
async def test_list_mcps(db_engine):
    """get_mcps returns a list of dicts with expected keys."""
    await create_mcp(
        {
            "name": f"list-mcp-{uuid.uuid4().hex[:6]}",
            "type": "sse",
            "endpoint": "http://localhost:8080/mcp",
        }
    )
    mcps = await get_mcps()
    assert isinstance(mcps, list)
    assert len(mcps) >= 1
    first = mcps[0]
    assert "id" in first
    assert "name" in first
    assert "type" in first
    assert "endpoint" in first
    assert "status" in first


@pytest.mark.asyncio
async def test_update_mcp_endpoint(db_engine):
    """update_mcp modifies the endpoint field."""
    mcp = await create_mcp(
        {
            "name": f"update-mcp-{uuid.uuid4().hex[:6]}",
            "type": "sse",
            "endpoint": "http://old.local",
        }
    )
    updated = await update_mcp(mcp.id, {"endpoint": "http://new.local"})
    assert updated is not None
    assert updated.endpoint == "http://new.local"


@pytest.mark.asyncio
async def test_delete_mcp(db_engine):
    """delete_mcp removes the MCP server and returns True."""
    mcp = await create_mcp(
        {
            "name": f"del-mcp-{uuid.uuid4().hex[:6]}",
            "type": "stdio",
            "endpoint": "/bin/echo",
        }
    )
    deleted = await delete_mcp(mcp.id)
    assert deleted is True
    mcps = await get_mcps()
    assert all(m["id"] != mcp.id for m in mcps)


# ──────────────────────────────────────────────────────────────────────────────
# Skills tests
# ──────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_skill(db_engine):
    """create_skill persists a RegisteredSkillDB row."""
    skill = await create_skill(
        {
            "name": f"skill-{uuid.uuid4().hex[:6]}",
            "category": "coding",
            "content": "A test skill",
            "instructions": "Write clean code.",
            "author": "test",
        }
    )
    assert skill is not None
    assert skill.id is not None
    assert skill.name.startswith("skill-")
    assert skill.category == "coding"
    assert skill.status == "active"


@pytest.mark.asyncio
async def test_list_skills(db_engine):
    """get_skills returns a list of dicts with expected keys."""
    await create_skill(
        {
            "name": f"list-skill-{uuid.uuid4().hex[:6]}",
            "category": "debugging",
            "content": "Test listing",
            "instructions": "Debug carefully.",
            "author": "test",
        }
    )
    skills = await get_skills()
    assert isinstance(skills, list)
    assert len(skills) >= 1
    first = skills[0]
    assert "id" in first
    assert "name" in first
    assert "category" in first
    assert "description" in first
    assert "instructions" in first
    assert "version" in first
    assert "author" in first
    assert "status" in first


@pytest.mark.asyncio
async def test_update_skill_instructions(db_engine):
    """update_skill modifies the instructions field."""
    skill = await create_skill(
        {
            "name": f"update-skill-{uuid.uuid4().hex[:6]}",
            "category": "testing",
            "content": "Original",
            "instructions": "Original instructions.",
            "author": "test",
        }
    )
    updated = await update_skill(skill.id, {"instructions": "Updated instructions."})
    assert updated is not None
    assert updated.instructions == "Updated instructions."


@pytest.mark.asyncio
async def test_delete_skill(db_engine):
    """delete_skill removes the skill and returns True."""
    skill = await create_skill(
        {
            "name": f"del-skill-{uuid.uuid4().hex[:6]}",
            "category": "docs",
            "content": "Delete me",
            "instructions": "To be removed.",
            "author": "test",
        }
    )
    deleted = await delete_skill(skill.id)
    assert deleted is True
    skills = await get_skills()
    assert all(s["id"] != skill.id for s in skills)
