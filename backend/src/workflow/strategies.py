"""工作流节点策略——生成器、评审员与报告员的实现。"""

import json
from typing import Any, Protocol

from .models import NodeStrategy, WorkflowNode, WorkflowState

_APPROVAL_KEYWORDS = ["APPROVED", "PASS", "✅", "通过"]


def _parse_verdict(output: str) -> dict[str, Any]:
    """解析评审结论——优先 JSON，关键词检测作为回退。"""
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
    """节点执行策略的协议。"""

    node_strategy: NodeStrategy
    output_schema: dict[str, Any] | None

    def build_prompt_context(self, state: WorkflowState, node: WorkflowNode) -> str:
        """根据当前状态为节点构建提示词上下文。"""
        ...

    def process_output(self, state: WorkflowState, node: WorkflowNode, output: str) -> dict[str, Any]:
        """处理节点输出并更新工作流状态。"""
        ...


class GeneratorStrategy:
    """生成器策略——产出内容并将其存储为产物。"""

    node_strategy = NodeStrategy.GENERATOR
    output_schema: dict[str, Any] | None = None

    @staticmethod
    def build_prompt_context(state: WorkflowState, node: WorkflowNode) -> str:
        """为生成器构建包含上游产物的提示词上下文。"""
        parts = [state.get("requirement", "")]
        artifacts = state.get("artifacts", {})
        if artifacts:
            parts.append("\n前面节点的输出:")
            for role_id, content in artifacts.items():
                parts.append(f"[{role_id}]: {content[:500]}")
        return "\n".join(parts)

    @staticmethod
    def process_output(state: WorkflowState, node: WorkflowNode, output: str) -> dict[str, Any]:
        """将生成的输出作为产物存入状态。"""
        state["artifacts"][node.role_identifier] = output
        return {"artifacts": state["artifacts"]}


class ReviewerStrategy:
    """评审员策略——评审产物并判定是否通过。"""

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
        """从所有当前产物构建评审上下文。"""
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
        """存储评审并从 JSON 或关键词判定通过状态。"""
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
    """报告员策略——汇总所有产物生成最终报告。"""

    node_strategy = NodeStrategy.REPORTER
    output_schema: dict[str, Any] | None = None

    @staticmethod
    def build_prompt_context(state: WorkflowState, node: WorkflowNode) -> str:
        """从所有产物构建用于最终报告的汇总上下文。"""
        parts = ["请汇总所有已生成的内容，输出最终结果:\n"]
        artifacts = state.get("artifacts", {})
        for role_id, content in artifacts.items():
            parts.append(f"=== {role_id} ===\n{content}\n")
        return "\n".join(parts)

    @staticmethod
    def process_output(state: WorkflowState, node: WorkflowNode, output: str) -> dict[str, Any]:
        """将最终报告作为特殊产物存储。"""
        state["artifacts"]["_final_report"] = output
        state["artifacts"][node.role_identifier] = output
        return {"artifacts": state["artifacts"]}


STRATEGY_MAP: dict[NodeStrategy, Strategy] = {
    NodeStrategy.GENERATOR: GeneratorStrategy(),
    NodeStrategy.REVIEWER: ReviewerStrategy(),
    NodeStrategy.REPORTER: ReporterStrategy(),
}


def get_strategy(node: WorkflowNode) -> Strategy:
    """获取给定工作流节点的策略实例。"""
    return STRATEGY_MAP.get(node.strategy, GeneratorStrategy())
