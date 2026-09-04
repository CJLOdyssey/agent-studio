"""Tests for cognitive/collaborative_training.py — CollaborativeTrainer."""

from unittest.mock import MagicMock

import pytest

from cognitive.collaborative_training import CollaborativeTrainer
from cognitive.training_models import KnowledgeType, LearningExperience, SharedKnowledge, TrainingSession


def _make_experience(
    agent_id: str = "agent_1",
    success: bool = True,
    task_type: str = "coding",
    performance_score: float = 0.8,
    knowledge_gained: list | None = None,
    mistakes_made: list | None = None,
    improvements: list | None = None,
) -> LearningExperience:
    return LearningExperience(
        experience_id=f"exp_{agent_id}",
        agent_id=agent_id,
        task_type=task_type,
        success=success,
        performance_score=performance_score,
        knowledge_gained=knowledge_gained or [],
        mistakes_made=mistakes_made or [],
        improvements=improvements or [],
    )


class TestCollaborativeTrainerInit:
    def test_init_empty(self):
        trainer = CollaborativeTrainer()
        assert trainer.experiences == {}
        assert trainer.shared_knowledge == {}
        assert trainer.training_sessions == []
        assert trainer.agent_capabilities == {}


class TestRegisterAgent:
    def test_register_agent_with_capabilities(self):
        trainer = CollaborativeTrainer()
        trainer.register_agent("a1", {"skill": "coding"})
        assert "a1" in trainer.agent_capabilities
        assert trainer.agent_capabilities["a1"] == {"skill": "coding"}

    def test_register_agent_without_capabilities(self):
        trainer = CollaborativeTrainer()
        trainer.register_agent("a1")
        assert trainer.agent_capabilities["a1"] == {}

    def test_register_agent_initializes_experiences(self):
        trainer = CollaborativeTrainer()
        trainer.register_agent("a1")
        assert "a1" in trainer.experiences
        assert trainer.experiences["a1"] == []


class TestShareKnowledge:
    def test_share_knowledge_returns_shared_knowledge(self):
        trainer = CollaborativeTrainer()
        trainer.register_agent("a1")
        result = trainer.share_knowledge(
            agent_id="a1",
            knowledge_type=KnowledgeType.FACTUAL,
            content="Python is great",
            applicable_tasks=["coding"],
            confidence=0.9,
        )
        assert isinstance(result, SharedKnowledge)
        assert result.knowledge_id.startswith("k_a1_")
        assert result.content == "Python is great"
        assert result.confidence == 0.9
        assert "coding" in result.applicable_tasks

    def test_share_knowledge_stored(self):
        trainer = CollaborativeTrainer()
        trainer.share_knowledge(
            agent_id="a1",
            knowledge_type=KnowledgeType.PROCEDURAL,
            content="Step by step",
        )
        assert len(trainer.shared_knowledge) == 1

    def test_share_knowledge_default_applicable_tasks(self):
        trainer = CollaborativeTrainer()
        result = trainer.share_knowledge(
            agent_id="a1",
            knowledge_type=KnowledgeType.STRATEGIC,
            content="Strategy",
        )
        assert result.applicable_tasks == []

    def test_multiple_shares_increment_id(self):
        trainer = CollaborativeTrainer()
        k1 = trainer.share_knowledge("a1", KnowledgeType.FACTUAL, "A")
        k2 = trainer.share_knowledge("a1", KnowledgeType.FACTUAL, "B")
        assert k1.knowledge_id != k2.knowledge_id


class TestValidateKnowledge:
    def test_validate_existing_knowledge(self):
        trainer = CollaborativeTrainer()
        k = trainer.share_knowledge("a1", KnowledgeType.FACTUAL, "content")
        trainer.validate_knowledge(k.knowledge_id, True, 0.85)
        assert k.validation_count == 1
        assert k.validated is True
        assert k.validation_score == pytest.approx(0.85)

    def test_validate_nonexistent_knowledge_noop(self):
        trainer = CollaborativeTrainer()
        # Should not raise
        trainer.validate_knowledge("nonexistent", True, 0.5)

    def test_validation_score_moving_average(self):
        trainer = CollaborativeTrainer()
        k = trainer.share_knowledge("a1", KnowledgeType.FACTUAL, "content")
        trainer.validate_knowledge(k.knowledge_id, True, 0.9)
        trainer.validate_knowledge(k.knowledge_id, True, 0.7)
        # Moving average: 0.9 * 0.7 + 0.7 * 0.3 = 0.63 + 0.21 = 0.84
        assert k.validation_score == pytest.approx(0.84)
        assert k.validation_count == 2


