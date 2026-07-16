"""Workflow node strategies — generator, reviewer, and reporter implementations."""

from typing import Protocol

from .models import NodeStrategy, WorkflowNode, WorkflowState


class Strategy(Protocol):
    """Protocol for node execution strategies."""

    node_strategy: NodeStrategy

    def build_prompt_context(self, state: WorkflowState, node: WorkflowNode) -> str:
        """Build the prompt context for a node from the current state."""
        ...

    def process_output(self, state: WorkflowState, node: WorkflowNode, output: str) -> dict:
        """Process the node's output and update the workflow state."""
        ...


class GeneratorStrategy:
    """Generator strategy — produces content and stores it as an artifact."""

    node_strategy = NodeStrategy.GENERATOR

    def build_prompt_context(self, state: WorkflowState, node: WorkflowNode) -> str:
        """Build prompt context including upstream artifacts for the generator."""
        parts = [state.get("requirement", "")]
        artifacts = state.get("artifacts", {})
        if artifacts:
            parts.append("\n前面节点的输出:")
            for role_id, content in artifacts.items():
                parts.append(f"[{role_id}]: {content[:500]}")
        return "\n".join(parts)

    def process_output(self, state: WorkflowState, node: WorkflowNode, output: str) -> dict:
        """Store the generated output as an artifact in the state."""
        state["artifacts"][node.role_identifier] = output
        return {"artifacts": state["artifacts"]}


class ReviewerStrategy:
    """Reviewer strategy — reviews artifacts and determines approval."""

    node_strategy = NodeStrategy.REVIEWER

    def build_prompt_context(self, state: WorkflowState, node: WorkflowNode) -> str:
        """Build review context from all current artifacts."""
        parts: list[str] = []
        artifacts = state.get("artifacts", {})
        if artifacts:
            parts.append("请审查以下内容:\n")
            for role_id, content in artifacts.items():
                parts.append(f"=== {role_id} 的输出 ===\n{content}\n")
        return "\n".join(parts)

    def process_output(self, state: WorkflowState, node: WorkflowNode, output: str) -> dict:
        """Store the review and determine approval status from output keywords."""
        state["artifacts"][node.role_identifier] = output
        approved = False
        approval_keywords = ["APPROVED", "PASS", "✅", "通过"]
        for kw in approval_keywords:
            if kw.lower() in output.lower():
                approved = True
                break
        state["approved"][node.role_identifier] = approved
        return {"artifacts": state["artifacts"], "approved": state["approved"]}


class ReporterStrategy:
    """Reporter strategy — aggregates all artifacts into a final report."""

    node_strategy = NodeStrategy.REPORTER

    def build_prompt_context(self, state: WorkflowState, node: WorkflowNode) -> str:
        """Build summary context from all artifacts for final reporting."""
        parts = ["请汇总所有已生成的内容，输出最终结果:\n"]
        artifacts = state.get("artifacts", {})
        for role_id, content in artifacts.items():
            parts.append(f"=== {role_id} ===\n{content}\n")
        return "\n".join(parts)

    def process_output(self, state: WorkflowState, node: WorkflowNode, output: str) -> dict:
        """Store the final report as a special artifact."""
        state["artifacts"]["_final_report"] = output
        state["artifacts"][node.role_identifier] = output
        return {"artifacts": state["artifacts"]}


STRATEGY_MAP: dict[NodeStrategy, Strategy] = {
    NodeStrategy.GENERATOR: GeneratorStrategy(),
    NodeStrategy.REVIEWER: ReviewerStrategy(),
    NodeStrategy.REPORTER: ReporterStrategy(),
}


def get_strategy(node: WorkflowNode) -> Strategy:
    """Get the strategy instance for a given workflow node."""
    return STRATEGY_MAP.get(node.strategy, GeneratorStrategy())
