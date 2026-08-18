"""理由对齐机制 - Reason-based Alignment

实现智能体决策过程的结构化理由表达，包括：
- 决策理由追踪
- 证据链构建
- 推理透明度
- 可审计性
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class AlignmentType(Enum):
    """对齐类型"""
    GOAL_ALIGNED = "goal_aligned"          # 目标对齐
    VALUE_ALIGNED = "value_aligned"        # 价值观对齐
    RULE_ALIGNED = "rule_aligned"          # 规则对齐
    EVIDENCE_ALIGNED = "evidence_aligned"  # 证据对齐
    UNALIGNED = "unaligned"                # 未对齐


class EvidenceType(Enum):
    """证据类型"""
    FACTUAL = "factual"            # 事实性证据
    STATISTICAL = "statistical"    # 统计性证据
    EXPERT_OPINION = "expert_opinion"  # 专家意见
    HISTORICAL = "historical"      # 历史数据
    LOGICAL = "logical"            # 逻辑推理
    ASSUMPTION = "assumption"      # 假设


@dataclass
class Evidence:
    """证据"""
    evidence_id: str
    evidence_type: EvidenceType
    content: str
    source: str = ""
    confidence: float = 1.0  # 0.0-1.0
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "evidence_id": self.evidence_id,
            "type": self.evidence_type.value,
            "content": self.content,
            "source": self.source,
            "confidence": self.confidence,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class ReasoningChain:
    """推理链"""
    chain_id: str
    steps: list[dict[str, Any]] = field(default_factory=list)
    conclusion: str = ""
    confidence: float = 0.0
    evidence_chain: list[Evidence] = field(default_factory=list)

    def add_step(
        self,
        step_id: str,
        description: str,
        reasoning: str,
        evidence: list[Evidence] | None = None,
        confidence: float = 1.0,
    ) -> None:
        """添加推理步骤"""
        self.steps.append({
            "step_id": step_id,
            "description": description,
            "reasoning": reasoning,
            "evidence": [e.to_dict() for e in evidence] if evidence else [],
            "confidence": confidence,
        })
        if evidence:
            self.evidence_chain.extend(evidence)

        # 更新整体置信度
        if self.steps:
            self.confidence = sum(
                step.get("confidence", 1.0) for step in self.steps
            ) / len(self.steps)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "chain_id": self.chain_id,
            "steps": self.steps,
            "conclusion": self.conclusion,
            "confidence": self.confidence,
            "evidence_chain": [e.to_dict() for e in self.evidence_chain],
        }


@dataclass
class AlignmentReport:
    """对齐报告"""
    agent_id: str
    decision_id: str
    timestamp: datetime = field(default_factory=datetime.now)

    # 决策信息
    decision: str = ""
    decision_type: str = ""
    context: dict[str, Any] = field(default_factory=dict)

    # 对齐状态
    alignment_type: AlignmentType = AlignmentType.UNALIGNED
    alignment_score: float = 0.0  # 0.0-1.0
    alignment_factors: dict[str, float] = field(default_factory=dict)

    # 推理过程
    reasoning_chain: ReasoningChain = field(default_factory=lambda: ReasoningChain(chain_id=""))

    # 理由
    primary_reasons: list[str] = field(default_factory=list)
    supporting_reasons: list[str] = field(default_factory=list)
    counter_arguments: list[str] = field(default_factory=list)

    # 约束和规则
    constraints_satisfied: list[str] = field(default_factory=list)
    constraints_violated: list[str] = field(default_factory=list)
    rules_applied: list[str] = field(default_factory=list)

    # 替代方案
    alternatives_considered: list[dict[str, Any]] = field(default_factory=list)
    rejected_alternatives: list[dict[str, Any]] = field(default_factory=list)

    # 审计信息
    audit_trail: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "agent_id": self.agent_id,
            "decision_id": self.decision_id,
            "timestamp": self.timestamp.isoformat(),
            "decision": {
                "content": self.decision,
                "type": self.decision_type,
                "context": self.context,
            },
            "alignment": {
                "type": self.alignment_type.value,
                "score": self.alignment_score,
                "factors": self.alignment_factors,
            },
            "reasoning": self.reasoning_chain.to_dict(),
            "reasons": {
                "primary": self.primary_reasons,
                "supporting": self.supporting_reasons,
                "counter_arguments": self.counter_arguments,
            },
            "constraints": {
                "satisfied": self.constraints_satisfied,
                "violated": self.constraints_violated,
                "rules_applied": self.rules_applied,
            },
            "alternatives": {
                "considered": self.alternatives_considered,
                "rejected": self.rejected_alternatives,
            },
            "audit": self.audit_trail,
        }


class ReasonAlignmentEngine:
    """理由对齐引擎"""

    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.decision_history: list[AlignmentReport] = []
        self.alignment_rules: list[dict[str, Any]] = []
        self.evidence_store: dict[str, Evidence] = {}

    def add_alignment_rule(
        self,
        rule_id: str,
        rule_type: str,
        condition: str,
        priority: int = 1,
    ) -> None:
        """添加对齐规则"""
        self.alignment_rules.append({
            "rule_id": rule_id,
            "type": rule_type,
            "condition": condition,
            "priority": priority,
        })
        # 按优先级排序
        self.alignment_rules.sort(key=lambda r: r["priority"], reverse=True)

    def add_evidence(self, evidence: Evidence) -> None:
        """添加证据到存储"""
        self.evidence_store[evidence.evidence_id] = evidence

    def build_reasoning_chain(
        self,
        chain_id: str,
        decision: str,
        context: dict[str, Any],
    ) -> ReasoningChain:
        """构建推理链"""
        chain = ReasoningChain(chain_id=chain_id)

        # 步骤1: 理解问题
        chain.add_step(
            step_id="step_1",
            description="问题理解",
            reasoning=f"分析任务需求: {context.get('task', '')}",
            confidence=0.9,
        )

        # 步骤2: 收集相关信息
        relevant_evidence = self._gather_relevant_evidence(context)
        chain.add_step(
            step_id="step_2",
            description="信息收集",
            reasoning=f"收集到 {len(relevant_evidence)} 条相关证据",
            evidence=relevant_evidence,
            confidence=0.85,
        )

        # 步骤3: 应用规则
        applied_rules = self._apply_rules(context)
        chain.add_step(
            step_id="step_3",
            description="规则应用",
            reasoning=f"应用了 {len(applied_rules)} 条规则",
            confidence=0.95,
        )

        # 步骤4: 评估替代方案
        alternatives = self._evaluate_alternatives(decision, context)
        chain.add_step(
            step_id="step_4",
            description="方案评估",
            reasoning=f"评估了 {len(alternatives)} 个替代方案",
            confidence=0.8,
        )

        # 步骤5: 做出决策
        chain.add_step(
            step_id="step_5",
            description="决策制定",
            reasoning=f"基于以上分析，选择: {decision}",
            confidence=0.9,
        )

        chain.conclusion = decision
        return chain

    def generate_alignment_report(
        self,
        decision_id: str,
        decision: str,
        decision_type: str,
        context: dict[str, Any],
        reasoning_chain: ReasoningChain | None = None,
    ) -> AlignmentReport:
        """生成对齐报告"""
        report = AlignmentReport(
            agent_id=self.agent_id,
            decision_id=decision_id,
            decision=decision,
            decision_type=decision_type,
            context=context,
        )

        # 构建推理链
        if reasoning_chain is None:
            reasoning_chain = self.build_reasoning_chain(
                chain_id=f"chain_{decision_id}",
                decision=decision,
                context=context,
            )
        report.reasoning_chain = reasoning_chain

        # 分析对齐状态
        alignment_analysis = self._analyze_alignment(decision, context)
        report.alignment_type = alignment_analysis["type"]
        report.alignment_score = alignment_analysis["score"]
        report.alignment_factors = alignment_analysis["factors"]

        # 提取理由
        report.primary_reasons = self._extract_primary_reasons(decision, context)
        report.supporting_reasons = self._extract_supporting_reasons(context)
        report.counter_arguments = self._identify_counter_arguments(decision, context)

        # 检查约束
        report.constraints_satisfied = self._check_constraints_satisfied(decision, context)
        report.constraints_violated = self._check_constraints_violated(decision, context)
        report.rules_applied = self._get_applied_rules(context)

        # 记录替代方案
        report.alternatives_considered = self._get_alternatives_considered(decision, context)
        report.rejected_alternatives = self._get_rejected_alternatives(decision, context)

        # 生成审计信息
        report.audit_trail = self._generate_audit_trail(report)

        # 记录历史
        self.decision_history.append(report)

        return report

    def _gather_relevant_evidence(
        self,
        context: dict[str, Any],
    ) -> list[Evidence]:
        """收集相关证据"""
        relevant = []
        task_keywords = context.get("keywords", [])

        for _evidence_id, evidence in self.evidence_store.items():
            # 简单的关键词匹配
            if any(keyword in evidence.content for keyword in task_keywords):
                relevant.append(evidence)

        return relevant[:5]  # 最多返回5条

    def _apply_rules(
        self,
        context: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """应用规则"""
        applied = []
        task_type = context.get("task_type", "")

        for rule in self.alignment_rules:
            # 简单的规则匹配
            if rule["type"] == task_type or rule["condition"] in str(context):
                applied.append(rule)

        return applied

    def _evaluate_alternatives(
        self,
        decision: str,
        context: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """评估替代方案"""
        alternatives = context.get("alternatives", [])
        evaluated = []

        for alt in alternatives:
            # 简单评分
            score = 0.5  # 默认分数
            if "pros" in alt:
                score += len(alt["pros"]) * 0.1
            if "cons" in alt:
                score -= len(alt["cons"]) * 0.1
            score = max(0.0, min(1.0, score))

            evaluated.append({
                "alternative": alt.get("name", ""),
                "score": score,
                "selected": alt.get("name", "") == decision,
            })

        return evaluated

    def _analyze_alignment(
        self,
        decision: str,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """分析对齐状态"""
        factors = {}

        # 目标对齐
        goal_match = self._check_goal_alignment(decision, context)
        factors["goal_alignment"] = goal_match

        # 价值观对齐
        value_match = self._check_value_alignment(decision, context)
        factors["value_alignment"] = value_match

        # 规则对齐
        rule_match = self._check_rule_alignment(decision, context)
        factors["rule_alignment"] = rule_match

        # 证据对齐
        evidence_match = self._check_evidence_alignment(decision, context)
        factors["evidence_alignment"] = evidence_match

        # 综合得分
        overall_score = (
            factors["goal_alignment"] * 0.3 +
            factors["value_alignment"] * 0.3 +
            factors["rule_alignment"] * 0.2 +
            factors["evidence_alignment"] * 0.2
        )

        # 确定对齐类型
        if overall_score >= 0.8:
            alignment_type = AlignmentType.GOAL_ALIGNED
        elif overall_score >= 0.6:
            alignment_type = AlignmentType.VALUE_ALIGNED
        elif overall_score >= 0.4:
            alignment_type = AlignmentType.RULE_ALIGNED
        else:
            alignment_type = AlignmentType.UNALIGNED

        return {
            "type": alignment_type,
            "score": overall_score,
            "factors": factors,
        }

    def _check_goal_alignment(self, decision: str, context: dict[str, Any]) -> float:
        """检查目标对齐"""
        goals = context.get("goals", [])
        if not goals:
            return 0.7  # 默认中等

        # 简单的关键词匹配
        match_count = sum(1 for goal in goals if goal in decision)
        return min(1.0, match_count / len(goals)) if goals else 0.5

    def _check_value_alignment(self, decision: str, context: dict[str, Any]) -> float:
        """检查价值观对齐"""
        values = context.get("values", [])
        if not values:
            return 0.7

        # 检查是否违反价值观
        violations = sum(1 for value in values if f"不{value}" in decision or f"违反{value}" in decision)
        return max(0.0, 1.0 - violations * 0.2)

    def _check_rule_alignment(self, decision: str, context: dict[str, Any]) -> float:
        """检查规则对齐"""
        rules = self.alignment_rules
        if not rules:
            return 0.8

        # 检查是否违反规则
        violations = 0
        for rule in rules:
            condition = rule.get("condition", "")
            if condition and condition in decision and "禁止" in condition:
                violations += 1

        return max(0.0, 1.0 - violations * 0.3)

    def _check_evidence_alignment(self, decision: str, context: dict[str, Any]) -> float:
        """检查证据对齐"""
        evidence = context.get("evidence", [])
        if not evidence:
            return 0.6

        # 检查决策是否有证据支持
        supported = sum(1 for e in evidence if e in decision)
        return min(1.0, supported / len(evidence)) if evidence else 0.5

    def _extract_primary_reasons(
        self,
        decision: str,
        context: dict[str, Any],
    ) -> list[str]:
        """提取主要理由"""
        reasons = []

        # 从上下文中提取
        if "reason" in context:
            reasons.append(context["reason"])

        # 从目标中提取
        goals = context.get("goals", [])
        if goals:
            reasons.append(f"满足目标: {', '.join(goals[:2])}")

        # 从证据中提取
        evidence = context.get("evidence", [])
        if evidence:
            reasons.append(f"基于证据: {len(evidence)} 条支持")

        return reasons[:3]

    def _extract_supporting_reasons(
        self,
        context: dict[str, Any],
    ) -> list[str]:
        """提取支持理由"""
        supporting = []

        # 从规则中提取
        rules = self.alignment_rules
        if rules:
            supporting.append(f"符合 {len(rules)} 条规则")

        # 从约束中提取
        constraints = context.get("constraints", [])
        if constraints:
            supporting.append(f"满足 {len(constraints)} 个约束")

        return supporting

    def _identify_counter_arguments(
        self,
        decision: str,
        context: dict[str, Any],
    ) -> list[str]:
        """识别反对论点"""
        counter = []

        # 从替代方案中提取
        alternatives = context.get("alternatives", [])
        for alt in alternatives:
            if alt.get("name") != decision and "cons" in alt:
                counter.extend(alt["cons"][:2])

        return counter[:3]

    def _check_constraints_satisfied(
        self,
        decision: str,
        context: dict[str, Any],
    ) -> list[str]:
        """检查满足的约束"""
        satisfied = []
        constraints = context.get("constraints", [])

        for constraint in constraints:
            # 简单检查
            if constraint in decision or constraint in str(context):
                satisfied.append(constraint)

        return satisfied

    def _check_constraints_violated(
        self,
        decision: str,
        context: dict[str, Any],
    ) -> list[str]:
        """检查违反的约束"""
        violated = []
        constraints = context.get("constraints", [])

        for constraint in constraints:
            if f"不{constraint}" in decision or f"违反{constraint}" in decision:
                violated.append(constraint)

        return violated

    def _get_applied_rules(self, context: dict[str, Any]) -> list[str]:
        """获取应用的规则"""
        return [rule["rule_id"] for rule in self.alignment_rules if rule.get("active", True)]

    def _get_alternatives_considered(
        self,
        decision: str,
        context: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """获取考虑的替代方案"""
        alternatives = context.get("alternatives", [])
        return [alt for alt in alternatives if alt.get("name") != decision]

    def _get_rejected_alternatives(
        self,
        decision: str,
        context: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """获取拒绝的替代方案"""
        alternatives = context.get("alternatives", [])
        rejected = []

        for alt in alternatives:
            if alt.get("name") != decision:
                rejected.append({
                    "alternative": alt.get("name", ""),
                    "reason": alt.get("rejection_reason", "不符合要求"),
                })

        return rejected

    def _generate_audit_trail(self, report: AlignmentReport) -> dict[str, Any]:
        """生成审计信息"""
        return {
            "decision_id": report.decision_id,
            "agent_id": report.agent_id,
            "timestamp": report.timestamp.isoformat(),
            "alignment_score": report.alignment_score,
            "reasoning_steps": len(report.reasoning_chain.steps),
            "evidence_count": len(report.reasoning_chain.evidence_chain),
            "rules_applied": len(report.rules_applied),
            "constraints_satisfied": len(report.constraints_satisfied),
            "constraints_violated": len(report.constraints_violated),
        }

    def get_decision_history(self, limit: int = 10) -> list[dict[str, Any]]:
        """获取决策历史"""
        recent = self.decision_history[-limit:]
        return [report.to_dict() for report in recent]

    def get_alignment_statistics(self) -> dict[str, Any]:
        """获取对齐统计"""
        if not self.decision_history:
            return {
                "total_decisions": 0,
                "avg_alignment_score": 0.0,
            }

        scores = [report.alignment_score for report in self.decision_history]
        avg_score = sum(scores) / len(scores)

        # 统计对齐类型
        type_counts: dict[str, int] = {}
        for report in self.decision_history:
            type_name = report.alignment_type.value
            type_counts[type_name] = type_counts.get(type_name, 0) + 1

        return {
            "total_decisions": len(self.decision_history),
            "avg_alignment_score": avg_score,
            "alignment_type_distribution": type_counts,
            "recent_trend": scores[-5:] if len(scores) >= 5 else scores,
        }
