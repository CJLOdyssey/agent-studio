"""对齐分析辅助（从 ReasonAlignmentEngine 提取）。

单一职责：计算各维度对齐得分，供对齐引擎编排。"""

from __future__ import annotations

from typing import Any

from cognitive.reason_models import AlignmentType


def check_goal_alignment(decision: str, context: dict[str, Any]) -> float:
    goals = context.get("goals", [])
    if not goals:
        return 0.7
    match_count = sum(1 for goal in goals if goal in decision)
    return min(1.0, match_count / len(goals)) if goals else 0.5


def check_value_alignment(decision: str, context: dict[str, Any]) -> float:
    values = context.get("values", [])
    if not values:
        return 0.7
    violations = sum(1 for value in values if f"不{value}" in decision or f"违反{value}" in decision)
    return max(0.0, 1.0 - violations * 0.2)


def check_rule_alignment(decision: str, alignment_rules: list[dict[str, Any]]) -> float:
    if not alignment_rules:
        return 0.8
    violations = 0
    for rule in alignment_rules:
        condition = rule.get("condition", "")
        if condition and condition in decision and "禁止" in condition:
            violations += 1
    return max(0.0, 1.0 - violations * 0.3)


def check_evidence_alignment(decision: str, context: dict[str, Any]) -> float:
    evidence = context.get("evidence", [])
    if not evidence:
        return 0.6
    supported = sum(1 for e in evidence if e in decision)
    return min(1.0, supported / len(evidence)) if evidence else 0.5


def analyze_alignment(
    decision: str,
    context: dict[str, Any],
    alignment_rules: list[dict[str, Any]],
) -> dict[str, Any]:
    """分析对齐状态，返回 {type, score, factors}。"""
    factors = {
        "goal_alignment": check_goal_alignment(decision, context),
        "value_alignment": check_value_alignment(decision, context),
        "rule_alignment": check_rule_alignment(decision, alignment_rules),
        "evidence_alignment": check_evidence_alignment(decision, context),
    }
    overall_score = (
        factors["goal_alignment"] * 0.3
        + factors["value_alignment"] * 0.3
        + factors["rule_alignment"] * 0.2
        + factors["evidence_alignment"] * 0.2
    )
    if overall_score >= 0.8:
        alignment_type = AlignmentType.GOAL_ALIGNED
    elif overall_score >= 0.6:
        alignment_type = AlignmentType.VALUE_ALIGNED
    elif overall_score >= 0.4:
        alignment_type = AlignmentType.RULE_ALIGNED
    else:
        alignment_type = AlignmentType.UNALIGNED
    return {"type": alignment_type, "score": overall_score, "factors": factors}


def extract_primary_reasons(decision: str, context: dict[str, Any]) -> list[str]:
    reasons = []
    if "reason" in context:
        reasons.append(context["reason"])
    goals = context.get("goals", [])
    if goals:
        reasons.append(f"满足目标: {', '.join(goals[:2])}")
    evidence = context.get("evidence", [])
    if evidence:
        reasons.append(f"基于证据: {len(evidence)} 条支持")
    return reasons[:3]


def extract_supporting_reasons(alignment_rules: list[dict[str, Any]], context: dict[str, Any]) -> list[str]:
    supporting = []
    if alignment_rules:
        supporting.append(f"符合 {len(alignment_rules)} 条规则")
    constraints = context.get("constraints", [])
    if constraints:
        supporting.append(f"满足 {len(constraints)} 个约束")
    return supporting


def identify_counter_arguments(decision: str, context: dict[str, Any]) -> list[str]:
    counter = []
    alternatives = context.get("alternatives", [])
    for alt in alternatives:
        if alt.get("name") != decision and "cons" in alt:
            counter.extend(alt["cons"][:2])
    return counter[:3]


def check_constraints_satisfied(decision: str, context: dict[str, Any]) -> list[str]:
    satisfied = []
    for constraint in context.get("constraints", []):
        if constraint in decision or constraint in str(context):
            satisfied.append(constraint)
    return satisfied


def check_constraints_violated(decision: str, context: dict[str, Any]) -> list[str]:
    violated = []
    for constraint in context.get("constraints", []):
        if f"不{constraint}" in decision or f"违反{constraint}" in decision:
            violated.append(constraint)
    return violated


def get_rejected_alternatives(decision: str, context: dict[str, Any]) -> list[dict[str, Any]]:
    alternatives = context.get("alternatives", [])
    return [
        {"alternative": alt.get("name", ""), "reason": alt.get("rejection_reason", "不符合要求")}
        for alt in alternatives if alt.get("name") != decision
    ]
