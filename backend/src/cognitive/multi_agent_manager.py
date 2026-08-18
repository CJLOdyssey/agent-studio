"""多智能体认知系统管理器 - Multi-Agent Cognitive System Manager

集成认知状态报告、理由对齐和协同训练功能到多智能体协作系统
"""

from datetime import datetime
from typing import Any

from cognitive.cognitive_state import CognitiveStateAnalyzer, CognitiveStateReport
from cognitive.collaborative_training import CollaborativeTrainer, LearningExperience
from cognitive.reason_alignment import AlignmentReport, ReasonAlignmentEngine
from core.infra.logging_config import get_logger

logger = get_logger(__name__)


class MultiAgentCognitiveManager:
    """多智能体认知系统管理器"""

    def __init__(self) -> None:
        self.cognitive_analyzers: dict[str, CognitiveStateAnalyzer] = {}
        self.alignment_engines: dict[str, ReasonAlignmentEngine] = {}
        self.collaborative_trainer = CollaborativeTrainer()
        self.session_history: list[dict[str, Any]] = []

    def register_agent(
        self,
        agent_id: str,
        capabilities: dict[str, Any] | None = None,
    ) -> None:
        """注册智能体"""
        self.cognitive_analyzers[agent_id] = CognitiveStateAnalyzer(agent_id)
        self.alignment_engines[agent_id] = ReasonAlignmentEngine(agent_id)
        self.collaborative_trainer.register_agent(agent_id, capabilities)
        logger.info(f"Registered agent: {agent_id}")

    def analyze_cognitive_state(
        self,
        agent_id: str,
        response: str,
        context: dict[str, Any],
    ) -> CognitiveStateReport:
        """分析智能体认知状态"""
        if agent_id not in self.cognitive_analyzers:
            raise ValueError(f"Agent {agent_id} not registered")

        analyzer = self.cognitive_analyzers[agent_id]
        report = analyzer.analyze_response(response, context)
        logger.debug(f"Cognitive state analyzed for agent {agent_id}")
        return report

    def generate_alignment_report(
        self,
        agent_id: str,
        decision_id: str,
        decision: str,
        decision_type: str,
        context: dict[str, Any],
    ) -> AlignmentReport:
        """生成对齐报告"""
        if agent_id not in self.alignment_engines:
            raise ValueError(f"Agent {agent_id} not registered")

        engine = self.alignment_engines[agent_id]
        report = engine.generate_alignment_report(
            decision_id=decision_id,
            decision=decision,
            decision_type=decision_type,
            context=context,
        )
        logger.debug(f"Alignment report generated for agent {agent_id}")
        return report

    def record_learning_experience(
        self,
        agent_id: str,
        task_type: str,
        task_context: dict[str, Any],
        success: bool,
        outcome: str,
        performance_score: float,
        knowledge_gained: list[dict[str, Any]] | None = None,
        mistakes_made: list[str] | None = None,
        improvements: list[str] | None = None,
    ) -> LearningExperience:
        """记录学习经验"""
        experience = LearningExperience(
            experience_id=f"exp_{agent_id}_{datetime.now().timestamp()}",
            agent_id=agent_id,
            task_type=task_type,
            task_context=task_context,
            success=success,
            outcome=outcome,
            performance_score=performance_score,
            knowledge_gained=knowledge_gained or [],
            mistakes_made=mistakes_made or [],
            improvements=improvements or [],
        )
        self.collaborative_trainer.record_experience(agent_id, experience)
        logger.debug(f"Learning experience recorded for agent {agent_id}")
        return experience

    def conduct_collaborative_training(
        self,
        participating_agents: list[str],
        training_objectives: list[str] | None = None,
    ) -> dict[str, Any]:
        """进行协同训练"""
        session_id = f"session_{datetime.now().timestamp()}"
        session = self.collaborative_trainer.start_training_session(
            session_id=session_id,
            participating_agents=participating_agents,
            objectives=training_objectives,
        )

        # 知识分享
        shared_knowledge = self.collaborative_trainer.conduct_knowledge_sharing(session)

        # 集体学习
        collective_insights = self.collaborative_trainer.conduct_collective_learning(session)

        # 优化智能体
        improvements = self.collaborative_trainer.optimize_agents(session)

        result = {
            "session_id": session_id,
            "shared_knowledge_count": len(shared_knowledge),
            "collective_insights": collective_insights,
            "improvements": improvements,
            "timestamp": datetime.now().isoformat(),
        }

        self.session_history.append(result)
        logger.info(f"Collaborative training completed: {session_id}")
        return result

    def get_system_summary(self) -> dict[str, Any]:
        """获取系统摘要"""
        cognitive_summaries = {}
        for agent_id, analyzer in self.cognitive_analyzers.items():
            cognitive_summaries[agent_id] = analyzer.get_summary()

        alignment_stats = {}
        for agent_id, engine in self.alignment_engines.items():
            alignment_stats[agent_id] = engine.get_alignment_statistics()

        training_summary = self.collaborative_trainer.get_training_summary()

        return {
            "total_agents": len(self.cognitive_analyzers),
            "cognitive_states": cognitive_summaries,
            "alignment_statistics": alignment_stats,
            "training_summary": training_summary,
            "total_training_sessions": len(self.session_history),
        }

    def get_agent_comprehensive_report(self, agent_id: str) -> dict[str, Any]:
        """获取智能体综合报告"""
        if agent_id not in self.cognitive_analyzers:
            raise ValueError(f"Agent {agent_id} not registered")

        cognitive_summary = self.cognitive_analyzers[agent_id].get_summary()
        alignment_stats = self.alignment_engines[agent_id].get_alignment_statistics()
        performance_report = self.collaborative_trainer.get_agent_performance_report(agent_id)

        return {
            "agent_id": agent_id,
            "cognitive_state": cognitive_summary,
            "alignment": alignment_stats,
            "performance": performance_report,
        }
