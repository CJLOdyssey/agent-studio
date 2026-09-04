"""ReasonAlignmentEngine 单元测试"""

from unittest.mock import patch

import pytest

from cognitive.reason_alignment import ReasonAlignmentEngine
from cognitive.reason_models import Evidence, EvidenceType


@pytest.fixture
def engine() -> ReasonAlignmentEngine:
    return ReasonAlignmentEngine(agent_id="agent_1")


@pytest.fixture
def engine_with_rules(engine: ReasonAlignmentEngine) -> ReasonAlignmentEngine:
    engine.add_alignment_rule("r1", "safety", "check safety", priority=2)
    engine.add_alignment_rule("r2", "efficiency", "optimize speed", priority=1)
    return engine


@pytest.fixture
def engine_with_evidence(engine: ReasonAlignmentEngine) -> ReasonAlignmentEngine:
    engine.add_evidence(Evidence(
        evidence_id="e1",
        evidence_type=EvidenceType.FACTUAL,
        content="The system uses Python",
        source="docs",
    ))
    engine.add_evidence(Evidence(
        evidence_id="e2",
        evidence_type=EvidenceType.STATISTICAL,
        content="Performance improved by 20%",
        source="metrics",
    ))
    return engine


class TestAddAlignmentRule:
    def test_add_and_sort(self, engine: ReasonAlignmentEngine) -> None:
        engine.add_alignment_rule("r1", "type_a", "cond1", priority=1)
        engine.add_alignment_rule("r2", "type_b", "cond2", priority=5)
        assert engine.alignment_rules[0]["rule_id"] == "r2"
        assert engine.alignment_rules[1]["rule_id"] == "r1"

    def test_priority_sort(self, engine: ReasonAlignmentEngine) -> None:
        engine.add_alignment_rule("r1", "t", "c", priority=3)
        engine.add_alignment_rule("r2", "t", "c", priority=10)
        engine.add_alignment_rule("r3", "t", "c", priority=1)
        assert [r["rule_id"] for r in engine.alignment_rules] == ["r2", "r1", "r3"]


class TestAddEvidence:
    def test_add(self, engine: ReasonAlignmentEngine) -> None:
        ev = Evidence(evidence_id="e1", evidence_type=EvidenceType.FACTUAL, content="test")
        engine.add_evidence(ev)
        assert "e1" in engine.evidence_store


class TestBuildReasoningChain:
    def test_five_steps(self, engine_with_evidence: ReasonAlignmentEngine) -> None:
        chain = engine_with_evidence.build_reasoning_chain(
            chain_id="c1",
            decision="deploy",
            context={"task": "deploy app", "keywords": ["Python"]},
        )
        assert len(chain.steps) == 5
        assert chain.conclusion == "deploy"

    def test_step_descriptions(self, engine: ReasonAlignmentEngine) -> None:
        chain = engine.build_reasoning_chain("c1", "decision", {})
        descriptions = [s["description"] for s in chain.steps]
        assert "问题理解" in descriptions
        assert "决策制定" in descriptions

    def test_gathers_evidence(self, engine_with_evidence: ReasonAlignmentEngine) -> None:
        chain = engine_with_evidence.build_reasoning_chain(
            "c1", "d", {"keywords": ["Python"]},
        )
        step2 = chain.steps[1]
        assert len(step2["evidence"]) > 0

    def test_applies_rules(self, engine_with_rules: ReasonAlignmentEngine) -> None:
        chain = engine_with_rules.build_reasoning_chain(
            "c1", "d", {"task_type": "safety"},
        )
        step3 = chain.steps[2]
        assert "1" in step3["reasoning"]


class TestEvaluateAlternatives:
    def test_with_pros_cons(self, engine: ReasonAlignmentEngine) -> None:
        context = {
            "alternatives": [
                {"name": "A", "pros": ["fast", "cheap"], "cons": ["risky"]},
                {"name": "B", "pros": ["safe"], "cons": ["slow", "expensive"]},
            ],
        }
        result = engine._evaluate_alternatives("A", context)
        assert len(result) == 2
        assert result[0]["selected"] is True
        assert result[1]["selected"] is False

    def test_score_clamped(self, engine: ReasonAlignmentEngine) -> None:
        context = {
            "alternatives": [
                {"name": "X", "pros": ["a"] * 20, "cons": ["b"] * 20},
            ],
        }
        result = engine._evaluate_alternatives("X", context)
        assert 0.0 <= result[0]["score"] <= 1.0

    def test_no_alternatives(self, engine: ReasonAlignmentEngine) -> None:
        assert engine._evaluate_alternatives("d", {}) == []


class TestGatherRelevantEvidence:
    def test_keyword_match(self, engine_with_evidence: ReasonAlignmentEngine) -> None:
        result = engine_with_evidence._gather_relevant_evidence({"keywords": ["Python"]})
        assert len(result) == 1

    def test_no_match(self, engine_with_evidence: ReasonAlignmentEngine) -> None:
        result = engine_with_evidence._gather_relevant_evidence({"keywords": ["Java"]})
        assert len(result) == 0

    def test_max_5(self, engine: ReasonAlignmentEngine) -> None:
        for i in range(10):
            engine.add_evidence(Evidence(
                evidence_id=f"e{i}",
                evidence_type=EvidenceType.FACTUAL,
                content="keyword match",
            ))
        result = engine._gather_relevant_evidence({"keywords": ["keyword"]})
        assert len(result) <= 5


