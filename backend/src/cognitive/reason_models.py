"""理由对齐数据模型

包含理由对齐机制中用到的枚举类型和数据类（dataclass），
与引擎类（ReasonAlignmentEngine）分离，便于独立维护和复用。
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class AlignmentType(Enum):
    """对齐类型"""
    GOAL_ALIGNED = "goal_aligned"          # 目标对齐
    VALUE_ALIGNED = "value_aligned"        # 价值观对齐
    RULE_ALIGNED = "rule_aligned"          # 规则对齐
    EVIDENCE_ALIGNED = "evidence_aligned"  # 证据对齐
    UNALIGNED = "unaligned"                # 未对齐


class EvidenceType(Enum):
    """证据类型"""
    FACTUAL = "factual"            # 事实性证据
    STATISTICAL = "statistical"    # 统计性证据
    EXPERT_OPINION = "expert_opinion"  # 专家意见
    HISTORICAL = "historical"      # 历史数据
    LOGICAL = "logical"            # 逻辑推理
    ASSUMPTION = "assumption"      # 假设


@dataclass
class Evidence:
    """证据"""
    evidence_id: str
    evidence_type: EvidenceType
    content: str
    source: str = ""
    confidence: float = 1.0  # 0.0-1.0
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "evidence_id": self.evidence_id,
            "type": self.evidence_type.value,
            "content": self.content,
            "source": self.source,
            "confidence": self.confidence,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class ReasoningChain:
    """推理链"""
    chain_id: str
    steps: list[dict[str, Any]] = field(default_factory=list)
    conclusion: str = ""
    confidence: float = 0.0
    evidence_chain: list[Evidence] = field(default_factory=list)

    def add_step(
        self,
        step_id: str,
        description: str,
        reasoning: str,
        evidence: list[Evidence] | None = None,
        confidence: float = 1.0,
    ) -> None:
        """添加推理步骤"""
        self.steps.append({
            "step_id": step_id,
            "description": description,
            "reasoning": reasoning,
            "evidence": [e.to_dict() for e in evidence] if evidence else [],
            "confidence": confidence,
        })
        if evidence:
            self.evidence_chain.extend(evidence)

        # 更新整体置信度
        if self.steps:
            self.confidence = sum(
                step.get("confidence", 1.0) for step in self.steps
            ) / len(self.steps)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "chain_id": self.chain_id,
            "steps": self.steps,
            "conclusion": self.conclusion,
            "confidence": self.confidence,
            "evidence_chain": [e.to_dict() for e in self.evidence_chain],
        }


@dataclass
class AlignmentReport:
    """对齐报告"""
    agent_id: str
    decision_id: str
    timestamp: datetime = field(default_factory=datetime.now)

    # 决策信息
    decision: str = ""
    decision_type: str = ""
    context: dict[str, Any] = field(default_factory=dict)

    # 对齐状态
    alignment_type: AlignmentType = AlignmentType.UNALIGNED
    alignment_score: float = 0.0  # 0.0-1.0
    alignment_factors: dict[str, float] = field(default_factory=dict)

    # 推理过程
    reasoning_chain: ReasoningChain = field(default_factory=lambda: ReasoningChain(chain_id=""))

    # 理由
    primary_reasons: list[str] = field(default_factory=list)
    supporting_reasons: list[str] = field(default_factory=list)
    counter_arguments: list[str] = field(default_factory=list)

    # 约束和规则
    constraints_satisfied: list[str] = field(default_factory=list)
    constraints_violated: list[str] = field(default_factory=list)
    rules_applied: list[str] = field(default_factory=list)

    # 替代方案
    alternatives_considered: list[dict[str, Any]] = field(default_factory=list)
    rejected_alternatives: list[dict[str, Any]] = field(default_factory=list)

    # 审计信息
    audit_trail: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "agent_id": self.agent_id,
            "decision_id": self.decision_id,
            "timestamp": self.timestamp.isoformat(),
            "decision": {
                "content": self.decision,
                "type": self.decision_type,
                "context": self.context,
            },
            "alignment": {
                "type": self.alignment_type.value,
                "score": self.alignment_score,
                "factors": self.alignment_factors,
            },
            "reasoning": self.reasoning_chain.to_dict(),
            "reasons": {
                "primary": self.primary_reasons,
                "supporting": self.supporting_reasons,
                "counter_arguments": self.counter_arguments,
            },
            "constraints": {
                "satisfied": self.constraints_satisfied,
                "violated": self.constraints_violated,
                "rules_applied": self.rules_applied,
            },
            "alternatives": {
                "considered": self.alternatives_considered,
                "rejected": self.rejected_alternatives,
            },
            "audit": self.audit_trail,
        }
