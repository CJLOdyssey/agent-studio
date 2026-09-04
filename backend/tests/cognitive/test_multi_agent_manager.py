"""Tests for cognitive/multi_agent_manager.py — MultiAgentCognitiveManager."""

from unittest.mock import MagicMock, patch

import pytest

from cognitive.multi_agent_manager import MultiAgentCognitiveManager


class TestMultiAgentCognitiveManagerInit:
    def test_init_empty(self):
        manager = MultiAgentCognitiveManager()
        assert manager.cognitive_analyzers == {}
        assert manager.alignment_engines == {}
        assert manager.session_history == []
        assert manager.collaborative_trainer is not None


class TestRegisterAgent:
    def test_register_agent_creates_analyzer_and_engine(self):
        manager = MultiAgentCognitiveManager()
        manager.register_agent("a1", {"skill": "coding"})
        assert "a1" in manager.cognitive_analyzers
        assert "a1" in manager.alignment_engines
        assert manager.collaborative_trainer.agent_capabilities["a1"] == {"skill": "coding"}

    def test_register_agent_without_capabilities(self):
        manager = MultiAgentCognitiveManager()
        manager.register_agent("a1")
        assert manager.collaborative_trainer.agent_capabilities["a1"] == {}

    def test_register_multiple_agents(self):
        manager = MultiAgentCognitiveManager()
        manager.register_agent("a1")
        manager.register_agent("a2")
        assert len(manager.cognitive_analyzers) == 2
        assert len(manager.alignment_engines) == 2


class TestAnalyzeCognitiveState:
    def test_unregistered_agent_raises(self):
        manager = MultiAgentCognitiveManager()
        with pytest.raises(ValueError, match="not registered"):
            manager.analyze_cognitive_state("unknown", "response", {})

    @patch("cognitive.multi_agent_manager.CognitiveStateAnalyzer.analyze_response")
    def test_registered_agent_calls_analyzer(self, mock_analyze):
        mock_report = MagicMock()
        mock_analyze.return_value = mock_report
        manager = MultiAgentCognitiveManager()
        manager.register_agent("a1")
        result = manager.analyze_cognitive_state("a1", "response text", {"task": "test"})
        mock_analyze.assert_called_once_with("response text", {"task": "test"})
        assert result is mock_report


class TestGenerateAlignmentReport:
    def test_unregistered_agent_raises(self):
        manager = MultiAgentCognitiveManager()
        with pytest.raises(ValueError, match="not registered"):
            manager.generate_alignment_report(
                "unknown", "d1", "decision", "type", {}
            )

    @patch("cognitive.multi_agent_manager.ReasonAlignmentEngine.generate_alignment_report")
    def test_registered_agent_calls_engine(self, mock_gen):
        mock_report = MagicMock()
        mock_gen.return_value = mock_report
        manager = MultiAgentCognitiveManager()
        manager.register_agent("a1")
        result = manager.generate_alignment_report(
            "a1", "d1", "my decision", "task_type", {"ctx": 1}
        )
        mock_gen.assert_called_once_with(
            decision_id="d1",
            decision="my decision",
            decision_type="task_type",
            context={"ctx": 1},
        )
        assert result is mock_report


class TestRecordLearningExperience:
    def test_records_experience(self):
        manager = MultiAgentCognitiveManager()
        manager.register_agent("a1")
        exp = manager.record_learning_experience(
            agent_id="a1",
            task_type="coding",
            task_context={"lang": "python"},
            success=True,
            outcome="completed",
            performance_score=0.85,
        )
        assert exp.agent_id == "a1"
        assert exp.success is True
        assert exp.performance_score == 0.85
        assert len(manager.collaborative_trainer.experiences["a1"]) == 1

    def test_defaults_for_optional_fields(self):
        manager = MultiAgentCognitiveManager()
        manager.register_agent("a1")
        exp = manager.record_learning_experience(
            agent_id="a1",
            task_type="test",
            task_context={},
            success=False,
            outcome="failed",
            performance_score=0.2,
        )
        assert exp.knowledge_gained == []
        assert exp.mistakes_made == []
        assert exp.improvements == []


class TestConductCollaborativeTraining:
    def test_training_produces_result(self):
        manager = MultiAgentCognitiveManager()
        manager.register_agent("a1")
        manager.register_agent("a2")
        result = manager.conduct_collaborative_training(
            participating_agents=["a1", "a2"],
            training_objectives=["improve_coding"],
        )
        assert "session_id" in result
        assert "shared_knowledge_count" in result
        assert "collective_insights" in result
        assert "improvements" in result
        assert "timestamp" in result
        assert len(manager.session_history) == 1

    def test_training_records_history(self):
        manager = MultiAgentCognitiveManager()
        manager.conduct_collaborative_training(["a1"])
        manager.conduct_collaborative_training(["a1"])
        assert len(manager.session_history) == 2


class TestGetSystemSummary:
    def test_empty_system_summary(self):
        manager = MultiAgentCognitiveManager()
        summary = manager.get_system_summary()
        assert summary["total_agents"] == 0
        assert summary["cognitive_states"] == {}
        assert summary["alignment_statistics"] == {}
        assert summary["total_training_sessions"] == 0

    def test_summary_with_registered_agents(self):
        manager = MultiAgentCognitiveManager()
        manager.register_agent("a1")
        summary = manager.get_system_summary()
        assert summary["total_agents"] == 1
        assert "a1" in summary["cognitive_states"]
        assert "a1" in summary["alignment_statistics"]
        assert "training_summary" in summary


class TestGetAgentComprehensiveReport:
    def test_unregistered_agent_raises(self):
        manager = MultiAgentCognitiveManager()
        with pytest.raises(ValueError, match="not registered"):
            manager.get_agent_comprehensive_report("unknown")

    def test_report_with_registered_agent(self):
        manager = MultiAgentCognitiveManager()
        manager.register_agent("a1")
        report = manager.get_agent_comprehensive_report("a1")
        assert report["agent_id"] == "a1"
        assert "cognitive_state" in report
        assert "alignment" in report
        assert "performance" in report