class TestApplyRules:
    def test_type_match(self, engine_with_rules: ReasonAlignmentEngine) -> None:
        result = engine_with_rules._apply_rules({"task_type": "safety"})
        assert len(result) == 1
        assert result[0]["rule_id"] == "r1"

    def test_condition_match(self, engine_with_rules: ReasonAlignmentEngine) -> None:
        result = engine_with_rules._apply_rules({"info": "check safety"})
        assert len(result) >= 1

    def test_no_match(self, engine_with_rules: ReasonAlignmentEngine) -> None:
        result = engine_with_rules._apply_rules({"task_type": "unknown"})
        assert len(result) == 0


class TestGetAppliedRules:
    def test_active_rules(self, engine_with_rules: ReasonAlignmentEngine) -> None:
        result = engine_with_rules._get_applied_rules({})
        assert "r1" in result
        assert "r2" in result

    def test_inactive_rule_filtered(self, engine: ReasonAlignmentEngine) -> None:
        engine.alignment_rules.append({"rule_id": "r_off", "active": False, "type": "", "condition": "", "priority": 0})
        result = engine._get_applied_rules({})
        assert "r_off" not in result


class TestGetAlternativesConsidered:
    def test_excludes_selected(self, engine: ReasonAlignmentEngine) -> None:
        context = {"alternatives": [{"name": "A"}, {"name": "B"}]}
        result = engine._get_alternatives_considered("A", context)
        assert len(result) == 1
        assert result[0]["name"] == "B"


class TestGenerateAuditTrail:
    def test_fields(self, engine_with_evidence: ReasonAlignmentEngine) -> None:
        report = engine_with_evidence.generate_alignment_report(
            decision_id="d1",
            decision="deploy",
            decision_type="technical",
            context={},
        )
        trail = report.audit_trail
        assert trail["decision_id"] == "d1"
        assert trail["agent_id"] == "agent_1"
        assert "timestamp" in trail
        assert "alignment_score" in trail


class TestGenerateAlignmentReport:
    def test_full_report(self, engine_with_evidence: ReasonAlignmentEngine) -> None:
        report = engine_with_evidence.generate_alignment_report(
            decision_id="d1",
            decision="approve",
            decision_type="approval",
            context={"task": "review"},
        )
        assert report.agent_id == "agent_1"
        assert report.decision == "approve"
        assert report.decision_type == "approval"
        assert report.reasoning_chain is not None
        assert len(report.reasoning_chain.steps) == 5

    def test_custom_reasoning_chain(self, engine: ReasonAlignmentEngine) -> None:
        from cognitive.reason_models import ReasoningChain
        custom = ReasoningChain(chain_id="custom")
        custom.add_step("s1", "Custom step", "reasoning", confidence=0.9)
        report = engine.generate_alignment_report(
            "d1", "dec", "type", {}, reasoning_chain=custom,
        )
        assert report.reasoning_chain.chain_id == "custom"
        assert len(report.reasoning_chain.steps) == 1

    def test_recorded_in_history(self, engine: ReasonAlignmentEngine) -> None:
        engine.generate_alignment_report("d1", "dec", "type", {})
        assert len(engine.decision_history) == 1

    def test_with_analyze_alignment(self, engine: ReasonAlignmentEngine) -> None:
        report = engine.generate_alignment_report(
            "d1", "dec", "type", {"goal": "g", "values": ["v"]},
        )
        assert report.alignment_type is not None


class TestGetDecisionHistory:
    def test_empty(self, engine: ReasonAlignmentEngine) -> None:
        assert engine.get_decision_history() == []

    def test_limit(self, engine: ReasonAlignmentEngine) -> None:
        for i in range(5):
            engine.generate_alignment_report(f"d{i}", "dec", "type", {})
        result = engine.get_decision_history(limit=3)
        assert len(result) == 3

    def test_to_dict_format(self, engine: ReasonAlignmentEngine) -> None:
        engine.generate_alignment_report("d1", "dec", "type", {})
        result = engine.get_decision_history()
        assert "agent_id" in result[0]


class TestGetAlignmentStatistics:
    def test_empty(self, engine: ReasonAlignmentEngine) -> None:
        stats = engine.get_alignment_statistics()
        assert stats["total_decisions"] == 0
        assert stats["avg_alignment_score"] == 0.0

    def test_with_decisions(self, engine: ReasonAlignmentEngine) -> None:
        for _ in range(3):
            engine.generate_alignment_report("d", "dec", "type", {})
        stats = engine.get_alignment_statistics()
        assert stats["total_decisions"] == 3
        assert stats["avg_alignment_score"] >= 0.0
        assert "alignment_type_distribution" in stats
        assert "recent_trend" in stats

    def test_trend_max_5(self, engine: ReasonAlignmentEngine) -> None:
        for _ in range(10):
            engine.generate_alignment_report("d", "dec", "type", {})
        stats = engine.get_alignment_statistics()
        assert len(stats["recent_trend"]) == 5
