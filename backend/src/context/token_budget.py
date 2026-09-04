"""多智能体工作流的 token 预算分配。

实现跨 agent 与节点的智能 token 预算分配，在保持质量的同时优化成本。
"""

from dataclasses import dataclass
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class TokenBudget:
    """工作流或节点的 token 预算分配。"""
    total_budget: int
    allocated: int = 0
    used: int = 0
    reserved: int = 0

    @property
    def available(self) -> int:
        """获取可用 tokens。"""
        return self.total_budget - self.allocated

    @property
    def remaining(self) -> int:
        """获取使用后剩余的 tokens。"""
        return self.allocated - self.used

    @property
    def utilization(self) -> float:
        """获取预算利用率比例。"""
        if self.allocated == 0:
            return 0.0
        return self.used / self.allocated

    def allocate(self, amount: int) -> bool:
        """从预算中分配 tokens。

        参数：
            amount: 要分配的 tokens

        返回：
            分配成功返回 True，预算不足返回 False
        """
        if amount > self.available:
            return False
        self.allocated += amount
        return True

    def use(self, amount: int) -> bool:
        """使用已分配的 tokens。

        参数：
            amount: 要使用的 tokens

        返回：
            使用成功返回 True，分配不足返回 False
        """
        if amount > self.remaining:
            return False
        self.used += amount
        return True

    def reserve(self, amount: int) -> bool:
        """预留 tokens 供将来使用。

        参数：
            amount: 要预留的 tokens

        返回：
            预留成功返回 True
        """
        if amount > self.available:
            return False
        self.reserved += amount
        self.allocated += amount
        return True

    def release_reservation(self, amount: int) -> None:
        """释放预留的 tokens。

        参数：
            amount: 要从预留中释放的 tokens
        """
        self.reserved = max(0, self.reserved - amount)
        self.allocated = max(0, self.allocated - amount)


