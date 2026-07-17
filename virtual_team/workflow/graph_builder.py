"""Workflow graph builder — constructs LangGraph StateGraph from config."""

from typing import Any

from langgraph.graph import END, StateGraph

from .models import WorkflowConfig, WorkflowState
from .node_factory import NodeFactory
from .router import Router


class GraphBuilder:
    def __init__(
        self,
        node_factory: NodeFactory,
        router: Router,
        checkpointer: Any | None = None,
    ):
        self.node_factory = node_factory
        self.router = router
        self.checkpointer = checkpointer

    def build(self, config: WorkflowConfig) -> StateGraph:  # type: ignore[type-arg]
        workflow = StateGraph(WorkflowState)
        sorted_nodes = sorted(config.nodes, key=lambda n: n.order)

        for node in sorted_nodes:
            node_fn = self.node_factory.create(node)
            workflow.add_node(node.role_identifier, node_fn)  # type: ignore[arg-type]

        if sorted_nodes:
            entry = sorted_nodes[0].role_identifier
            workflow.set_entry_point(entry)

        for node in sorted_nodes:
            outgoing = [e for e in config.edges if e.from_node_id == node.role_identifier]
            if not outgoing:
                workflow.add_edge(node.role_identifier, END)
                continue

            real_edges = [e for e in outgoing if e.to_node_id != "END"]
            end_edges = [e for e in outgoing if e.to_node_id == "END"]

            for end_edge in end_edges:
                if end_edge.condition_key:
                    end_map = {kw.strip(): END for kw in end_edge.condition_key.split("|") if kw.strip()}
                    end_map["*"] = END
                    workflow.add_conditional_edges(
                        node.role_identifier,
                        lambda s, nid=node.role_identifier: END,
                        end_map,  # type: ignore[arg-type]
                    )
                else:
                    workflow.add_edge(node.role_identifier, END)

            conditions = [e for e in real_edges if e.condition_key]
            unconditional = [e for e in real_edges if not e.condition_key]

            if conditions:
                workflow.add_conditional_edges(
                    node.role_identifier,
                    lambda state, nid=node.role_identifier: self.router.resolve(config.edges, state, nid),
                    self._build_edge_map(outgoing),  # type: ignore[arg-type]
                )
            elif len(unconditional) == 1:
                workflow.add_edge(node.role_identifier, unconditional[0].to_node_id)
            elif len(unconditional) > 1:
                targets = [e.to_node_id for e in unconditional]
                workflow.add_conditional_edges(
                    node.role_identifier,
                    lambda state, tgt=targets: tgt,
                    {t: t for t in targets},
                )

        return workflow.compile(checkpointer=self.checkpointer)  # type: ignore

    def _build_edge_map(self, edges: list) -> dict[str, str]:  # type: ignore[type-arg]
        edge_map: dict[str, str] = {}
        for e in edges:
            if e.condition_key:
                for kw in e.condition_key.split("|"):
                    kw = kw.strip()
                    if kw and kw not in edge_map:
                        edge_map[kw] = e.to_node_id
        default = next((e for e in edges if e.is_default), None)
        if default:
            edge_map["*"] = default.to_node_id
        else:
            edge_map["*"] = END
        return edge_map
