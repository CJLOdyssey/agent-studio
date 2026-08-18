"""协同训练框架 - Collaborative Training Framework

实现智能体间的协同学习和知识共享，包括：
- 经验共享机制
- 协同学习策略
- 知识蒸馏
- 集体智能优化
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


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


class CollaborativeTrainer:
    """协同训练器"""

    def __init__(self) -> None:
        self.experiences: dict[str, list[LearningExperience]] = defaultdict(list)
        self.shared_knowledge: dict[str, SharedKnowledge] = {}
        self.training_sessions: list[TrainingSession] = []
        self.agent_capabilities: dict[str, dict[str, Any]] = {}

    def register_agent(
        self,
        agent_id: str,
        capabilities: dict[str, Any] | None = None,
    ) -> None:
        """注册智能体"""
        self.agent_capabilities[agent_id] = capabilities or {}
        if agent_id not in self.experiences:
            self.experiences[agent_id] = []

    def record_experience(
        self,
        agent_id: str,
        experience: LearningExperience,
    ) -> None:
        """记录学习经验"""
        self.experiences[agent_id].append(experience)

    def share_knowledge(
        self,
        agent_id: str,
        knowledge_type: KnowledgeType,
        content: str,
        applicable_tasks: list[str] | None = None,
        confidence: float = 1.0,
    ) -> SharedKnowledge:
        """共享知识"""
        knowledge_id = f"k_{agent_id}_{len(self.shared_knowledge)}"
        knowledge = SharedKnowledge(
            knowledge_id=knowledge_id,
            knowledge_type=knowledge_type,
            content=content,
            source_agent_id=agent_id,
            applicable_tasks=applicable_tasks or [],
            confidence=confidence,
        )
        self.shared_knowledge[knowledge_id] = knowledge
        return knowledge

    def validate_knowledge(
        self,
        knowledge_id: str,
        validation_result: bool,
        performance_score: float,
    ) -> None:
        """验证知识"""
        if knowledge_id not in self.shared_knowledge:
            return

        knowledge = self.shared_knowledge[knowledge_id]
        knowledge.validation_count += 1
        knowledge.validated = validation_result

        # 更新验证分数（移动平均）
        if knowledge.validation_score == 0:
            knowledge.validation_score = performance_score
        else:
            knowledge.validation_score = (
                knowledge.validation_score * 0.7 + performance_score * 0.3
            )

    def get_relevant_knowledge(
        self,
        task_type: str,
        min_confidence: float = 0.5,
    ) -> list[SharedKnowledge]:
        """获取相关知识"""
        relevant = []
        for knowledge in self.shared_knowledge.values():
            if (
                knowledge.confidence >= min_confidence
                and (not knowledge.applicable_tasks or task_type in knowledge.applicable_tasks)
            ):
                relevant.append(knowledge)

        # 按置信度和验证分数排序
        relevant.sort(
            key=lambda k: k.confidence * k.validation_score,
            reverse=True,
        )
        return relevant

    def start_training_session(
        self,
        session_id: str,
        participating_agents: list[str],
        objectives: list[str] | None = None,
    ) -> TrainingSession:
        """开始训练会话"""
        session = TrainingSession(
            session_id=session_id,
            participating_agents=participating_agents,
            training_objectives=objectives or [],
        )
        self.training_sessions.append(session)
        return session

    def conduct_knowledge_sharing(
        self,
        session: TrainingSession,
    ) -> list[SharedKnowledge]:
        """进行知识分享"""
        shared_in_session = []

        # 从每个参与智能体的经验中提取知识
        for agent_id in session.participating_agents:
            experiences = self.experiences.get(agent_id, [])

            # 提取成功经验
            successful_experiences = [e for e in experiences if e.success]

            for exp in successful_experiences[-5:]:  # 最近5个成功经验
                if exp.knowledge_gained:
                    for knowledge in exp.knowledge_gained:
                        shared_knowledge = self.share_knowledge(
                            agent_id=agent_id,
                            knowledge_type=KnowledgeType(knowledge.get("type", "factual")),
                            content=knowledge.get("content", ""),
                            applicable_tasks=[exp.task_type],
                            confidence=exp.performance_score,
                        )
                        session.knowledge_shared.append(shared_knowledge)
                        shared_in_session.append(shared_knowledge)

        return shared_in_session

    def conduct_collective_learning(
        self,
        session: TrainingSession,
    ) -> list[str]:
        """进行集体学习"""
        insights = []

        # 分析所有参与智能体的经验模式
        all_experiences = []
        for agent_id in session.participating_agents:
            all_experiences.extend(self.experiences.get(agent_id, []))

        # 识别共同的成功模式
        success_patterns = self._identify_success_patterns(all_experiences)
        insights.extend(success_patterns)

        # 识别常见的失败模式
        failure_patterns = self._identify_failure_patterns(all_experiences)
        insights.extend(failure_patterns)

        # 识别最佳实践
        best_practices = self._identify_best_practices(all_experiences)
        insights.extend(best_practices)

        session.collective_insights = insights
        return insights

    def _identify_success_patterns(
        self,
        experiences: list[LearningExperience],
    ) -> list[str]:
        """识别成功模式"""
        patterns: list[str] = []
        successful = [e for e in experiences if e.success]

        if not successful:
            return patterns

        # 分析成功经验的共同特征
        task_types: dict[str, int] = defaultdict(int)
        for exp in successful:
            task_types[exp.task_type] += 1

        # 找出最常见的成功任务类型
        common_tasks = sorted(
            task_types.items(),
            key=lambda x: x[1],
            reverse=True,
        )[:3]

        for task_type, count in common_tasks:
            if count >= 2:
                patterns.append(f"在{task_type}任务上表现优异（{count}次成功）")

        return patterns

    def _identify_failure_patterns(
        self,
        experiences: list[LearningExperience],
    ) -> list[str]:
        """识别失败模式"""
        patterns: list[str] = []
        failed = [e for e in experiences if not e.success]

        if not failed:
            return patterns

        # 收集常见错误
        mistake_counts: dict[str, int] = defaultdict(int)
        for exp in failed:
            for mistake in exp.mistakes_made:
                mistake_counts[mistake] += 1

        # 找出最常见的错误
        common_mistakes = sorted(
            mistake_counts.items(),
            key=lambda x: x[1],
            reverse=True,
        )[:3]

        for mistake, count in common_mistakes:
            if count >= 2:
                patterns.append(f"常见错误：{mistake}（出现{count}次）")

        return patterns

    def _identify_best_practices(
        self,
        experiences: list[LearningExperience],
    ) -> list[str]:
        """识别最佳实践"""
        practices = []

        # 找出表现最好的经验
        top_experiences = sorted(
            experiences,
            key=lambda e: e.performance_score,
            reverse=True,
        )[:5]

        for exp in top_experiences:
            if exp.performance_score >= 0.8 and exp.improvements:
                for improvement in exp.improvements[:2]:
                    practices.append(f"最佳实践：{improvement}（得分{exp.performance_score:.2f}）")

        return practices

    def optimize_agents(
        self,
        session: TrainingSession,
    ) -> dict[str, float]:
        """优化智能体"""
        improvements = {}

        for agent_id in session.participating_agents:
            # 计算基于共享知识的改进
            agent_experiences = self.experiences.get(agent_id, [])
            if not agent_experiences:
                improvements[agent_id] = 0.0
                continue

            # 计算平均性能
            avg_performance = sum(
                e.performance_score for e in agent_experiences
            ) / len(agent_experiences)

            # 考虑共享知识的贡献
            shared_knowledge_used = [
                k for k in session.knowledge_shared
                if k.source_agent_id != agent_id
            ]

            knowledge_bonus = len(shared_knowledge_used) * 0.05
            improvements[agent_id] = min(1.0, avg_performance + knowledge_bonus)

        session.improvements = improvements
        return improvements

    def get_training_summary(self) -> dict[str, Any]:
        """获取训练摘要"""
        total_experiences = sum(len(exp) for exp in self.experiences.values())
        total_knowledge = len(self.shared_knowledge)

        # 计算整体性能
        all_scores: list[float] = []
        for experiences in self.experiences.values():
            all_scores.extend(e.performance_score for e in experiences)

        avg_performance = sum(all_scores) / len(all_scores) if all_scores else 0.0

        return {
            "total_agents": len(self.agent_capabilities),
            "total_experiences": total_experiences,
            "total_shared_knowledge": total_knowledge,
            "total_training_sessions": len(self.training_sessions),
            "average_performance": avg_performance,
            "knowledge_validation_rate": self._calculate_validation_rate(),
        }

    def _calculate_validation_rate(self) -> float:
        """计算知识验证率"""
        if not self.shared_knowledge:
            return 0.0

        validated = sum(1 for k in self.shared_knowledge.values() if k.validated)
        return validated / len(self.shared_knowledge)

    def get_agent_performance_report(self, agent_id: str) -> dict[str, Any]:
        """获取智能体性能报告"""
        experiences = self.experiences.get(agent_id, [])
        if not experiences:
            return {
                "agent_id": agent_id,
                "total_experiences": 0,
                "success_rate": 0.0,
                "avg_performance": 0.0,
            }

        successful = sum(1 for e in experiences if e.success)
        avg_performance = sum(e.performance_score for e in experiences) / len(experiences)

        return {
            "agent_id": agent_id,
            "total_experiences": len(experiences),
            "success_rate": successful / len(experiences),
            "avg_performance": avg_performance,
            "recent_trend": [
                e.performance_score for e in experiences[-5:]
            ],
            "common_mistakes": self._get_common_mistakes(experiences),
        }

    def _get_common_mistakes(
        self,
        experiences: list[LearningExperience],
    ) -> list[str]:
        """获取常见错误"""
        mistake_counts: dict[str, int] = defaultdict(int)
        for exp in experiences:
            if not exp.success:
                for mistake in exp.mistakes_made:
                    mistake_counts[mistake] += 1

        sorted_mistakes = sorted(
            mistake_counts.items(),
            key=lambda x: x[1],
            reverse=True,
        )
        return [mistake for mistake, _ in sorted_mistakes[:5]]
