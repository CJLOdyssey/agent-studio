"""多智能体工作流的成本优化建议器。

分析 token 用量模式，在保持输出质量的同时给出可执行的降本建议。
"""

from dataclasses import dataclass
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class OptimizationSuggestion:
    """单条成本优化建议。"""
    category: str
    severity: str  # "low", "medium", "high"
    title: str
    description: str
    estimated_savings: float  # 可节省的成本百分比
    action_items: list[str]


class CostOptimizer:
    """分析工作流执行数据并给出成本优化建议。

    监控：
    - 各节点的 token 用量模式
    - 冗余的 API 调用
    - 低效的提示词模式
    - 缓存命中率
    - 模型选择效率
    """

    def __init__(
        self,
        target_cost_per_run: float = 1.0,
        max_tokens_per_node: int = 10000,
        min_cache_hit_rate: float = 0.3,
    ):
        """初始化成本优化器。

        参数：
            target_cost_per_run: 每次工作流运行的目标成本（美元）
            max_tokens_per_node: 每节点的建议最大 tokens
            min_cache_hit_rate: 最低可接受的缓存命中率
        """
        self.target_cost_per_run = target_cost_per_run
        self.max_tokens_per_node = max_tokens_per_node
        self.min_cache_hit_rate = min_cache_hit_rate

    def analyze_workflow(
        self,
        execution_data: dict[str, Any],
        token_usage: dict[str, Any],
        cache_stats: dict[str, Any] | None = None,
    ) -> list[OptimizationSuggestion]:
        """分析工作流执行并生成优化建议。

        参数：
            execution_data: 工作流执行元数据
            token_usage: 各节点 token 用量
            cache_stats: 可选的缓存统计

        返回：
            优化建议列表
        """
        suggestions: list[OptimizationSuggestion] = []

        # 分析各节点 token 用量
        suggestions.extend(self._analyze_token_usage(token_usage))

        # 分析缓存效率
        if cache_stats:
            suggestions.extend(self._analyze_cache_efficiency(cache_stats))

        # 分析工作流结构
        suggestions.extend(self._analyze_workflow_structure(execution_data))

        # 分析模型选择
        suggestions.extend(self._analyze_model_selection(execution_data, token_usage))

        return suggestions

    def _analyze_token_usage(
        self,
        token_usage: dict[str, Any],
    ) -> list[OptimizationSuggestion]:
        """分析 token 用量模式。"""
        suggestions = []

        for node_id, usage in token_usage.items():
            total_tokens = usage.get("total_tokens", 0)

            # 检查是否过度使用 token
            if total_tokens > self.max_tokens_per_node:
                suggestions.append(OptimizationSuggestion(
                    category="token_usage",
                    severity="high",
                    title=f"High token usage in node '{node_id}'",
                    description=(
                        f"Node '{node_id}' used {total_tokens} tokens, "
                        f"exceeding the recommended limit of {self.max_tokens_per_node}."
                    ),
                    estimated_savings=0.3,
                    action_items=[
                        "Review and shorten the system prompt",
                        "Enable context compression for this node",
                        "Consider using a more efficient model",
                        "Reduce max_tokens parameter",
                    ],
                ))

            # 检查输出/输入比是否过高（输出冗长）
            input_tokens = usage.get("prompt_tokens", 0)
            output_tokens = usage.get("completion_tokens", 0)
            if input_tokens > 0 and output_tokens / input_tokens > 2.0:
                suggestions.append(OptimizationSuggestion(
                    category="token_usage",
                    severity="medium",
                    title=f"Verbose output in node '{node_id}'",
                    description=(
                        f"Output tokens ({output_tokens}) are {output_tokens / input_tokens:.1f}x "
                        f"the input tokens ({input_tokens}). Consider more concise prompting."
                    ),
                    estimated_savings=0.2,
                    action_items=[
                        "Add instructions for concise responses",
                        "Use structured output formats (JSON)",
                        "Reduce max_tokens to limit output length",
                    ],
                ))

        return suggestions

    def _analyze_cache_efficiency(
        self,
        cache_stats: dict[str, Any],
    ) -> list[OptimizationSuggestion]:
        """分析缓存命中率并给出改进建议。"""
        suggestions = []

        hit_rate = cache_stats.get("hit_rate", 0.0)

        if hit_rate < self.min_cache_hit_rate:
            suggestions.append(OptimizationSuggestion(
                category="caching",
                severity="medium",
                title="Low cache hit rate",
                description=(
                    f"Cache hit rate is {hit_rate:.1%}, below the recommended "
                    f"{self.min_cache_hit_rate:.1%}. Many redundant API calls detected."
                ),
                estimated_savings=0.25,
                action_items=[
                    "Enable response caching for repeated prompts",
                    "Increase cache TTL for stable responses",
                    "Review prompt variations that prevent cache hits",
                    "Consider semantic similarity caching",
                ],
            ))

        return suggestions

    def _analyze_workflow_structure(
        self,
        execution_data: dict[str, Any],
    ) -> list[OptimizationSuggestion]:
        """分析工作流结构以寻找优化机会。"""
        suggestions = []

        node_count = execution_data.get("node_count", 0)
        total_tokens = execution_data.get("total_tokens", 0)

        # 检查节点是否过多（开销）
        if node_count > 10 and total_tokens < 5000:
            suggestions.append(OptimizationSuggestion(
                category="workflow_structure",
                severity="low",
                title="Workflow has many nodes with low token usage",
                description=(
                    f"Workflow has {node_count} nodes but only used {total_tokens} tokens total. "
                    "Consider consolidating simple nodes to reduce orchestration overhead."
                ),
                estimated_savings=0.1,
                action_items=[
                    "Merge simple sequential nodes",
                    "Use a single node for related tasks",
                    "Review if all nodes are necessary",
                ],
            ))

        # 检查执行时间是否过长
        duration = execution_data.get("duration_seconds", 0)
        if duration > 300 and total_tokens < 10000:
            suggestions.append(OptimizationSuggestion(
                category="workflow_structure",
                severity="medium",
                title="Long execution time with low token usage",
                description=(
                    f"Workflow took {duration:.0f}s but only used {total_tokens} tokens. "
                    "This suggests inefficient orchestration or excessive waiting."
                ),
                estimated_savings=0.15,
                action_items=[
                    "Enable parallel execution where possible",
                    "Reduce timeouts and retry delays",
                    "Check for unnecessary sequential dependencies",
                ],
            ))

        return suggestions

    def _analyze_model_selection(
        self,
        execution_data: dict[str, Any],
        token_usage: dict[str, Any],
    ) -> list[OptimizationSuggestion]:
        """分析模型选择效率。"""
        suggestions = []

        model = execution_data.get("model", "")
        total_tokens = execution_data.get("total_tokens", 0)

        # 检查简单任务是否使用了昂贵模型
        expensive_models = ["gpt-4", "claude-3-opus", "deepseek-chat"]
        if model in expensive_models and total_tokens < 2000:
            suggestions.append(OptimizationSuggestion(
                category="model_selection",
                severity="low",
                title=f"Expensive model '{model}' used for small task",
                description=(
                    f"Using '{model}' for only {total_tokens} tokens. "
                    "Consider a cheaper model for small or simple tasks."
                ),
                estimated_savings=0.5,
                action_items=[
                    "Use a cheaper model for simple nodes",
                    "Implement model routing based on task complexity",
                    "Consider using local models for straightforward tasks",
                ],
            ))

        return suggestions

    def generate_report(
        self,
        execution_data: dict[str, Any],
        token_usage: dict[str, Any],
        cache_stats: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """生成综合成本优化报告。

        参数：
            execution_data: 工作流执行元数据
            token_usage: 各节点 token 用量
            cache_stats: 可选的缓存统计

        返回：
            含优化报告的字典
        """
        suggestions = self.analyze_workflow(
            execution_data, token_usage, cache_stats
        )

        # 计算总预计节省
        total_savings = sum(s.estimated_savings for s in suggestions) / len(suggestions) if suggestions else 0.0

        # 按严重程度分组
        high_severity = [s for s in suggestions if s.severity == "high"]
        medium_severity = [s for s in suggestions if s.severity == "medium"]
        low_severity = [s for s in suggestions if s.severity == "low"]

        return {
            "total_suggestions": len(suggestions),
            "estimated_savings": f"{total_savings:.0%}",
            "high_priority": len(high_severity),
            "medium_priority": len(medium_severity),
            "low_priority": len(low_severity),
            "suggestions": [
                {
                    "category": s.category,
                    "severity": s.severity,
                    "title": s.title,
                    "description": s.description,
                    "estimated_savings": f"{s.estimated_savings:.0%}",
                    "action_items": s.action_items,
                }
                for s in suggestions
            ],
        }
