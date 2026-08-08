"""Workflow CRUD API endpoints."""

import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field
from pydantic.alias_generators import to_camel

from core.error_codes import ErrorCode, error_response
from repository.workflows import (
    delete_workflow_config,
    get_workflow_config_by_team,
    list_workflow_meta,
    save_workflow_config,
)
from workflow.models import (
    NodeStrategy,
    WorkflowConfig,
    WorkflowEdge,
    WorkflowNode,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


class WorkflowNodeSchema(BaseModel):
    model_config = {"alias_generator": to_camel, "populate_by_name": True}
    id: str = Field(default="")
    agent_config_id: str
    role_identifier: str
    strategy: str = "generator"
    order: int = 0


class WorkflowEdgeSchema(BaseModel):
    model_config = {"alias_generator": to_camel, "populate_by_name": True}
    id: str = Field(default="")
    from_node_id: str
    to_node_id: str
    condition_key: str | None = None
    is_default: bool = False
    priority: int = 0


class WorkflowSaveRequest(BaseModel):
    model_config = {"alias_generator": to_camel, "populate_by_name": True}
    id: str = Field(default="")
    team_id: str
    name: str
    max_rounds: int = 5
    nodes: list[WorkflowNodeSchema]
    edges: list[WorkflowEdgeSchema]


class WorkflowConfigSchema(BaseModel):
    model_config = {"alias_generator": to_camel, "populate_by_name": True}
    id: str
    team_id: str
    name: str
    max_rounds: int
    nodes: list[WorkflowNodeSchema]
    edges: list[WorkflowEdgeSchema]


class WorkflowListItemSchema(BaseModel):
    """Lightweight workflow row for the workflow list page."""

    model_config = {"alias_generator": to_camel, "populate_by_name": True}
    id: str
    team_id: str
    team_name: str
    name: str
    node_count: int
    created_at: datetime


def _to_schema(config: WorkflowConfig) -> WorkflowConfigSchema:
    id_to_role: dict[str, str] = {n.id: n.role_identifier for n in config.nodes}
    return WorkflowConfigSchema(
        id=config.id,
        team_id=config.team_id,
        name=config.name,
        max_rounds=config.max_rounds,
        nodes=[
            WorkflowNodeSchema(
                id=n.id,
                agent_config_id=n.agent_config_id,
                role_identifier=n.role_identifier,
                strategy=n.strategy.value,
                order=n.order,
            )
            for n in config.nodes
        ],
        edges=[
            WorkflowEdgeSchema(
                id=e.id,
                from_node_id=id_to_role.get(e.from_node_id, e.from_node_id),
                to_node_id=id_to_role.get(e.to_node_id, e.to_node_id),
                condition_key=e.condition_key,
                is_default=e.is_default,
                priority=e.priority,
            )
            for e in config.edges
        ],
    )


async def _snapshot_workflow(config: WorkflowConfig) -> None:
    """Create a version snapshot after workflow save (best-effort)."""
    try:
        from repository.snapshot_helper import with_session
        from repository.versions import create_version as _cv

        async def _save(s: Any, rt: str, rid: str, **kw: Any) -> None:
            snapshot = {
                "name": config.name,
                "max_rounds": config.max_rounds,
                "node_count": len(config.nodes),
                "edge_count": len(config.edges),
                "agents": [n.agent_config_id for n in config.nodes],
            }
            await _cv(s, rt, rid, snapshot, "system")

        await with_session(_save, resource_type="workflow", resource_id=config.id)
    except Exception:
        logger.warning("Version snapshot failed for workflow %s", config.id, exc_info=True)


@router.post("", response_model=WorkflowConfigSchema, status_code=201)
async def create_workflow(req: WorkflowSaveRequest) -> Any:
    """Create or update a workflow configuration for a team."""
    config = WorkflowConfig(
        id=req.id,
        team_id=req.team_id,
        name=req.name,
        max_rounds=req.max_rounds,
        nodes=[
            WorkflowNode(
                id=n.id if n.id else "",
                agent_config_id=n.agent_config_id,
                role_identifier=n.role_identifier,
                strategy=NodeStrategy(n.strategy),
                order=n.order,
            )
            for n in req.nodes
        ],
        edges=[
            WorkflowEdge(
                id=e.id if e.id else "",
                from_node_id=e.from_node_id,
                to_node_id=e.to_node_id,
                condition_key=e.condition_key,
                is_default=e.is_default,
                priority=e.priority,
            )
            for e in req.edges
        ],
    )
    saved = await save_workflow_config(config)
    await _snapshot_workflow(saved)
    return _to_schema(saved)


@router.get("/teams/{team_id}", response_model=WorkflowConfigSchema | None)
async def get_team_workflow(team_id: str) -> Any:
    """Get the workflow configuration for a specific team."""
    config = await get_workflow_config_by_team(team_id)
    if config is None:
        raise error_response(ErrorCode.WORKFLOW_NOT_FOUND, detail="Workflow not found for this team")
    return _to_schema(config)


@router.get("", response_model=list[WorkflowListItemSchema])
async def list_workflows() -> Any:
    """List all workflow configurations as lightweight rows."""
    rows = await list_workflow_meta()
    return [
        WorkflowListItemSchema(
            id=r.id,
            team_id=r.team_id,
            team_name=r.team_name,
            name=r.name,
            node_count=r.node_count,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.delete("/{config_id}")
async def delete_workflow(config_id: str) -> Any:
    """Delete a workflow configuration by ID."""
    deleted = await delete_workflow_config(config_id)
    if not deleted:
        raise error_response(ErrorCode.WORKFLOW_NOT_FOUND, detail="Workflow not found")
    return {"status": "deleted"}
