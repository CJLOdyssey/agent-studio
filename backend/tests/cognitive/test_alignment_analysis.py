"""Tests for cognitive/alignment_analysis.py — pure functions."""

from __future__ import annotations

from cognitive.alignment_analysis import (
    check_goal_alignment,
    check_value_alignment,
    check_rule_alignment,
    check_evidence_alignment,
    analyze_alignment,
    extract_primary_reasons,
    extract_supporting_reasons,
    identify_counter_arguments,
    check_constraints_satisfied,
    check_constraints_violated,
    get_rejected_alternatives,
)


def test_check_goal_alignment_with_goals():
    context = {"goals": ["increase revenue", "reduce cost"]}
    score = check_goal_alignment("increase revenue", context)
    assert 0 <= score <= 1


def test_check_goal_alignment_no_goals():
    context = {}
    score = check_goal_alignment("do something", context)
    assert 0 <= score <= 1


def test_check_value_alignment_no_values():
    context = {}
    score = check_value_alignment("decision", context)
    assert 0 <= score <= 1


def test_check_rule_alignment_no_rules():
    score = check_rule_alignment("decision", [])
    assert 0 <= score <= 1


def test_check_rule_alignment_with_rules():
    rules = [{"rule_id": "r1", "active": True}]
    score = check_rule_alignment("decision", rules)
    assert 0 <= score <= 1


def test_check_evidence_alignment_no_evidence():
    context = {}
    score = check_evidence_alignment("decision", context)
    assert 0 <= score <= 1


def test_analyze_alignment():
    context = {"goals": ["goal1"], "evidence": ["ev1"]}
    result = analyze_alignment(
        decision="goal1",
        context=context,
        alignment_rules=[],
    )
    assert "type" in result
    assert "score" in result
    assert "factors" in result


def test_extract_primary_reasons_with_reason():
    context = {"reason": "because it's better"}
    reasons = extract_primary_reasons("decision", context)
    assert len(reasons) > 0


def test_extract_primary_reasons_with_goals():
    context = {"goals": ["g1", "g2"]}
    reasons = extract_primary_reasons("decision", context)
    assert len(reasons) > 0


def test_extract_supporting_reasons_empty():
    context = {}
    supporting = extract_supporting_reasons([], context)
    assert isinstance(supporting, list)


def test_identify_counter_arguments():
    context = {"alternatives": [{"name": "alt1", "cons": ["con1", "con2"]}]}
    counters = identify_counter_arguments("decision", context)
    assert isinstance(counters, list)


def test_check_constraints_satisfied():
    context = {"constraints": ["budget", "timeline"]}
    satisfied = check_constraints_satisfied("budget is met", context)
    assert "budget" in satisfied


def test_check_constraints_violated():
    context = {"constraints": ["budget"]}
    violated = check_constraints_violated("违反budget", context)
    assert "budget" in violated


def test_get_rejected_alternatives():
    context = {"alternatives": [{"name": "alt1", "rejection_reason": "too expensive"}]}
    rejected = get_rejected_alternatives("chosen", context)
    assert len(rejected) == 1
    assert rejected[0]["alternative"] == "alt1"
