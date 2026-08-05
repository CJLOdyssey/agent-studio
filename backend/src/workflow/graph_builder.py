"""Workflow graph builder — constructs LangGraph StateGraph from config."""

from collections.abc import Hashable
from typing import Any, cast

from langgraph.graph import END, StateGraph

from .models import NodeStrategy, WorkflowConfig, WorkflowState
from .node_factory import NodeFactory
from .router import Router

# Synthetic node that bumps round_number before retrying the entry node. Its name
# can never collide with a user role_identifier in practice.
_ROUND_NODE = "__round_increment__"


def _approval_route(state: WorkflowState, config: WorkflowConfig, entry_node: str) -> str:
    """Gate a reviewer node — retry the entry node on rejection, END at max_rounds.

    Returns the path key consumed by ``add_conditional_edges``: "retry" back into
    the iteration loop, "continue" to the reviewer's original downstream target,
    or END once rejected and max_rounds exhausted (partial results kept).
    """
    rounds = int(state.get("round_number", 1) or 1)
    verdicts = state.get("verdicts", {}) or {}
    any_reject = any(not v.get("approved", True) for v in verdicts.values())
    if any_reject and rounds >= config.max_rounds:
        return END
    if any_reject:
        return "retry"
    return "continue"


class GraphBuilder:
    def __init__(
        self,
        node_factory: NodeFactory,
        router: Router,
        checkpointer: Any | None = None,
        llm: Any | None = None,
    ):
        self.node_factory = node_factory
        self.router = router
        self.checkpointer = checkpointer
        self.llm = llm

    def build(self, config: WorkflowConfig) -> StateGraph[Any]:
        workflow = StateGraph(WorkflowState)
        sorted_nodes = sorted(config.nodes, key=lambda n: n.order)
        entry_node = sorted_nodes[0].role_identifier if sorted_nodes else None
        has_reviewer = any(n.strategy == NodeStrategy.REVIEWER for n in sorted_nodes)

        for node in sorted_nodes:
            node_fn = self.node_factory.create(node)
            workflow.add_node(node.role_identifier, cast(Any, node_fn))

        if has_reviewer and entry_node:
            def _increment_round(state: WorkflowState) -> dict[str, int]:
                return {"round_number": int(state.get("round_number", 1) or 1) + 1}

            workflow.add_node(_ROUND_NODE, _increment_round)
            workflow.add_edge(_ROUND_NODE, entry_node)

        if entry_node:
            workflow.set_entry_point(entry_node)

        for node in sorted_nodes:
            outgoing = [e for e in config.edges if e.from_node_id == node.role_identifier]
            if node.strategy == NodeStrategy.REVIEWER:
                self._add_reviewer_gate(workflow, config, node, outgoing, entry_node)
                continue
            self._add_node_edges(workflow, config, node, outgoing)

        return cast(StateGraph[Any], workflow.compile(checkpointer=self.checkpointer))

    def _add_reviewer_gate(
        self,
        workflow: StateGraph[Any],
        config: WorkflowConfig,
        node: Any,
        outgoing: list[Any],
        entry_node: str | None,
    ) -> None:
        """Replace a reviewer's outgoing edges with the approval gate."""
        real = [e for e in outgoing if e.to_node_id != "END"]
        unconditional = [e for e in real if not e.condition_key]
        # Approved -> reviewer's original downstream target; skip self-loops back
        # to the entry node (the gate owns retries) and fall back to END.
        post = next((e.to_node_id for e in unconditional if e.to_node_id != entry_node), END)
        # ponytail: HITL deferred — a future routers/team_runs.py + redis key
        # team:{run_id}:human_verdict should let an operator override the verdict
        # before this gate routes (hook point: reviewer node_fn / _approval_route).
        workflow.add_conditional_edges(
            node.role_identifier,
            lambda s, cfg=config, en=entry_node: _approval_route(s, cfg, en),
            {"retry": _ROUND_NODE, "continue": post, END: END},
        )

    def _add_node_edges(
        self,
        workflow: StateGraph[Any],
        config: WorkflowConfig,
        node: Any,
        outgoing: list[Any],
    ) -> None:
        if not outgoing:
            workflow.add_edge(node.role_identifier, END)
            return

        real_edges = [e for e in outgoing if e.to_node_id != "END"]
        end_edges = [e for e in outgoing if e.to_node_id == "END"]

        for end_edge in end_edges:
            if end_edge.condition_key:
                end_map = {kw.strip(): END for kw in end_edge.condition_key.split("|") if kw.strip()}
                end_map["*"] = END
                workflow.add_conditional_edges(
                    node.role_identifier,
                    lambda s, nid=node.role_identifier: END,
                    cast(dict[Hashable, str], end_map),
                )
            else:
                workflow.add_edge(node.role_identifier, END)

        conditions = [e for e in real_edges if e.condition_key]
        unconditional = [e for e in real_edges if not e.condition_key]

        if conditions:
            if self.llm is not None and any(e.routing_mode == "llm" for e in conditions):
                targets = {e.to_node_id for e in conditions} | {e.to_node_id for e in unconditional}
                mapping: dict[str, str] = {t: t for t in targets}
                mapping[END] = END

                async def _llm_path(state: WorkflowState, nid: str = node.role_identifier) -> str:
                    return await self._route_llm(config.edges, state, nid)

                workflow.add_conditional_edges(
                    node.role_identifier,
                    _llm_path,
                    cast(dict[Hashable, str], mapping),
                )
            else:
                workflow.add_conditional_edges(
                    node.role_identifier,
                    lambda state, nid=node.role_identifier: self.router.resolve(config.edges, state, nid),
                    cast(dict[Hashable, str], self._build_edge_map(outgoing)),
                )
        elif len(unconditional) == 1:
            workflow.add_edge(node.role_identifier, unconditional[0].to_node_id)
        elif len(unconditional) > 1:
            uncond_targets = [e.to_node_id for e in unconditional]
            workflow.add_conditional_edges(
                node.role_identifier,
                lambda state, tgt=uncond_targets: tgt,
                {t: t for t in uncond_targets},
            )

    async def _route_llm(self, edges: list[Any], state: WorkflowState, current_node_id: str) -> str:
        return await self.router.resolve_llm(edges, state, current_node_id, self.llm)

    def _build_edge_map(self, edges: list[Any]) -> dict[str, str]:
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
