"""认知状态数据模型

包含认知状态报告机制中用到的枚举类型和数据类（dataclass），
与引擎类（CognitiveStateAnalyzer）分离，便于独立维护和复用。
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

__all__ = [
    "ConfidenceLevel",
    "KnowledgeBoundary",
    "ReasoningStep",
    "CognitiveStateReport",
]


class ConfidenceLevel(Enum):
    """置信度级别"""
    VERY_HIGH = "very_high"      # 95%+
    HIGH = "high"                # 80-95%
    MEDIUM = "medium"            # 60-80%
    LOW = "low"                  # 40-60%
    VERY_LOW = "very_low"        # <40%
    UNCERTAIN = "uncertain"      # 无法评估


class KnowledgeBoundary(Enum):
    """知识边界类型"""
    WITHIN_SCOPE = "within_scope"        # 在知识范围内
    AT_BOUNDARY = "at_boundary"          # 在知识边界
    BEYOND_SCOPE = "beyond_scope"        # 超出知识范围
    REQUIRES_VERIFICATION = "requires_verification"  # 需要验证


@dataclass
class ReasoningStep:
    """推理步骤"""
    step_id: str
    description: str
    confidence: float  # 0.0-1.0
    evidence: list[str] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    alternative_considerations: list[str] = field(default_factory=list)


@dataclass
class CognitiveStateReport:
    """认知状态报告"""
    agent_id: str
    timestamp: datetime = field(default_factory=datetime.now)

    # 置信度评估
    overall_confidence: float = 0.0  # 0.0-1.0
    confidence_level: ConfidenceLevel = ConfidenceLevel.UNCERTAIN
    confidence_factors: dict[str, float] = field(default_factory=dict)

    # 不确定性量化
    uncertainty_sources: list[str] = field(default_factory=list)
    uncertainty_level: float = 0.0  # 0.0-1.0

    # 知识边界
    knowledge_boundary: KnowledgeBoundary = KnowledgeBoundary.WITHIN_SCOPE
    knowledge_gaps: list[str] = field(default_factory=list)
    requires_external_knowledge: bool = False

    # 推理过程
    reasoning_steps: list[ReasoningStep] = field(default_factory=list)
    reasoning_chain: list[str] = field(default_factory=list)

    # 元认知
    self_awareness: dict[str, Any] = field(default_factory=dict)
    limitations: list[str] = field(default_factory=list)

    # 建议
    recommendations: list[str] = field(default_factory=list)
    alternative_approaches: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式"""
        return {
            "agent_id": self.agent_id,
            "timestamp": self.timestamp.isoformat(),
            "confidence": {
                "overall": self.overall_confidence,
                "level": self.confidence_level.value,
                "factors": self.confidence_factors,
            },
            "uncertainty": {
                "sources": self.uncertainty_sources,
                "level": self.uncertainty_level,
            },
            "knowledge": {
                "boundary": self.knowledge_boundary.value,
                "gaps": self.knowledge_gaps,
                "requires_external": self.requires_external_knowledge,
            },
            "reasoning": {
                "steps": [
                    {
                        "id": step.step_id,
                        "description": step.description,
                        "confidence": step.confidence,
                        "evidence": step.evidence,
                        "assumptions": step.assumptions,
                        "alternatives": step.alternative_considerations,
                    }
                    for step in self.reasoning_steps
                ],
                "chain": self.reasoning_chain,
            },
            "meta_cognition": {
                "self_awareness": self.self_awareness,
                "limitations": self.limitations,
            },
            "recommendations": self.recommendations,
            "alternatives": self.alternative_approaches,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CognitiveStateReport":
        """从字典创建实例"""
        reasoning_steps = [
            ReasoningStep(
                step_id=step["id"],
                description=step["description"],
                confidence=step["confidence"],
                evidence=step.get("evidence", []),
                assumptions=step.get("assumptions", []),
                alternative_considerations=step.get("alternatives", []),
            )
            for step in data.get("reasoning", {}).get("steps", [])
        ]

        return cls(
            agent_id=data["agent_id"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            overall_confidence=data.get("confidence", {}).get("overall", 0.0),
            confidence_level=ConfidenceLevel(
                data.get("confidence", {}).get("level", "uncertain")
            ),
            confidence_factors=data.get("confidence", {}).get("factors", {}),
            uncertainty_sources=data.get("uncertainty", {}).get("sources", []),
            uncertainty_level=data.get("uncertainty", {}).get("level", 0.0),
            knowledge_boundary=KnowledgeBoundary(
                data.get("knowledge", {}).get("boundary", "within_scope")
            ),
            knowledge_gaps=data.get("knowledge", {}).get("gaps", []),
            requires_external_knowledge=data.get("knowledge", {}).get(
                "requires_external", False
            ),
            reasoning_steps=reasoning_steps,
            reasoning_chain=data.get("reasoning", {}).get("chain", []),
            self_awareness=data.get("meta_cognition", {}).get("self_awareness", {}),
            limitations=data.get("meta_cognition", {}).get("limitations", []),
            recommendations=data.get("recommendations", []),
            alternative_approaches=data.get("alternatives", []),
        )
