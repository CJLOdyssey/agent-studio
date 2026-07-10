from typing import Protocol

from .models import NodeStrategy, WorkflowNode, WorkflowState


class Strategy(Protocol):
    node_strategy: NodeStrategy

    def build_prompt_context(self, state: WorkflowState, node: WorkflowNode) -> str:
        ...

    def process_output(self, state: WorkflowState, node: WorkflowNode, output: str) -> dict:
        ...


class GeneratorStrategy:
    node_strategy = NodeStrategy.GENERATOR

    def build_prompt_context(self, state: WorkflowState, node: WorkflowNode) -> str:
        parts = [state.get("requirement", "")]
        artifacts = state.get("artifacts", {})
        if artifacts:
            parts.append("\n前面节点的输出:")
            for role_id, content in artifacts.items():
                parts.append(f"[{role_id}]: {content[:500]}")
        return "\n".join(parts)

    def process_output(self, state: WorkflowState, node: WorkflowNode, output: str) -> dict:
        state["artifacts"][node.role_identifier] = output
        return {"artifacts": state["artifacts"]}


class ReviewerStrategy:
    node_strategy = NodeStrategy.REVIEWER

    def build_prompt_context(self, state: WorkflowState, node: WorkflowNode) -> str:
        parts: list[str] = []
        artifacts = state.get("artifacts", {})
        if artifacts:
            parts.append("请审查以下内容:\n")
            for role_id, content in artifacts.items():
                parts.append(f"=== {role_id} 的输出 ===\n{content}\n")
        return "\n".join(parts)

    def process_output(self, state: WorkflowState, node: WorkflowNode, output: str) -> dict:
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
    node_strategy = NodeStrategy.REPORTER

    def build_prompt_context(self, state: WorkflowState, node: WorkflowNode) -> str:
        parts = ["请汇总所有已生成的内容，输出最终结果:\n"]
        artifacts = state.get("artifacts", {})
        for role_id, content in artifacts.items():
            parts.append(f"=== {role_id} ===\n{content}\n")
        return "\n".join(parts)

    def process_output(self, state: WorkflowState, node: WorkflowNode, output: str) -> dict:
        state["artifacts"]["_final_report"] = output
        state["artifacts"][node.role_identifier] = output
        return {"artifacts": state["artifacts"]}


STRATEGY_MAP: dict[NodeStrategy, Strategy] = {
    NodeStrategy.GENERATOR: GeneratorStrategy(),
    NodeStrategy.REVIEWER: ReviewerStrategy(),
    NodeStrategy.REPORTER: ReporterStrategy(),
}


def get_strategy(node: WorkflowNode) -> Strategy:
    return STRATEGY_MAP.get(node.strategy, GeneratorStrategy())
