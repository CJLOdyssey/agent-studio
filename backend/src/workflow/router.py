"""Workflow router — resolves next nodes based on edge conditions."""

from typing import Any

from langchain_core.messages import HumanMessage
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

    async def resolve_llm(
        self,
        edges: list[WorkflowEdge],
        state: WorkflowState,
        current_node_id: str,
        llm: Any,
    ) -> str:
        """Resolve the next node by asking the LLM to pick among candidates."""
        candidates = [e for e in edges if e.from_node_id == current_node_id and e.to_node_id != END]
        if not candidates:
            return END
        ctx = "\n".join(f"[{role}]: {content[:200]}" for role, content in state.get("artifacts", {}).items())
        prompt = (
            f"根据已完成输出，从候选下一个 Agent 中选择最合适的："
            f"{', '.join(e.to_node_id for e in candidates)}\n"
            f"已完成输出：\n{ctx}\n只返回一个节点名。"
        )
        resp = await llm.ainvoke([HumanMessage(content=prompt)])
        chosen = str(resp.content or "").strip()
        if chosen in {e.to_node_id for e in candidates}:
            return chosen
        default = next((e for e in candidates if e.is_default), None)
        return default.to_node_id if default else END

    @staticmethod
    def _matches(state: WorkflowState, edge: WorkflowEdge) -> bool:
        if not edge.condition_key:
            return False
        keywords = [kw.strip().lower() for kw in edge.condition_key.split("|") if kw.strip()]
        all_outputs = " ".join(state.get("artifacts", {}).values()).lower()
        return any(kw in all_outputs for kw in keywords)
