"""认知状态报告机制 - Cognitive State Reporting Mechanism

实现智能体认知状态的结构化报告，包括：
- 置信度评估
- 不确定性量化
- 知识边界识别
- 推理过程追踪
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class ConfidenceLevel(Enum):
    """置信度级别"""
    VERY_HIGH = "very_high"      # 95%+
    HIGH = "high"                # 80-95%
    MEDIUM = "medium"            # 60-80%
    LOW = "low"                  # 40-60%
    VERY_LOW = "very_low"        # <40%
    UNCERTAIN = "uncertain"      # 无法评估


class KnowledgeBoundary(Enum):
    """知识边界类型"""
    WITHIN_SCOPE = "within_scope"        # 在知识范围内
    AT_BOUNDARY = "at_boundary"          # 在知识边界
    BEYOND_SCOPE = "beyond_scope"        # 超出知识范围
    REQUIRES_VERIFICATION = "requires_verification"  # 需要验证


@dataclass
class ReasoningStep:
    """推理步骤"""
    step_id: str
    description: str
    confidence: float  # 0.0-1.0
    evidence: list[str] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    alternative_considerations: list[str] = field(default_factory=list)


@dataclass
class CognitiveStateReport:
    """认知状态报告"""
    agent_id: str
    timestamp: datetime = field(default_factory=datetime.now)

    # 置信度评估
    overall_confidence: float = 0.0  # 0.0-1.0
    confidence_level: ConfidenceLevel = ConfidenceLevel.UNCERTAIN
    confidence_factors: dict[str, float] = field(default_factory=dict)

    # 不确定性量化
    uncertainty_sources: list[str] = field(default_factory=list)
    uncertainty_level: float = 0.0  # 0.0-1.0

    # 知识边界
    knowledge_boundary: KnowledgeBoundary = KnowledgeBoundary.WITHIN_SCOPE
    knowledge_gaps: list[str] = field(default_factory=list)
    requires_external_knowledge: bool = False

    # 推理过程
    reasoning_steps: list[ReasoningStep] = field(default_factory=list)
    reasoning_chain: list[str] = field(default_factory=list)

    # 元认知
    self_awareness: dict[str, Any] = field(default_factory=dict)
    limitations: list[str] = field(default_factory=list)

    # 建议
    recommendations: list[str] = field(default_factory=list)
    alternative_approaches: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式"""
        return {
            "agent_id": self.agent_id,
            "timestamp": self.timestamp.isoformat(),
            "confidence": {
                "overall": self.overall_confidence,
                "level": self.confidence_level.value,
                "factors": self.confidence_factors,
            },
            "uncertainty": {
                "sources": self.uncertainty_sources,
                "level": self.uncertainty_level,
            },
            "knowledge": {
                "boundary": self.knowledge_boundary.value,
                "gaps": self.knowledge_gaps,
                "requires_external": self.requires_external_knowledge,
            },
            "reasoning": {
                "steps": [
                    {
                        "id": step.step_id,
                        "description": step.description,
                        "confidence": step.confidence,
                        "evidence": step.evidence,
                        "assumptions": step.assumptions,
                        "alternatives": step.alternative_considerations,
                    }
                    for step in self.reasoning_steps
                ],
                "chain": self.reasoning_chain,
            },
            "meta_cognition": {
                "self_awareness": self.self_awareness,
                "limitations": self.limitations,
            },
            "recommendations": self.recommendations,
            "alternatives": self.alternative_approaches,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CognitiveStateReport":
        """从字典创建实例"""
        reasoning_steps = [
            ReasoningStep(
                step_id=step["id"],
                description=step["description"],
                confidence=step["confidence"],
                evidence=step.get("evidence", []),
                assumptions=step.get("assumptions", []),
                alternative_considerations=step.get("alternatives", []),
            )
            for step in data.get("reasoning", {}).get("steps", [])
        ]

        return cls(
            agent_id=data["agent_id"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            overall_confidence=data.get("confidence", {}).get("overall", 0.0),
            confidence_level=ConfidenceLevel(
                data.get("confidence", {}).get("level", "uncertain")
            ),
            confidence_factors=data.get("confidence", {}).get("factors", {}),
            uncertainty_sources=data.get("uncertainty", {}).get("sources", []),
            uncertainty_level=data.get("uncertainty", {}).get("level", 0.0),
            knowledge_boundary=KnowledgeBoundary(
                data.get("knowledge", {}).get("boundary", "within_scope")
            ),
            knowledge_gaps=data.get("knowledge", {}).get("gaps", []),
            requires_external_knowledge=data.get("knowledge", {}).get(
                "requires_external", False
            ),
            reasoning_steps=reasoning_steps,
            reasoning_chain=data.get("reasoning", {}).get("chain", []),
            self_awareness=data.get("meta_cognition", {}).get("self_awareness", {}),
            limitations=data.get("meta_cognition", {}).get("limitations", []),
            recommendations=data.get("recommendations", []),
            alternative_approaches=data.get("alternatives", []),
        )


class CognitiveStateAnalyzer:
    """认知状态分析器"""

    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.history: list[CognitiveStateReport] = []

    def analyze_response(
        self,
        response: str,
        context: dict[str, Any],
        metadata: dict[str, Any] | None = None,
    ) -> CognitiveStateReport:
        """分析响应并生成认知状态报告

        Args:
            response: 智能体的响应文本
            context: 任务上下文
            metadata: 额外元数据

        Returns:
            认知状态报告
        """
        report = CognitiveStateReport(agent_id=self.agent_id)

        # 分析置信度
        confidence_analysis = self._analyze_confidence(response, context)
        report.overall_confidence = confidence_analysis["confidence"]
        report.confidence_level = confidence_analysis["level"]
        report.confidence_factors = confidence_analysis["factors"]

        # 分析不确定性
        uncertainty_analysis = self._analyze_uncertainty(response, context)
        report.uncertainty_sources = uncertainty_analysis["sources"]
        report.uncertainty_level = uncertainty_analysis["level"]

        # 分析知识边界
        boundary_analysis = self._analyze_knowledge_boundary(response, context)
        report.knowledge_boundary = boundary_analysis["boundary"]
        report.knowledge_gaps = boundary_analysis["gaps"]
        report.requires_external_knowledge = boundary_analysis["requires_external"]

        # 提取推理步骤
        report.reasoning_steps = self._extract_reasoning_steps(response)
        report.reasoning_chain = [step.description for step in report.reasoning_steps]

        # 元认知分析
        report.self_awareness = self._analyze_self_awareness(response)
        report.limitations = self._identify_limitations(response, context)

        # 生成建议
        report.recommendations = self._generate_recommendations(report)
        report.alternative_approaches = self._suggest_alternatives(report, context)

        # 记录历史
        self.history.append(report)

        return report

    def _analyze_confidence(
        self,
        response: str,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """分析置信度"""
        factors = {}

        # 检查确定性词汇
        high_confidence_indicators = [
            "确定", "明确", "肯定", "毫无疑问", "显然",
            "definitely", "certainly", "clearly", "obviously",
        ]
        low_confidence_indicators = [
            "可能", "也许", "或许", "不确定", "大概",
            "maybe", "perhaps", "possibly", "uncertain", "probably",
        ]

        high_count = sum(1 for word in high_confidence_indicators if word in response)
        low_count = sum(1 for word in low_confidence_indicators if word in response)

        # 计算置信度分数
        confidence = 0.6 if high_count + low_count == 0 else high_count / (high_count + low_count)

        factors["linguistic_confidence"] = confidence

        # 检查任务复杂度
        task_complexity = context.get("complexity", "medium")
        complexity_factor = {"low": 0.9, "medium": 0.7, "high": 0.5}.get(
            task_complexity, 0.7
        )
        factors["task_complexity_factor"] = complexity_factor

        # 检查上下文完整性
        context_completeness = context.get("completeness", 1.0)
        factors["context_completeness"] = context_completeness

        # 综合置信度
        overall_confidence = (
            factors["linguistic_confidence"] * 0.4 +
            factors["task_complexity_factor"] * 0.3 +
            factors["context_completeness"] * 0.3
        )

        # 确定置信度级别
        if overall_confidence >= 0.95:
            level = ConfidenceLevel.VERY_HIGH
        elif overall_confidence >= 0.80:
            level = ConfidenceLevel.HIGH
        elif overall_confidence >= 0.60:
            level = ConfidenceLevel.MEDIUM
        elif overall_confidence >= 0.40:
            level = ConfidenceLevel.LOW
        else:
            level = ConfidenceLevel.VERY_LOW

        return {
            "confidence": overall_confidence,
            "level": level,
            "factors": factors,
        }

    def _analyze_uncertainty(
        self,
        response: str,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """分析不确定性"""
        sources = []

        # 检查不确定性来源
        uncertainty_patterns = [
            ("信息不足", ["缺少信息", "信息不足", "insufficient information", "lack of data"]),
            ("任务模糊", ["任务不明确", "需求模糊", "unclear task", "ambiguous requirement"]),
            ("知识限制", ["超出知识范围", "不了解", "beyond my knowledge", "not familiar"]),
            ("方法不确定", ["不确定方法", "可能的方法", "uncertain method", "possible approach"]),
        ]

        for source_name, patterns in uncertainty_patterns:
            if any(pattern in response.lower() for pattern in patterns):
                sources.append(source_name)

        # 计算不确定性级别
        uncertainty_level = min(1.0, len(sources) * 0.25 + (1.0 - context.get("completeness", 1.0)) * 0.3)

        return {
            "sources": sources,
            "level": uncertainty_level,
        }

    def _analyze_knowledge_boundary(
        self,
        response: str,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """分析知识边界"""
        gaps = []
        requires_external = False

        # 检查知识边界指示
        boundary_indicators = {
            "at_boundary": ["接近极限", "不太确定", "borderline", "not entirely sure"],
            "beyond_scope": ["超出范围", "无法回答", "beyond my scope", "cannot answer"],
            "requires_verification": ["需要验证", "需要确认", "needs verification", "should verify"],
        }

        boundary = KnowledgeBoundary.WITHIN_SCOPE

        for boundary_type, indicators in boundary_indicators.items():
            if any(indicator in response.lower() for indicator in indicators):
                if boundary_type == "at_boundary":
                    boundary = KnowledgeBoundary.AT_BOUNDARY
                elif boundary_type == "beyond_scope":
                    boundary = KnowledgeBoundary.BEYOND_SCOPE
                    requires_external = True
                elif boundary_type == "requires_verification":
                    boundary = KnowledgeBoundary.REQUIRES_VERIFICATION
                    requires_external = True

        # 识别知识缺口
        if "不知道" in response or "don't know" in response.lower():
            gaps.append("特定领域知识缺失")

        if "需要更多信息" in response or "need more information" in response.lower():
            gaps.append("任务上下文不完整")

        return {
            "boundary": boundary,
            "gaps": gaps,
            "requires_external": requires_external,
        }

    def _extract_reasoning_steps(self, response: str) -> list[ReasoningStep]:
        """提取推理步骤"""
        steps = []

        # 简单的启发式方法提取推理步骤
        # 查找序号或步骤标记
        step_markers = ["第一步", "第二步", "首先", "然后", "接着", "最后"]

        lines = response.split("\n")
        step_id = 0

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # 检查是否是步骤
            is_step = any(marker in line for marker in step_markers)
            if is_step or (line and line[0].isdigit() and "." in line[:3]):
                step_id += 1
                steps.append(ReasoningStep(
                    step_id=f"step_{step_id}",
                    description=line,
                    confidence=0.7,  # 默认置信度
                ))

        return steps

    def _analyze_self_awareness(self, response: str) -> dict[str, Any]:
        """分析自我意识"""
        awareness = {
            "acknowledges_limitations": False,
            "expresses_uncertainty": False,
            "offers_alternatives": False,
            "requests_clarification": False,
        }

        # 检查是否承认限制
        limitation_phrases = ["我的能力有限", "我可能无法", "这超出了我的", "my limitation", "beyond my ability"]
        awareness["acknowledges_limitations"] = any(
            phrase in response.lower() for phrase in limitation_phrases
        )

        # 检查是否表达不确定性
        uncertainty_phrases = ["不确定", "可能", "也许", "uncertain", "maybe", "perhaps"]
        awareness["expresses_uncertainty"] = any(
            phrase in response.lower() for phrase in uncertainty_phrases
        )

        # 检查是否提供替代方案
        alternative_phrases = ["替代方案", "另一种方法", "或者可以", "alternative", "another approach", "or could"]
        awareness["offers_alternatives"] = any(
            phrase in response.lower() for phrase in alternative_phrases
        )

        # 检查是否请求澄清
        clarification_phrases = ["需要更多信息", "请澄清", "能否说明", "need more info", "please clarify"]
        awareness["requests_clarification"] = any(
            phrase in response.lower() for phrase in clarification_phrases
        )

        return awareness

    def _identify_limitations(
        self,
        response: str,
        context: dict[str, Any],
    ) -> list[str]:
        """识别限制"""
        limitations = []

        # 基于响应内容识别限制
        if "无法访问" in response or "cannot access" in response.lower():
            limitations.append("无法访问外部资源")

        if "实时信息" in response or "real-time information" in response.lower():
            limitations.append("缺乏实时信息")

        if "个人经验" in response or "personal experience" in response.lower():
            limitations.append("缺乏个人经验")

        # 基于上下文识别限制
        if context.get("requires_external_knowledge", False):
            limitations.append("需要外部知识库支持")

        if context.get("complexity", "medium") == "high":
            limitations.append("任务复杂度高")

        return limitations

    def _generate_recommendations(self, report: CognitiveStateReport) -> list[str]:
        """生成建议"""
        recommendations = []

        # 基于置信度生成建议
        if report.overall_confidence < 0.5:
            recommendations.append("建议寻求人类专家验证")
            recommendations.append("考虑使用多个智能体交叉验证")

        # 基于不确定性生成建议
        if report.uncertainty_level > 0.5:
            recommendations.append("需要更多信息来减少不确定性")
            recommendations.append("建议分解任务以降低复杂度")

        # 基于知识边界生成建议
        if report.knowledge_boundary == KnowledgeBoundary.BEYOND_SCOPE:
            recommendations.append("建议转交给专业领域智能体")
            recommendations.append("需要外部知识库或工具支持")

        # 基于元认知生成建议
        if report.self_awareness.get("requests_clarification"):
            recommendations.append("需要与用户澄清需求")

        if report.self_awareness.get("offers_alternatives"):
            recommendations.append("已提供替代方案，建议评估选择")

        return recommendations

    def _suggest_alternatives(
        self,
        report: CognitiveStateReport,
        context: dict[str, Any],
    ) -> list[str]:
        """建议替代方案"""
        alternatives = []

        # 基于认知状态建议替代方案
        if report.overall_confidence < 0.6:
            alternatives.append("使用更专业的领域智能体")
            alternatives.append("分解任务为更小的子任务")

        if report.uncertainty_level > 0.5:
            alternatives.append("收集更多信息后再决策")
            alternatives.append("采用保守策略")

        if report.knowledge_boundary != KnowledgeBoundary.WITHIN_SCOPE:
            alternatives.append("查询外部知识库")
            alternatives.append("使用工具辅助决策")

        return alternatives

    def get_confidence_trend(self, last_n: int = 5) -> list[float]:
        """获取最近N次报告的置信度趋势"""
        if not self.history:
            return []

        recent = self.history[-last_n:]
        return [report.overall_confidence for report in recent]

    def get_summary(self) -> dict[str, Any]:
        """获取认知状态摘要"""
        if not self.history:
            return {
                "agent_id": self.agent_id,
                "total_reports": 0,
                "avg_confidence": 0.0,
                "avg_uncertainty": 0.0,
            }

        recent = self.history[-10:]  # 最近10次
        avg_confidence = sum(r.overall_confidence for r in recent) / len(recent)
        avg_uncertainty = sum(r.uncertainty_level for r in recent) / len(recent)

        return {
            "agent_id": self.agent_id,
            "total_reports": len(self.history),
            "avg_confidence": avg_confidence,
            "avg_uncertainty": avg_uncertainty,
            "confidence_trend": self.get_confidence_trend(),
            "common_limitations": self._get_common_limitations(),
        }

    def _get_common_limitations(self) -> list[str]:
        """获取常见限制"""
        if not self.history:
            return []

        limitation_counts: dict[str, int] = {}
        for report in self.history:
            for limitation in report.limitations:
                limitation_counts[limitation] = limitation_counts.get(limitation, 0) + 1

        # 返回出现次数最多的前5个限制
        sorted_limitations = sorted(
            limitation_counts.items(),
            key=lambda x: x[1],
            reverse=True,
        )
        return [lim for lim, _ in sorted_limitations[:5]]
