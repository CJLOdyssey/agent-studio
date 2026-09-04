"""Tests for cognitive/cognitive_state.py — CognitiveStateAnalyzer."""

from unittest.mock import patch

import pytest

from cognitive.cognitive_state import CognitiveStateAnalyzer
from cognitive.state_models import ConfidenceLevel, KnowledgeBoundary


class TestCognitiveStateAnalyzerInit:
    def test_init_sets_agent_id_and_empty_history(self):
        analyzer = CognitiveStateAnalyzer(agent_id="agent_1")
        assert analyzer.agent_id == "agent_1"
        assert analyzer.history == []


class TestAnalyzeConfidence:
    """_analyze_confidence covers the confidence scoring logic."""

    def test_high_confidence_words_boost_score(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_confidence(
            "确定这很明确，毫无疑问", {"complexity": "low", "completeness": 1.0}
        )
        assert result["confidence"] > 0.8
        assert result["level"] in (ConfidenceLevel.HIGH, ConfidenceLevel.VERY_HIGH)

    def test_low_confidence_words_lower_score(self):
        analyzer = CognitiveStateAnalyzer("a1")
        # All low indicators + high complexity + low completeness → very low overall
        result = analyzer._analyze_confidence(
            "可能也许不确定大概", {"complexity": "high", "completeness": 0.2}
        )
        assert result["confidence"] < 0.6
        assert result["level"] in (ConfidenceLevel.LOW, ConfidenceLevel.VERY_LOW, ConfidenceLevel.MEDIUM)

    def test_neutral_text_gives_default_linguistic_confidence(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_confidence("some neutral text", {})
        # No indicators → linguistic_confidence = 0.6
        assert result["factors"]["linguistic_confidence"] == pytest.approx(0.6)

    def test_high_complexity_reduces_overall_confidence(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_confidence(
            "确定", {"complexity": "high", "completeness": 1.0}
        )
        assert result["factors"]["task_complexity_factor"] == 0.5

    def test_low_complexity_boosts_confidence(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_confidence(
            "确定", {"complexity": "low", "completeness": 1.0}
        )
        assert result["factors"]["task_complexity_factor"] == 0.9

    def test_context_completeness_affects_confidence(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_confidence(
            "确定", {"complexity": "medium", "completeness": 0.3}
        )
        assert result["factors"]["context_completeness"] == 0.3

    def test_unknown_complexity_uses_default(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_confidence("确定", {"complexity": "unknown"})
        assert result["factors"]["task_complexity_factor"] == 0.7

    def test_very_high_threshold(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_confidence(
            "确定明确肯定毫无疑问显然definitely",
            {"complexity": "low", "completeness": 1.0},
        )
        assert result["level"] == ConfidenceLevel.VERY_HIGH

    def test_medium_threshold(self):
        analyzer = CognitiveStateAnalyzer("a1")
        # Mix of low indicators + high complexity + medium completeness → LOW or MEDIUM
        result = analyzer._analyze_confidence(
            "maybe perhaps", {"complexity": "high", "completeness": 0.5}
        )
        assert result["level"] in (ConfidenceLevel.LOW, ConfidenceLevel.MEDIUM, ConfidenceLevel.VERY_LOW)


class TestAnalyzeUncertainty:
    def test_no_uncertainty_patterns_returns_empty(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_uncertainty("Hello world", {})
        assert result["sources"] == []
        assert result["level"] == pytest.approx(0.0)

    def test_info_insufficient_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_uncertainty("缺少信息无法继续", {})
        assert "信息不足" in result["sources"]

    def test_task_ambiguous_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_uncertainty("需求模糊无法判断", {})
        assert "任务模糊" in result["sources"]

    def test_knowledge_limit_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_uncertainty("这超出知识范围了", {})
        assert "知识限制" in result["sources"]

    def test_method_uncertain_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_uncertainty("不确定方法来完成", {})
        assert "方法不确定" in result["sources"]

    def test_multiple_sources_increase_level(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_uncertainty(
            "缺少信息 任务不明确 不了解 可能的方法", {}
        )
        assert len(result["sources"]) >= 3
        assert result["level"] > 0.5

    def test_low_completeness_adds_uncertainty(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_uncertainty("Hello", {"completeness": 0.2})
        # Even with no pattern matches, low completeness pushes level > 0
        assert result["level"] > 0.0


class TestAnalyzeKnowledgeBoundary:
    def test_within_scope_default(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_knowledge_boundary("All good", {})
        assert result["boundary"] == KnowledgeBoundary.WITHIN_SCOPE
        assert result["requires_external"] is False

    def test_at_boundary_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_knowledge_boundary("不太确定是否正确", {})
        assert result["boundary"] == KnowledgeBoundary.AT_BOUNDARY

    def test_beyond_scope_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_knowledge_boundary("这超出范围了", {})
        assert result["boundary"] == KnowledgeBoundary.BEYOND_SCOPE
        assert result["requires_external"] is True

    def test_requires_verification_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_knowledge_boundary("需要验证一下", {})
        assert result["boundary"] == KnowledgeBoundary.REQUIRES_VERIFICATION
        assert result["requires_external"] is True

    def test_knowledge_gap_domain_missing(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_knowledge_boundary("我不知道答案", {})
        assert "特定领域知识缺失" in result["gaps"]

    def test_knowledge_gap_incomplete_context(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_knowledge_boundary("需要更多信息来回答", {})
        assert "任务上下文不完整" in result["gaps"]


class TestExtractReasoningSteps:
    def test_no_steps_returns_empty(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._extract_reasoning_steps("Hello world")
        assert result == []

    def test_chinese_step_markers_extracted(self):
        analyzer = CognitiveStateAnalyzer("a1")
        text = "第一步分析需求\n第二步设计架构\n接着实现代码"
        result = analyzer._extract_reasoning_steps(text)
        assert len(result) == 3
        assert result[0].step_id == "step_1"
        assert result[1].step_id == "step_2"
        assert result[2].step_id == "step_3"

    def test_numbered_list_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        text = "1. First step\n2. Second step"
        result = analyzer._extract_reasoning_steps(text)
        assert len(result) == 2

    def test_mixed_markers(self):
        analyzer = CognitiveStateAnalyzer("a1")
        text = "首先做A\n然后做B\n接着做C\n最后做D"
        result = analyzer._extract_reasoning_steps(text)
        assert len(result) == 4

    def test_empty_lines_skipped(self):
        analyzer = CognitiveStateAnalyzer("a1")
        text = "\n\n第一步A\n\n\n第二步B\n\n"
        result = analyzer._extract_reasoning_steps(text)
        assert len(result) == 2


class TestAnalyzeSelfAwareness:
    def test_no_awareness_by_default(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_self_awareness("Hello")
        assert result["acknowledges_limitations"] is False
        assert result["expresses_uncertainty"] is False
        assert result["offers_alternatives"] is False
        assert result["requests_clarification"] is False

    def test_limitations_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_self_awareness("我的能力有限，这超出了我的")
        assert result["acknowledges_limitations"] is True

    def test_uncertainty_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_self_awareness("我不确定可能是什么")
        assert result["expresses_uncertainty"] is True

    def test_alternatives_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_self_awareness("你可以尝试另一种方法")
        assert result["offers_alternatives"] is True

    def test_clarification_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_self_awareness("需要更多信息请澄清")
        assert result["requests_clarification"] is True

    def test_english_phrases_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._analyze_self_awareness(
            "maybe perhaps uncertain beyond my ability alternative"
        )
        assert result["expresses_uncertainty"] is True
        assert result["acknowledges_limitations"] is True
        assert result["offers_alternatives"] is True


class TestIdentifyLimitations:
    def test_no_limitations(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._identify_limitations("Everything works", {})
        assert result == []

    def test_cannot_access_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._identify_limitations("无法访问该资源", {})
        assert "无法访问外部资源" in result

    def test_realtime_info_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._identify_limitations("缺乏实时信息", {})
        assert "缺乏实时信息" in result

    def test_personal_experience_detected(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._identify_limitations("个人经验不足", {})
        assert "缺乏个人经验" in result

    def test_context_requires_external(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._identify_limitations(
            "ok", {"requires_external_knowledge": True}
        )
        assert "需要外部知识库支持" in result

    def test_high_complexity_adds_limitation(self):
        analyzer = CognitiveStateAnalyzer("a1")
        result = analyzer._identify_limitations("ok", {"complexity": "high"})
        assert "任务复杂度高" in result


class TestGenerateRecommendations:
    def test_low_confidence_recommendations(self):
        analyzer = CognitiveStateAnalyzer("a1")
        report = analyzer.analyze_response(
            "不确定可能也许", {"complexity": "high", "completeness": 0.3}
        )
        assert any("人类专家验证" in r for r in report.recommendations)

    def test_beyond_scope_recommendations(self):
        analyzer = CognitiveStateAnalyzer("a1")
        report = analyzer.analyze_response(
            "这超出了我的范围无法回答", {}
        )
        assert any("专业领域智能体" in r for r in report.recommendations)

    def test_clarification_recommendations(self):
        analyzer = CognitiveStateAnalyzer("a1")
        report = analyzer.analyze_response(
            "需要更多信息请澄清", {}
        )
        assert any("澄清需求" in r for r in report.recommendations)


class TestAnalyzeResponseIntegration:
    def test_full_analysis_returns_report(self):
        analyzer = CognitiveStateAnalyzer("test_agent")
        report = analyzer.analyze_response(
            response="确定这很明确，第一步分析需求",
            context={"complexity": "low", "completeness": 1.0},
        )
        assert report.agent_id == "test_agent"
        assert report.overall_confidence > 0
        assert isinstance(report.confidence_level, ConfidenceLevel)
        assert isinstance(report.knowledge_boundary, KnowledgeBoundary)
        assert len(report.reasoning_steps) >= 1
        assert "第一步分析需求" in report.reasoning_chain[0]

    def test_report_added_to_history(self):
        analyzer = CognitiveStateAnalyzer("test_agent")
        assert len(analyzer.history) == 0
        analyzer.analyze_response("Hello", {})
        assert len(analyzer.history) == 1

    def test_metadata_defaults_to_none(self):
        analyzer = CognitiveStateAnalyzer("test_agent")
        report = analyzer.analyze_response("Hello", {}, metadata=None)
        assert report is not None


class TestGetConfidenceTrend:
    def test_empty_history_returns_empty(self):
        analyzer = CognitiveStateAnalyzer("a1")
        assert analyzer.get_confidence_trend() == []

    def test_returns_last_n_confidences(self):
        analyzer = CognitiveStateAnalyzer("a1")
        for _ in range(3):
            analyzer.analyze_response("确定", {})
        trend = analyzer.get_confidence_trend(last_n=2)
        assert len(trend) == 2
        assert all(isinstance(v, float) for v in trend)


class TestGetSummary:
    def test_empty_history_summary(self):
        analyzer = CognitiveStateAnalyzer("a1")
        summary = analyzer.get_summary()
        assert summary["agent_id"] == "a1"
        assert summary["total_reports"] == 0
        assert summary["avg_confidence"] == 0.0

    def test_non_empty_history_summary(self):
        analyzer = CognitiveStateAnalyzer("a1")
        analyzer.analyze_response("确定", {})
        analyzer.analyze_response("可能", {"complexity": "high"})
        summary = analyzer.get_summary()
        assert summary["total_reports"] == 2
        assert summary["avg_confidence"] > 0
        assert "confidence_trend" in summary

    def test_common_limitations(self):
        analyzer = CognitiveStateAnalyzer("a1")
        analyzer.analyze_response("无法访问 无法访问 无法访问", {})
        summary = analyzer.get_summary()
        assert "无法访问外部资源" in summary["common_limitations"]