class TokenBudgetManager:
    """管理跨工作流节点的 token 预算分配。

    实现基于优先级的分配：
    - 关键节点获得保证预算
    - 普通节点获得按比例的预算
    - 低优先级节点获得剩余预算
    """

    def __init__(
        self,
        total_budget: int = 100000,
        safety_margin: float = 0.1,
    ):
        """初始化预算管理器。

        Args:
            total_budget: 工作流的总 token 预算
            safety_margin: 为意外用量预留的百分比
        """
        self.total_budget = total_budget
        self.safety_margin = safety_margin
        self.reserved_budget = int(total_budget * safety_margin)
        self.allocatable_budget = total_budget - self.reserved_budget

        self.node_budgets: dict[str, TokenBudget] = {}
        self.node_priorities: dict[str, int] = {}  # 1=最高，3=最低

        # 全局工作流预算
        self.workflow_budget = TokenBudget(total_budget=total_budget)

    def set_node_priority(self, node_id: str, priority: int) -> None:
        """设置节点优先级。

        参数：
            node_id: 节点标识
            priority: 优先级（1=最高，3=最低）
        """
        self.node_priorities[node_id] = max(1, min(3, priority))

    def allocate_budget(
        self,
        node_configs: list[dict[str, Any]],
    ) -> dict[str, int]:
        """按优先级与预估需求在节点间分配预算。

        参数：
            node_configs: 带预估 token 需求的节点配置列表

        返回：
            node_id 到已分配 tokens 的映射字典
        """
        if not node_configs:
            return {}

        # 按优先级分组节点
        priority_groups: dict[int, list[dict[str, Any]]] = {1: [], 2: [], 3: []}
        for config in node_configs:
            priority = config.get("priority", 2)
            priority_groups[priority].append(config)

        # 在优先级组内按比例分配预算
        # 优先级 1 占 50%，优先级 2 占 30%，优先级 3 占 20%
        priority_weights = {1: 0.5, 2: 0.3, 3: 0.2}
        allocations: dict[str, int] = {}

        remaining_budget = self.allocatable_budget

        for priority in [1, 2, 3]:
            group = priority_groups[priority]
            if not group:
                continue

            group_budget = int(remaining_budget * priority_weights[priority])

            # 计算该组的总预估需求
            total_estimated = sum(
                config.get("estimated_tokens", 1000)
                for config in group
            )

            # 按比例分配，以预估为上限
            for config in group:
                node_id = config["node_id"]
                estimated = config.get("estimated_tokens", 1000)

                if total_estimated > 0:
                    # 按比例分配
                    allocation = int(group_budget * (estimated / total_estimated))
                else:
                    # 平均分配
                    allocation = group_budget // len(group)

                # 以预估需求为上限（不过度分配）
                allocation = min(allocation, estimated)

                allocations[node_id] = allocation

                # 为该节点创建预算
                self.node_budgets[node_id] = TokenBudget(
                    total_budget=allocation,
                )
                self.set_node_priority(node_id, priority)

        return allocations

    def get_node_budget(self, node_id: str) -> TokenBudget | None:
        """获取某节点的预算。

        参数：
            node_id: 节点标识

        返回：
            该节点的 TokenBudget；未分配则返回 None
        """
        return self.node_budgets.get(node_id)

    def record_usage(self, node_id: str, tokens: int) -> None:
        """记录某节点的 token 用量。

        参数：
            node_id: 节点标识
            tokens: 已使用的 token 数
        """
        if node_id in self.node_budgets:
            self.node_budgets[node_id].use(tokens)
        self.workflow_budget.use(tokens)

    def check_budget_available(self, node_id: str, required_tokens: int) -> bool:
        """检查某节点是否有足够可用预算。

        参数：
            node_id: 节点标识
            required_tokens: 所需 tokens

        返回：
            预算充足返回 True
        """
        budget = self.node_budgets.get(node_id)
        if not budget:
            return False
        return budget.remaining >= required_tokens

    def get_utilization_report(self) -> dict[str, Any]:
        """获取预算利用率报告。

        返回：
            含利用率统计的字典
        """
        node_utilization = {}
        for node_id, budget in self.node_budgets.items():
            node_utilization[node_id] = {
                "allocated": budget.allocated,
                "used": budget.used,
                "remaining": budget.remaining,
                "utilization": budget.utilization,
                "priority": self.node_priorities.get(node_id, 2),
            }

        return {
            "total_budget": self.total_budget,
            "workflow_used": self.workflow_budget.used,
            "workflow_remaining": self.workflow_budget.remaining,
            "workflow_utilization": self.workflow_budget.utilization,
            "node_utilization": node_utilization,
            "reserved_budget": self.reserved_budget,
        }

    def suggest_optimizations(self) -> list[dict[str, Any]]:
        """基于用量模式给出预算优化建议。

        返回：
            优化建议列表
        """
        suggestions = []

        for node_id, budget in self.node_budgets.items():
            utilization = budget.utilization

            # 预算利用率偏低
            if utilization < 0.3 and budget.allocated > 1000:
                suggestions.append({
                    "type": "reduce_allocation",
                    "node_id": node_id,
                    "current_allocation": budget.allocated,
                    "suggested_allocation": int(budget.allocated * 0.5),
                    "reason": f"Low utilization ({utilization:.1%}), consider reducing allocation",
                })

            # 预算利用率偏高（可能需要更多）
            if utilization > 0.9:
                suggestions.append({
                    "type": "increase_allocation",
                    "node_id": node_id,
                    "current_allocation": budget.allocated,
                    "reason": f"High utilization ({utilization:.1%}), node may need more tokens",
                })

        # 检查预算再分配机会
        high_util_nodes = [
            nid for nid, b in self.node_budgets.items()
            if b.utilization > 0.8
        ]
        low_util_nodes = [
            nid for nid, b in self.node_budgets.items()
            if b.utilization < 0.3
        ]

        if high_util_nodes and low_util_nodes:
            suggestions.append({
                "type": "redistribute",
                "from_nodes": low_util_nodes,
                "to_nodes": high_util_nodes,
                "reason": "Redistribute budget from under-utilized to over-utilized nodes",
            })

        return suggestions
