"""Token budget allocation for multi-agent workflows.

Implements intelligent token budget allocation across agents and nodes
to optimize cost while maintaining quality.
"""

from dataclasses import dataclass
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class TokenBudget:
    """Token budget allocation for a workflow or node."""
    total_budget: int
    allocated: int = 0
    used: int = 0
    reserved: int = 0

    @property
    def available(self) -> int:
        """Get available tokens."""
        return self.total_budget - self.allocated

    @property
    def remaining(self) -> int:
        """Get remaining tokens after usage."""
        return self.allocated - self.used

    @property
    def utilization(self) -> float:
        """Get budget utilization ratio."""
        if self.allocated == 0:
            return 0.0
        return self.used / self.allocated

    def allocate(self, amount: int) -> bool:
        """Allocate tokens from budget.

        Args:
            amount: Tokens to allocate

        Returns:
            True if allocation succeeded, False if insufficient budget
        """
        if amount > self.available:
            return False
        self.allocated += amount
        return True

    def use(self, amount: int) -> bool:
        """Use allocated tokens.

        Args:
            amount: Tokens to use

        Returns:
            True if usage succeeded, False if insufficient allocation
        """
        if amount > self.remaining:
            return False
        self.used += amount
        return True

    def reserve(self, amount: int) -> bool:
        """Reserve tokens for future use.

        Args:
            amount: Tokens to reserve

        Returns:
            True if reservation succeeded
        """
        if amount > self.available:
            return False
        self.reserved += amount
        self.allocated += amount
        return True

    def release_reservation(self, amount: int) -> None:
        """Release reserved tokens.

        Args:
            amount: Tokens to release from reservation
        """
        self.reserved = max(0, self.reserved - amount)
        self.allocated = max(0, self.allocated - amount)


class TokenBudgetManager:
    """Manages token budget allocation across workflow nodes.

    Implements priority-based allocation:
    - Critical nodes get guaranteed budget
    - Normal nodes get proportional budget
    - Low priority nodes get remaining budget
    """

    def __init__(
        self,
        total_budget: int = 100000,
        safety_margin: float = 0.1,
    ):
        """Initialize budget manager.

        Args:
            total_budget: Total token budget for workflow
            safety_margin: Percentage to reserve for unexpected usage
        """
        self.total_budget = total_budget
        self.safety_margin = safety_margin
        self.reserved_budget = int(total_budget * safety_margin)
        self.allocatable_budget = total_budget - self.reserved_budget

        self.node_budgets: dict[str, TokenBudget] = {}
        self.node_priorities: dict[str, int] = {}  # 1=highest, 3=lowest

        # Global workflow budget
        self.workflow_budget = TokenBudget(total_budget=total_budget)

    def set_node_priority(self, node_id: str, priority: int) -> None:
        """Set priority for a node.

        Args:
            node_id: Node identifier
            priority: Priority level (1=highest, 3=lowest)
        """
        self.node_priorities[node_id] = max(1, min(3, priority))

    def allocate_budget(
        self,
        node_configs: list[dict[str, Any]],
    ) -> dict[str, int]:
        """Allocate budget across nodes based on priority and estimated needs.

        Args:
            node_configs: List of node configurations with estimated token needs

        Returns:
            Dictionary mapping node_id to allocated tokens
        """
        if not node_configs:
            return {}

        # Group nodes by priority
        priority_groups: dict[int, list[dict[str, Any]]] = {1: [], 2: [], 3: []}
        for config in node_configs:
            priority = config.get("priority", 2)
            priority_groups[priority].append(config)

        # Allocate budget proportionally within priority groups
        # Priority 1 gets 50%, Priority 2 gets 30%, Priority 3 gets 20%
        priority_weights = {1: 0.5, 2: 0.3, 3: 0.2}
        allocations: dict[str, int] = {}

        remaining_budget = self.allocatable_budget

        for priority in [1, 2, 3]:
            group = priority_groups[priority]
            if not group:
                continue

            group_budget = int(remaining_budget * priority_weights[priority])

            # Calculate total estimated need for this group
            total_estimated = sum(
                config.get("estimated_tokens", 1000)
                for config in group
            )

            # Allocate proportionally, capped by estimate
            for config in group:
                node_id = config["node_id"]
                estimated = config.get("estimated_tokens", 1000)

                if total_estimated > 0:
                    # Proportional allocation
                    allocation = int(group_budget * (estimated / total_estimated))
                else:
                    # Equal allocation
                    allocation = group_budget // len(group)

                # Cap at estimated need (don't over-allocate)
                allocation = min(allocation, estimated)

                allocations[node_id] = allocation

                # Create budget for this node
                self.node_budgets[node_id] = TokenBudget(
                    total_budget=allocation,
                )
                self.set_node_priority(node_id, priority)

        return allocations

    def get_node_budget(self, node_id: str) -> TokenBudget | None:
        """Get budget for a specific node.

        Args:
            node_id: Node identifier

        Returns:
            TokenBudget for the node, or None if not allocated
        """
        return self.node_budgets.get(node_id)

    def record_usage(self, node_id: str, tokens: int) -> None:
        """Record token usage for a node.

        Args:
            node_id: Node identifier
            tokens: Number of tokens used
        """
        if node_id in self.node_budgets:
            self.node_budgets[node_id].use(tokens)
        self.workflow_budget.use(tokens)

    def check_budget_available(self, node_id: str, required_tokens: int) -> bool:
        """Check if sufficient budget is available for a node.

        Args:
            node_id: Node identifier
            required_tokens: Tokens needed

        Returns:
            True if budget is available
        """
        budget = self.node_budgets.get(node_id)
        if not budget:
            return False
        return budget.remaining >= required_tokens

    def get_utilization_report(self) -> dict[str, Any]:
        """Get budget utilization report.

        Returns:
            Dictionary with utilization statistics
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
        """Suggest budget optimizations based on usage patterns.

        Returns:
            List of optimization suggestions
        """
        suggestions = []

        for node_id, budget in self.node_budgets.items():
            utilization = budget.utilization

            # Under-utilized budget
            if utilization < 0.3 and budget.allocated > 1000:
                suggestions.append({
                    "type": "reduce_allocation",
                    "node_id": node_id,
                    "current_allocation": budget.allocated,
                    "suggested_allocation": int(budget.allocated * 0.5),
                    "reason": f"Low utilization ({utilization:.1%}), consider reducing allocation",
                })

            # Over-utilized budget (might need more)
            if utilization > 0.9:
                suggestions.append({
                    "type": "increase_allocation",
                    "node_id": node_id,
                    "current_allocation": budget.allocated,
                    "reason": f"High utilization ({utilization:.1%}), node may need more tokens",
                })

        # Check for budget redistribution opportunities
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
