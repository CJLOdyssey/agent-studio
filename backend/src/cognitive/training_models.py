"""协同训练数据模型

包含协同训练框架中用到的枚举类型和数据类（dataclass），
与引擎类（CollaborativeTrainer）分离，便于独立维护和复用。
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

__all__ = [
    "TrainingPhase",
    "KnowledgeType",
    "LearningExperience",
    "SharedKnowledge",
    "TrainingSession",
]


class TrainingPhase(Enum):
    """训练阶段"""
    INDIVIDUAL = "individual"      # 个体学习
    SHARING = "sharing"            # 经验分享
    COLLECTIVE = "collective"      # 集体学习
    OPTIMIZATION = "optimization"  # 优化调整


class KnowledgeType(Enum):
    """知识类型"""
    FACTUAL = "factual"            # 事实知识
    PROCEDURAL = "procedural"      # 程序知识
    STRATEGIC = "strategic"        # 策略知识
    META_COGNITIVE = "meta_cognitive"  # 元认知知识


@dataclass
class LearningExperience:
    """学习经验"""
    experience_id: str
    agent_id: str
    timestamp: datetime = field(default_factory=datetime.now)

    # 任务信息
    task_type: str = ""
    task_context: dict[str, Any] = field(default_factory=dict)

    # 执行结果
    success: bool = False
    outcome: str = ""
    performance_score: float = 0.0  # 0.0-1.0

    # 学到的知识
    knowledge_gained: list[dict[str, Any]] = field(default_factory=list)
    mistakes_made: list[str] = field(default_factory=list)
    improvements: list[str] = field(default_factory=list)

    # 元数据
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "experience_id": self.experience_id,
            "agent_id": self.agent_id,
            "timestamp": self.timestamp.isoformat(),
            "task": {
                "type": self.task_type,
                "context": self.task_context,
            },
            "outcome": {
                "success": self.success,
                "result": self.outcome,
                "score": self.performance_score,
            },
            "learning": {
                "knowledge": self.knowledge_gained,
                "mistakes": self.mistakes_made,
                "improvements": self.improvements,
            },
            "metadata": self.metadata,
        }


@dataclass
class SharedKnowledge:
    """共享知识"""
    knowledge_id: str
    knowledge_type: KnowledgeType
    content: str
    source_agent_id: str
    timestamp: datetime = field(default_factory=datetime.now)

    # 适用范围
    applicable_tasks: list[str] = field(default_factory=list)
    confidence: float = 1.0  # 0.0-1.0

    # 验证信息
    validated: bool = False
    validation_count: int = 0
    validation_score: float = 0.0

    # 使用统计
    usage_count: int = 0
    success_rate: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "knowledge_id": self.knowledge_id,
            "type": self.knowledge_type.value,
            "content": self.content,
            "source_agent": self.source_agent_id,
            "timestamp": self.timestamp.isoformat(),
            "applicable_tasks": self.applicable_tasks,
            "confidence": self.confidence,
            "validation": {
                "validated": self.validated,
                "count": self.validation_count,
                "score": self.validation_score,
            },
            "usage": {
                "count": self.usage_count,
                "success_rate": self.success_rate,
            },
        }


@dataclass
class TrainingSession:
    """训练会话"""
    session_id: str
    phase: TrainingPhase = TrainingPhase.INDIVIDUAL
    timestamp: datetime = field(default_factory=datetime.now)

    # 参与智能体
    participating_agents: list[str] = field(default_factory=list)

    # 训练内容
    training_objectives: list[str] = field(default_factory=list)
    knowledge_shared: list[SharedKnowledge] = field(default_factory=list)

    # 训练结果
    improvements: dict[str, float] = field(default_factory=dict)  # agent_id -> improvement_score
    collective_insights: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "session_id": self.session_id,
            "phase": self.phase.value,
            "timestamp": self.timestamp.isoformat(),
            "participants": self.participating_agents,
            "objectives": self.training_objectives,
            "knowledge_shared": [k.to_dict() for k in self.knowledge_shared],
            "results": {
                "improvements": self.improvements,
                "collective_insights": self.collective_insights,
            },
        }