class TestGetRelevantKnowledge:
    def test_filter_by_confidence(self):
        trainer = CollaborativeTrainer()
        k1 = trainer.share_knowledge("a1", KnowledgeType.FACTUAL, "high", confidence=0.9)
        k2 = trainer.share_knowledge("a1", KnowledgeType.FACTUAL, "low", confidence=0.3)
        result = trainer.get_relevant_knowledge("coding", min_confidence=0.5)
        assert len(result) == 1
        assert result[0].knowledge_id == k1.knowledge_id

    def test_filter_by_task_type(self):
        trainer = CollaborativeTrainer()
        trainer.share_knowledge(
            "a1", KnowledgeType.FACTUAL, "coding tip",
            applicable_tasks=["coding"],
        )
        trainer.share_knowledge(
            "a1", KnowledgeType.FACTUAL, "writing tip",
            applicable_tasks=["writing"],
        )
        result = trainer.get_relevant_knowledge("coding")
        assert len(result) == 1
        assert "coding" in result[0].applicable_tasks

    def test_empty_applicable_tasks_matches_all(self):
        trainer = CollaborativeTrainer()
        trainer.share_knowledge("a1", KnowledgeType.FACTUAL, "general")
        result = trainer.get_relevant_knowledge("any_task")
        assert len(result) == 1

    def test_sorted_by_confidence_times_validation_score(self):
        trainer = CollaborativeTrainer()
        k1 = trainer.share_knowledge("a1", KnowledgeType.FACTUAL, "A", confidence=0.9)
        k2 = trainer.share_knowledge("a1", KnowledgeType.FACTUAL, "B", confidence=0.8)
        trainer.validate_knowledge(k1.knowledge_id, True, 0.5)
        trainer.validate_knowledge(k2.knowledge_id, True, 0.95)
        result = trainer.get_relevant_knowledge("any")
        # k2: 0.8 * 0.95 = 0.76, k1: 0.9 * 0.5 = 0.45
        assert result[0].knowledge_id == k2.knowledge_id


class TestStartTrainingSession:
    def test_start_session(self):
        trainer = CollaborativeTrainer()
        session = trainer.start_training_session(
            "s1", ["a1", "a2"], ["learn_coding"]
        )
        assert isinstance(session, TrainingSession)
        assert session.session_id == "s1"
        assert session.participating_agents == ["a1", "a2"]
        assert session.training_objectives == ["learn_coding"]
        assert len(trainer.training_sessions) == 1

    def test_start_session_default_objectives(self):
        trainer = CollaborativeTrainer()
        session = trainer.start_training_session("s1", ["a1"])
        assert session.training_objectives == []


class TestRecordExperience:
    def test_record_experience(self):
        trainer = CollaborativeTrainer()
        exp = _make_experience()
        trainer.record_experience("a1", exp)
        assert len(trainer.experiences["a1"]) == 1

    def test_record_multiple_experiences(self):
        trainer = CollaborativeTrainer()
        trainer.record_experience("a1", _make_experience(performance_score=0.5))
        trainer.record_experience("a1", _make_experience(performance_score=0.9))
        assert len(trainer.experiences["a1"]) == 2


class TestConductKnowledgeSharing:
    def test_shares_from_successful_experiences(self):
        trainer = CollaborativeTrainer()
        trainer.register_agent("a1")
        exp = _make_experience(
            success=True,
            performance_score=0.8,
            knowledge_gained=[
                {"type": "factual", "content": "Python tip"},
            ],
        )
        trainer.record_experience("a1", exp)
        session = trainer.start_training_session("s1", ["a1"])
        shared = trainer.conduct_knowledge_sharing(session)
        assert len(shared) == 1
        assert shared[0].content == "Python tip"

    def test_failed_experiences_not_shared(self):
        trainer = CollaborativeTrainer()
        trainer.register_agent("a1")
        exp = _make_experience(success=False)
        trainer.record_experience("a1", exp)
        session = trainer.start_training_session("s1", ["a1"])
        shared = trainer.conduct_knowledge_sharing(session)
        assert len(shared) == 0

    def test_no_knowledge_gained_not_shared(self):
        trainer = CollaborativeTrainer()
        trainer.register_agent("a1")
        exp = _make_experience(success=True, knowledge_gained=[])
        trainer.record_experience("a1", exp)
        session = trainer.start_training_session("s1", ["a1"])
        shared = trainer.conduct_knowledge_sharing(session)
        assert len(shared) == 0

    def test_only_last_5_experiences_shared(self):
        trainer = CollaborativeTrainer()
        trainer.register_agent("a1")
        for i in range(8):
            trainer.record_experience(
                "a1",
                _make_experience(
                    success=True,
                    knowledge_gained=[{"type": "factual", "content": f"tip_{i}"}],
                ),
            )
        session = trainer.start_training_session("s1", ["a1"])
        shared = trainer.conduct_knowledge_sharing(session)
        assert len(shared) == 5
        assert shared[0].content == "tip_3"  # Last 5: tip_3..tip_7


