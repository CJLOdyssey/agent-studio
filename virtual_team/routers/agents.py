"""Agent config API routes: CRUD and toggle."""

import json
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from virtual_team.core.audit import log_audit
from virtual_team.auth import CurrentUser, get_current_user
from virtual_team.core.error_codes import ErrorCode, error_response
from virtual_team.core.logging_config import get_logger
from virtual_team.repository import (
    create_agent_config,
    delete_agent_config,
    get_agent_config,
    get_agent_config_by_role,
    get_agent_configs,
    update_agent_config,
)

logger = get_logger(__name__)
router = APIRouter(tags=["agents"])


class AgentCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    role_identifier: str = Field(..., min_length=1, max_length=64)
    system_prompt: str = Field(default="")
    output_constraints: str | None = None
    tools: list[dict[str, Any]] | None = None
    mcp: list[dict[str, Any]] | None = None
    skills: list[dict[str, Any]] | None = None
    model: str | None = None
    temperature: float | None = Field(default=None, ge=0.0, le=1.0)
    order: int = 0
    is_active: bool = True
    is_approver: bool = False
    icon: str = "🤖"


class AgentUpdateRequest(BaseModel):
    name: str | None = None
    system_prompt: str | None = None
    output_constraints: str | None = None
    tools: list[dict[str, Any]] | None = None
    mcp: list[dict[str, Any]] | None = None
    skills: list[dict[str, Any]] | None = None
    order: int | None = None
    is_active: bool | None = None
    is_approver: bool | None = None
    icon: str | None = None
    model: str | None = None
    temperature: float | None = Field(default=None, ge=0.0, le=1.0)


