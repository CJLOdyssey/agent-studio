"""工作流数据模型——节点、边、配置与状态类型。"""

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Annotated, Any, TypedDict

from langchain_core.messages import BaseMessage, HumanMessage
from langgraph.graph.message import add_messages


def _merge_dicts(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    """合并两个字典，右侧字典优先。"""
    merged = left.copy()
    merged.update(right)
    return merged


class NodeStrategy(StrEnum):
    """工作流节点执行策略。"""

    GENERATOR = "generator"
    REVIEWER = "reviewer"
    REPORTER = "reporter"


@dataclass
class WorkflowNode:
    """工作流 DAG 中的单个节点。"""

    id: str = ""
    agent_config_id: str = ""
    role_identifier: str = ""
    strategy: NodeStrategy = NodeStrategy.GENERATOR
    order: int = 0


@dataclass
class WorkflowEdge:
    """连接两个工作流节点的有向边。"""

    id: str = ""
    from_node_id: str = ""
    to_node_id: str = ""
    condition_key: str | None = None
    is_default: bool = False
    priority: int = 0
    routing_mode: str = "keyword"  # "keyword" | "llm"


@dataclass
class WorkflowConfig:
    """完整的工作流 DAG 配置。"""

    id: str = ""
    team_id: str = ""
    name: str = ""
    max_rounds: int = 5
    nodes: list[WorkflowNode] = field(default_factory=list)
    edges: list[WorkflowEdge] = field(default_factory=list)

    def get_node_by_role(self, role_identifier: str) -> WorkflowNode | None:
        """按角色标识查找节点。"""
        for node in self.nodes:
            if node.role_identifier == role_identifier:
                return node
        return None

    def get_outgoing_edges(self, node_id: str) -> list[WorkflowEdge]:
        """获取某节点的所有出边。"""
        return [e for e in self.edges if e.from_node_id == node_id]

    def get_entry_node(self) -> WorkflowNode | None:
        """获取入口节点（order 最小的节点）。"""
        sorted_nodes = sorted(self.nodes, key=lambda n: n.order)
        return sorted_nodes[0] if sorted_nodes else None


class WorkflowState(TypedDict):
    """LangGraph 工作流状态的 TypedDict。"""

    messages: Annotated[list[BaseMessage], add_messages]
    requirement: str
    artifacts: Annotated[dict[str, str], _merge_dicts]
    round_number: int
    approved: Annotated[dict[str, bool], _merge_dicts]
    verdicts: Annotated[dict[str, dict[str, Any]], _merge_dicts]  # {role: {"approved", "reason", "rounds"}}


def create_initial_state(requirement: str = "") -> WorkflowState:
    """根据需求创建初始工作流状态。"""
    return WorkflowState(
        messages=[HumanMessage(content=requirement)],
        requirement=requirement,
        artifacts={},
        round_number=1,
        approved={},
        verdicts={},
    )


def get_previous_artifacts(
    state: WorkflowState,
    current_node: WorkflowNode,
    config: WorkflowConfig,
) -> dict[str, str]:
    """收集某节点所有上游节点的产物。"""
    result: dict[str, str] = {}
    incoming_edges = [e for e in config.edges if e.to_node_id == current_node.id]
    for edge in incoming_edges:
        from_node = config.get_node_by_role(edge.from_node_id)
        if from_node and from_node.role_identifier in state.get("artifacts", {}):
            result[from_node.role_identifier] = state["artifacts"][from_node.role_identifier]
    return result