class TestConductCollectiveLearning:
    def test_identifies_success_patterns(self):
        trainer = CollaborativeTrainer()
        trainer.register_agent("a1")
        for _ in range(3):
            trainer.record_experience(
                "a1",
                _make_experience(success=True, task_type="coding", performance_score=0.9),
            )
        session = trainer.start_training_session("s1", ["a1"])
        insights = trainer.conduct_collective_learning(session)
        assert any("coding" in i and "成功" in i for i in insights)

    def test_identifies_failure_patterns(self):
        trainer = CollaborativeTrainer()
        trainer.register_agent("a1")
        for _ in range(3):
            trainer.record_experience(
                "a1",
                _make_experience(
                    success=False,
                    mistakes_made=["off-by-one error"],
                ),
            )
        session = trainer.start_training_session("s1", ["a1"])
        insights = trainer.conduct_collective_learning(session)
        assert any("off-by-one" in i for i in insights)

    def test_identifies_best_practices(self):
        trainer = CollaborativeTrainer()
        trainer.register_agent("a1")
        trainer.record_experience(
            "a1",
            _make_experience(
                success=True,
                performance_score=0.95,
                improvements=["use type hints"],
            ),
        )
        session = trainer.start_training_session("s1", ["a1"])
        insights = trainer.conduct_collective_learning(session)
        assert any("type hints" in i for i in insights)

    def test_empty_experiences_no_insights(self):
        trainer = CollaborativeTrainer()
        session = trainer.start_training_session("s1", ["a1"])
        insights = trainer.conduct_collective_learning(session)
        assert insights == []


class TestOptimizeAgents:
    def test_agent_without_experiences_gets_zero(self):
        trainer = CollaborativeTrainer()
        session = trainer.start_training_session("s1", ["a1"])
        result = trainer.optimize_agents(session)
        assert result["a1"] == 0.0

    def test_agent_performance_with_knowledge_bonus(self):
        trainer = CollaborativeTrainer()
        trainer.register_agent("a1")
        trainer.register_agent("a2")
        trainer.record_experience("a1", _make_experience(performance_score=0.7))
        # a2 shares knowledge
        trainer.record_experience("a2", _make_experience(performance_score=0.8))
        session = trainer.start_training_session("s1", ["a1", "a2"])
        # Simulate knowledge sharing
        session.knowledge_shared = [
            MagicMock(source_agent_id="a2"),
            MagicMock(source_agent_id="a2"),
        ]
        result = trainer.optimize_agents(session)
        # a1 gets avg 0.7 + 2*0.05 = 0.8 (knowledge from a2)
        assert result["a1"] == pytest.approx(0.8)
        assert session.improvements == result

    def test_improvement_capped_at_1_0(self):
        trainer = CollaborativeTrainer()
        trainer.register_agent("a1")
        trainer.record_experience("a1", _make_experience(performance_score=0.95))
        session = trainer.start_training_session("s1", ["a1"])
        session.knowledge_shared = [MagicMock(source_agent_id="other")] * 5
        result = trainer.optimize_agents(session)
        assert result["a1"] == 1.0


class TestGetTrainingSummary:
    def test_empty_summary(self):
        trainer = CollaborativeTrainer()
        summary = trainer.get_training_summary()
        assert summary["total_agents"] == 0
        assert summary["total_experiences"] == 0
        assert summary["total_shared_knowledge"] == 0
        assert summary["average_performance"] == 0.0

    def test_summary_with_data(self):
        trainer = CollaborativeTrainer()
        trainer.register_agent("a1", {"skill": "x"})
        trainer.record_experience("a1", _make_experience(performance_score=0.8))
        trainer.share_knowledge("a1", KnowledgeType.FACTUAL, "tip")
        summary = trainer.get_training_summary()
        assert summary["total_agents"] == 1
        assert summary["total_experiences"] == 1
        assert summary["total_shared_knowledge"] == 1
        assert summary["average_performance"] == pytest.approx(0.8)

    def test_validation_rate(self):
        trainer = CollaborativeTrainer()
        k = trainer.share_knowledge("a1", KnowledgeType.FACTUAL, "A")
        trainer.validate_knowledge(k.knowledge_id, True, 0.9)
        k2 = trainer.share_knowledge("a1", KnowledgeType.FACTUAL, "B")
        # k2 not validated
        summary = trainer.get_training_summary()
        assert summary["knowledge_validation_rate"] == pytest.approx(0.5)


class TestGetAgentPerformanceReport:
    def test_no_experiences(self):
        trainer = CollaborativeTrainer()
        report = trainer.get_agent_performance_report("a1")
        assert report["total_experiences"] == 0
        assert report["success_rate"] == 0.0

    def test_with_experiences(self):
        trainer = CollaborativeTrainer()
        trainer.record_experience(
            "a1",
            _make_experience(
                success=True,
                performance_score=0.9,
                mistakes_made=["bug in loop"],
            ),
        )
        trainer.record_experience(
            "a1",
            _make_experience(
                success=False,
                performance_score=0.4,
                mistakes_made=["off-by-one"],
            ),
        )
        report = trainer.get_agent_performance_report("a1")
        assert report["total_experiences"] == 2
        assert report["success_rate"] == pytest.approx(0.5)
        assert report["avg_performance"] == pytest.approx(0.65)
        assert "off-by-one" in report["common_mistakes"]
