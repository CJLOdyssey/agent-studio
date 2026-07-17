"""Workflow CRUD API endpoints."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field
from pydantic.alias_generators import to_camel

from virtual_team.error_codes import ErrorCode, error_response
from virtual_team.repository.workflows import (
    delete_workflow_config,
    get_workflow_config_by_team,
    list_workflow_configs,
    save_workflow_config,
)
from virtual_team.workflow.models import (
    NodeStrategy,
    WorkflowConfig,
    WorkflowEdge,
    WorkflowNode,
)

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


@router.post("", response_model=WorkflowConfigSchema, status_code=201)
async def create_workflow(req: WorkflowSaveRequest) -> Any:
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
    return _to_schema(saved)


@router.get("/teams/{team_id}", response_model=WorkflowConfigSchema | None)
async def get_team_workflow(team_id: str) -> Any:
    config = await get_workflow_config_by_team(team_id)
    if config is None:
        raise error_response(ErrorCode.WORKFLOW_NOT_FOUND, detail="Workflow not found for this team")
    return _to_schema(config)


@router.get("", response_model=list[WorkflowConfigSchema])
async def list_workflows() -> Any:
    configs = await list_workflow_configs()
    return [_to_schema(c) for c in configs]


@router.delete("/{config_id}")
async def delete_workflow(config_id: str) -> Any:
    deleted = await delete_workflow_config(config_id)
    if not deleted:
        raise error_response(ErrorCode.WORKFLOW_NOT_FOUND, detail="Workflow not found")
    return {"status": "deleted"}
