"""理由对齐机制

实现智能体决策过程的结构化理由表达，包括：
- 决策理由追踪
- 证据链构建
- 推理透明度
- 可审计性
"""

from typing import Any

from cognitive.reason_models import (
    AlignmentReport,
    Evidence,
    EvidenceType,
    ReasoningChain,
)

__all__ = [
    "AlignmentReport",
    "Evidence",
    "EvidenceType",
    "ReasoningChain",
    "ReasonAlignmentEngine",
]


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
        """分析对齐状态。委托给 cognitive.alignment_analysis 模块。"""
        from cognitive.alignment_analysis import analyze_alignment as _impl

        return _impl(decision, context, self.alignment_rules)

    def _check_goal_alignment(self, decision: str, context: dict[str, Any]) -> float:
        from cognitive.alignment_analysis import check_goal_alignment

        return check_goal_alignment(decision, context)

    def _check_value_alignment(self, decision: str, context: dict[str, Any]) -> float:
        from cognitive.alignment_analysis import check_value_alignment

        return check_value_alignment(decision, context)

    def _check_rule_alignment(self, decision: str, context: dict[str, Any]) -> float:
        from cognitive.alignment_analysis import check_rule_alignment

        return check_rule_alignment(decision, self.alignment_rules)

    def _check_evidence_alignment(self, decision: str, context: dict[str, Any]) -> float:
        from cognitive.alignment_analysis import check_evidence_alignment

        return check_evidence_alignment(decision, context)

    def _extract_primary_reasons(self, decision: str, context: dict[str, Any]) -> list[str]:
        from cognitive.alignment_analysis import extract_primary_reasons

        return extract_primary_reasons(decision, context)

    def _extract_supporting_reasons(self, context: dict[str, Any]) -> list[str]:
        from cognitive.alignment_analysis import extract_supporting_reasons

        return extract_supporting_reasons(self.alignment_rules, context)

    def _identify_counter_arguments(self, decision: str, context: dict[str, Any]) -> list[str]:
        from cognitive.alignment_analysis import identify_counter_arguments

        return identify_counter_arguments(decision, context)

    def _check_constraints_satisfied(self, decision: str, context: dict[str, Any]) -> list[str]:
        from cognitive.alignment_analysis import check_constraints_satisfied

        return check_constraints_satisfied(decision, context)

    def _check_constraints_violated(self, decision: str, context: dict[str, Any]) -> list[str]:
        from cognitive.alignment_analysis import check_constraints_violated

        return check_constraints_violated(decision, context)

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

    def _get_rejected_alternatives(self, decision: str, context: dict[str, Any]) -> list[dict[str, Any]]:
        from cognitive.alignment_analysis import get_rejected_alternatives

        return get_rejected_alternatives(decision, context)

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
