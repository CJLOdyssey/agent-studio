"""Workflow data models — nodes, edges, config, and state types."""

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Annotated, Any, TypedDict

from langchain_core.messages import BaseMessage, HumanMessage
from langgraph.graph.message import add_messages


def _merge_dicts(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    """Merge two dicts, with the right dict taking precedence."""
    merged = left.copy()
    merged.update(right)
    return merged


class NodeStrategy(StrEnum):
    """Workflow node execution strategies."""

    GENERATOR = "generator"
    REVIEWER = "reviewer"
    REPORTER = "reporter"


@dataclass
class WorkflowNode:
    """A single node in the workflow DAG."""

    id: str = ""
    agent_config_id: str = ""
    role_identifier: str = ""
    strategy: NodeStrategy = NodeStrategy.GENERATOR
    order: int = 0


@dataclass
class WorkflowEdge:
    """A directed edge connecting two workflow nodes."""

    id: str = ""
    from_node_id: str = ""
    to_node_id: str = ""
    condition_key: str | None = None
    is_default: bool = False
    priority: int = 0


@dataclass
class WorkflowConfig:
    """Complete workflow DAG configuration."""

    id: str = ""
    team_id: str = ""
    name: str = ""
    max_rounds: int = 5
    nodes: list[WorkflowNode] = field(default_factory=list)
    edges: list[WorkflowEdge] = field(default_factory=list)

    def get_node_by_role(self, role_identifier: str) -> WorkflowNode | None:
        """Find a node by its role identifier."""
        for node in self.nodes:
            if node.role_identifier == role_identifier:
                return node
        return None

    def get_outgoing_edges(self, node_id: str) -> list[WorkflowEdge]:
        """Get all edges leaving a given node."""
        return [e for e in self.edges if e.from_node_id == node_id]

    def get_entry_node(self) -> WorkflowNode | None:
        """Get the entry node (lowest order number)."""
        sorted_nodes = sorted(self.nodes, key=lambda n: n.order)
        return sorted_nodes[0] if sorted_nodes else None


class WorkflowState(TypedDict):
    """TypedDict for the LangGraph workflow state."""

    messages: Annotated[list[BaseMessage], add_messages]
    requirement: str
    artifacts: Annotated[dict[str, str], _merge_dicts]
    round_number: int
    approved: Annotated[dict[str, bool], _merge_dicts]


def create_initial_state(requirement: str = "") -> WorkflowState:
    """Create the initial workflow state from a requirement."""
    return WorkflowState(
        messages=[HumanMessage(content=requirement)],
        requirement=requirement,
        artifacts={},
        round_number=1,
        approved={},
    )


def get_previous_artifacts(
    state: WorkflowState,
    current_node: WorkflowNode,
    config: WorkflowConfig,
) -> dict[str, str]:
    """Collect artifacts from all upstream nodes of a given node."""
    result: dict[str, str] = {}
    incoming_edges = [e for e in config.edges if e.to_node_id == current_node.id]
    for edge in incoming_edges:
        from_node = config.get_node_by_role(edge.from_node_id)
        if from_node and from_node.role_identifier in state.get("artifacts", {}):
            result[from_node.role_identifier] = state["artifacts"][from_node.role_identifier]
    return result