@router.get("/api/agents")
async def list_agents() -> Any:
    try:
        configs = await get_agent_configs()
        return [
            {
                "id": c.id,
                "name": c.name,
                "role_identifier": c.role_identifier,
                "system_prompt": c.system_prompt,
                "output_constraints": c.output_constraints,
                "tools": c.tools,
                "mcp": c.mcp,
                "skills": c.skills,
                "model": c.model,
                "temperature": c.temperature,
                "order": c.order,
                "is_active": c.is_active,
                "is_approver": c.is_approver,
                "icon": c.icon,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in configs
        ]
    except Exception as e:
        logger.error("Error listing agents: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.get("/api/agents/{agent_id}")
async def get_agent(agent_id: str) -> Any:
    configs = await get_agent_configs()
    c = next((x for x in configs if x.id == agent_id), None)
    if not c:
        raise error_response(ErrorCode.AGENT_NOT_FOUND, detail="未找到该 agent 配置")

    def _parse_json(val: Any) -> Any:
        if isinstance(val, str):
            try:
                return json.loads(val)
            except (json.JSONDecodeError, TypeError):
                return []
        return val or []

    return {
        "id": c.id,
        "name": c.name,
        "role_identifier": c.role_identifier,
        "system_prompt": c.system_prompt,
        "output_constraints": c.output_constraints,
        "tools": _parse_json(c.tools),
        "mcp": _parse_json(c.mcp),
        "skills": _parse_json(c.skills),
        "model": c.model,
        "temperature": c.temperature,
        "order": c.order,
        "is_active": c.is_active,
        "is_approver": c.is_approver,
        "icon": c.icon,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.post("/api/agents", status_code=201)
async def add_agent(req: AgentCreateRequest, current_user: CurrentUser = Depends(get_current_user)) -> Any:  # noqa: B008
    existing = await get_agent_config_by_role(req.role_identifier)
    if existing:
        raise error_response(ErrorCode.AGENT_DUPLICATE, detail=f"角色标识 '{req.role_identifier}' 已存在")
    try:

        created = await create_agent_config(
            name=req.name,
            role_identifier=req.role_identifier,
            system_prompt=req.system_prompt,
            output_constraints=req.output_constraints,
            tools=json.dumps(req.tools) if req.tools else None,
            mcp=json.dumps(req.mcp) if req.mcp else None,
            skills=json.dumps(req.skills) if req.skills else None,
            order=req.order,
            is_active=req.is_active,
            is_approver=req.is_approver,
            icon=req.icon,
            model=req.model,
            temperature=req.temperature,
            owner_id=current_user.id,
        )
        await _snapshot_agent(created.id, current_user)
        await log_audit("create", "agent", req.name, "创建成功")
        return {"id": created.id, "status": "created"}
    except Exception as e:
        logger.error("Error creating agent: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


async def _snapshot_agent(agent_id: str, current_user: CurrentUser) -> Any:
    """Create a version snapshot after agent save. Runs in background."""
    try:
        agent = await get_agent_config(agent_id)
        if not agent:
            return
        snapshot = {
            "name": agent.name,
            "role_identifier": agent.role_identifier,
            "system_prompt": agent.system_prompt,
            "output_constraints": agent.output_constraints,
            "model": agent.model,
            "is_active": agent.is_active,
            "order": agent.order,
        }
        from virtual_team.repository.snapshot_helper import create_snapshot_from_dict

        await create_snapshot_from_dict(
            "agent", agent_id, snapshot, created_by=current_user.id,
        )
    except Exception:
        logger.warning("Version snapshot failed for agent %s", agent_id, exc_info=True)


@router.put("/api/agents/{agent_id}")
async def edit_agent(
    agent_id: str,
    req: AgentUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),  # noqa: B008
) -> Any:

    updated = await update_agent_config(
        id=agent_id,
        name=req.name,
        system_prompt=req.system_prompt,
        output_constraints=req.output_constraints,
        tools=json.dumps(req.tools) if req.tools is not None else None,
        mcp=json.dumps(req.mcp) if req.mcp is not None else None,
        skills=json.dumps(req.skills) if req.skills is not None else None,
        order=req.order,
        is_active=req.is_active,
        is_approver=req.is_approver,
        icon=req.icon,
        model=req.model,
        temperature=req.temperature,
    )
    if not updated:
        raise error_response(ErrorCode.AGENT_NOT_FOUND, detail="未找到该 agent 配置")
    await _snapshot_agent(updated.id, current_user)
    await log_audit("update", "agent", req.name or updated.name, "更新成功")
    return {"id": updated.id, "status": "updated"}


@router.delete("/api/agents/{agent_id}")
async def remove_agent(agent_id: str, current_user: CurrentUser = Depends(get_current_user)) -> Any:  # noqa: B008  # noqa: B008
    target = await get_agent_config(agent_id)
    if not target:
        raise error_response(ErrorCode.AGENT_NOT_FOUND, detail="未找到该 agent 配置")
    if target.is_approver:
        configs = await get_agent_configs()
        approvers = [c for c in configs if c.is_approver and c.id != agent_id]
        if not approvers:
            raise error_response(ErrorCode.AGENT_LAST_APPROVER, detail="不能删除唯一的审批者，请先设置其他审批者")
    agent_name = target.name
    deleted = await delete_agent_config(agent_id)
    if not deleted:
        raise error_response(ErrorCode.AGENT_NOT_FOUND, detail="未找到该 agent 配置")
    await log_audit("delete", "agent", agent_name, "删除成功")
    return {"status": "deleted"}


@router.put("/api/agents/{agent_id}/toggle")
async def toggle_agent(agent_id: str, current_user: CurrentUser = Depends(get_current_user)) -> Any:  # noqa: B008
    configs = await get_agent_configs()
    target = next((c for c in configs if c.id == agent_id), None)
    if not target:
        raise error_response(ErrorCode.AGENT_NOT_FOUND, detail="未找到该 agent 配置")
    if target.is_active and target.is_approver:
        active_approvers = [
            c for c in configs if c.is_approver and c.is_active and c.id != agent_id
        ]
        if not active_approvers:
            raise error_response(ErrorCode.AGENT_LAST_ACTIVE, detail="不能停用唯一的活跃审批者")
    updated = await update_agent_config(id=agent_id, is_active=not target.is_active)
    if not updated:
        raise error_response(ErrorCode.AGENT_NOT_FOUND, detail="Agent not found")
    return {"id": updated.id, "is_active": updated.is_active}


