"""Workflow node strategies — generator, reviewer, and reporter implementations."""

import json
from typing import Any, Protocol

from .models import NodeStrategy, WorkflowNode, WorkflowState

_APPROVAL_KEYWORDS = ["APPROVED", "PASS", "✅", "通过"]


def _parse_verdict(output: str) -> dict[str, Any]:
    """Parse a reviewer verdict — JSON first, keyword detection as fallback."""
    text = (output or "").strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        try:
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            data = None
        if isinstance(data, dict):
            return {
                "approved": bool(data.get("approved", False)),
                "reason": str(data.get("reason", "")),
                "score": data.get("score")
                if isinstance(data.get("score"), (int, float))
                else None,
            }
    approved = any(kw.lower() in text.lower() for kw in _APPROVAL_KEYWORDS)
    return {"approved": approved, "reason": ""}


class Strategy(Protocol):
    """Protocol for node execution strategies."""

    node_strategy: NodeStrategy
    output_schema: dict[str, Any] | None

    def build_prompt_context(self, state: WorkflowState, node: WorkflowNode) -> str:
        """Build the prompt context for a node from the current state."""
        ...

    def process_output(self, state: WorkflowState, node: WorkflowNode, output: str) -> dict[str, Any]:
        """Process the node's output and update the workflow state."""
        ...


class GeneratorStrategy:
    """Generator strategy — produces content and stores it as an artifact."""

    node_strategy = NodeStrategy.GENERATOR
    output_schema: dict[str, Any] | None = None

    @staticmethod
    def build_prompt_context(state: WorkflowState, node: WorkflowNode) -> str:
        """Build prompt context including upstream artifacts for the generator."""
        parts = [state.get("requirement", "")]
        artifacts = state.get("artifacts", {})
        if artifacts:
            parts.append("\n前面节点的输出:")
            for role_id, content in artifacts.items():
                parts.append(f"[{role_id}]: {content[:500]}")
        return "\n".join(parts)

    @staticmethod
    def process_output(state: WorkflowState, node: WorkflowNode, output: str) -> dict[str, Any]:
        """Store the generated output as an artifact in the state."""
        state["artifacts"][node.role_identifier] = output
        return {"artifacts": state["artifacts"]}


class ReviewerStrategy:
    """Reviewer strategy — reviews artifacts and determines approval."""

    node_strategy = NodeStrategy.REVIEWER
    output_schema: dict[str, Any] | None = {
        "type": "object",
        "properties": {
            "approved": {"type": "boolean"},
            "reason": {"type": "string"},
            "score": {"type": "number"},
        },
        "required": ["approved", "reason"],
    }

    @staticmethod
    def build_prompt_context(state: WorkflowState, node: WorkflowNode) -> str:
        """Build review context from all current artifacts."""
        parts: list[str] = []
        artifacts = state.get("artifacts", {})
        if artifacts:
            parts.append("请审查以下内容:\n")
            for role_id, content in artifacts.items():
                parts.append(f"=== {role_id} 的输出 ===\n{content}\n")
        parts.append(
            '请严格按 JSON 输出评审结论，必须含 approved(boolean) 与 reason(string)：'
            '{"approved": true, "reason": "…", "score": 0-10}，不要输出 JSON 以外的内容。'
        )
        return "\n".join(parts)

    @staticmethod
    def process_output(state: WorkflowState, node: WorkflowNode, output: str) -> dict[str, Any]:
        """Store the review and determine approval status from JSON or keywords."""
        verdict = _parse_verdict(output)
        state["artifacts"][node.role_identifier] = output
        state["approved"][node.role_identifier] = verdict["approved"]
        verdicts = state.get("verdicts") or {}
        verdicts[node.role_identifier] = {
            "approved": verdict["approved"],
            "reason": verdict["reason"],
            "score": verdict.get("score"),
            "rounds": state.get("round_number", 1),
        }
        state["verdicts"] = verdicts
        return {
            "artifacts": state["artifacts"],
            "approved": state["approved"],
            "verdicts": state["verdicts"],
        }


class ReporterStrategy:
    """Reporter strategy — aggregates all artifacts into a final report."""

    node_strategy = NodeStrategy.REPORTER
    output_schema: dict[str, Any] | None = None

    @staticmethod
    def build_prompt_context(state: WorkflowState, node: WorkflowNode) -> str:
        """Build summary context from all artifacts for final reporting."""
        parts = ["请汇总所有已生成的内容，输出最终结果:\n"]
        artifacts = state.get("artifacts", {})
        for role_id, content in artifacts.items():
            parts.append(f"=== {role_id} ===\n{content}\n")
        return "\n".join(parts)

    @staticmethod
    def process_output(state: WorkflowState, node: WorkflowNode, output: str) -> dict[str, Any]:
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
