from langgraph.graph import END

from .models import WorkflowEdge, WorkflowState


class Router:
    def resolve(
        self,
        edges: list[WorkflowEdge],
        state: WorkflowState,
        current_node_id: str,
    ) -> str:
        matching = [e for e in edges if e.from_node_id == current_node_id]
        if not matching:
            return END

        matching.sort(key=lambda e: -e.priority)

        for edge in matching:
            if edge.condition_key and self._matches(state, edge):
                return edge.to_node_id

        default = next((e for e in matching if e.is_default), None)
        return default.to_node_id if default else END

    def _matches(self, state: WorkflowState, edge: WorkflowEdge) -> bool:
        if not edge.condition_key:
            return False
        keywords = [kw.strip().lower() for kw in edge.condition_key.split("|") if kw.strip()]
        all_outputs = " ".join(state.get("artifacts", {}).values()).lower()
        return any(kw in all_outputs for kw in keywords)
