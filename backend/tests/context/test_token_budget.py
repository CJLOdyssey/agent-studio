"""Tests for context/token_budget.py."""

import os

import pytest

os.environ.setdefault("AUTH_MODE", "legacy")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("KEY_VAULT_SECRET", "0123456789abcdef0123456789abcdef")
os.environ.setdefault("AUTH_ENABLED", "0")
os.environ.setdefault("RATE_LIMIT", "9999")
os.environ.setdefault("CHECKPOINTER_BACKEND", "memory")
os.environ.setdefault("DATABASE_POOL_SIZE", "0")

from context.token_budget import TokenBudget, TokenBudgetManager


# ---------------------------------------------------------------------------
# TokenBudget dataclass
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestTokenBudget:
    def test_init_defaults(self):
        b = TokenBudget(total_budget=1000)
        assert b.total_budget == 1000
        assert b.allocated == 0
        assert b.used == 0
        assert b.reserved == 0

    def test_init_custom(self):
        b = TokenBudget(total_budget=5000, allocated=1000, used=500, reserved=200)
        assert b.allocated == 1000
        assert b.used == 500

    def test_available(self):
        b = TokenBudget(total_budget=1000, allocated=300)
        assert b.available == 700

    def test_available_no_allocation(self):
        b = TokenBudget(total_budget=1000)
        assert b.available == 1000

    def test_remaining(self):
        b = TokenBudget(total_budget=1000, allocated=600, used=200)
        assert b.remaining == 400

    def test_utilization(self):
        b = TokenBudget(total_budget=1000, allocated=1000, used=500)
        assert b.utilization == 0.5

    def test_utilization_zero_allocated(self):
        b = TokenBudget(total_budget=1000)
        assert b.utilization == 0.0

    def test_allocate_success(self):
        b = TokenBudget(total_budget=1000)
        assert b.allocate(300) is True
        assert b.allocated == 300
        assert b.available == 700

    def test_allocate_insufficient(self):
        b = TokenBudget(total_budget=100)
        assert b.allocate(200) is False
        assert b.allocated == 0

    def test_allocate_exact(self):
        b = TokenBudget(total_budget=100)
        assert b.allocate(100) is True
        assert b.available == 0

    def test_use_success(self):
        b = TokenBudget(total_budget=1000, allocated=500)
        assert b.use(300) is True
        assert b.used == 300
        assert b.remaining == 200

    def test_use_insufficient(self):
        b = TokenBudget(total_budget=1000, allocated=100)
        assert b.use(200) is False
        assert b.used == 0

    def test_use_exact(self):
        b = TokenBudget(total_budget=1000, allocated=500)
        assert b.use(500) is True
        assert b.remaining == 0

    def test_reserve_success(self):
        b = TokenBudget(total_budget=1000)
        assert b.reserve(200) is True
        assert b.reserved == 200
        assert b.allocated == 200
        assert b.available == 800

    def test_reserve_insufficient(self):
        b = TokenBudget(total_budget=100)
        assert b.reserve(200) is False
        assert b.reserved == 0

    def test_release_reservation(self):
        b = TokenBudget(total_budget=1000)
        b.reserve(300)
        assert b.reserved == 300
        assert b.allocated == 300
        b.release_reservation(100)
        assert b.reserved == 200
        assert b.allocated == 200

    def test_release_reservation_clamps_to_zero(self):
        b = TokenBudget(total_budget=1000)
        b.reserve(100)
        b.release_reservation(500)
        assert b.reserved == 0
        assert b.allocated == 0


# ---------------------------------------------------------------------------
# TokenBudgetManager
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestTokenBudgetManager:
    def test_init_defaults(self):
        m = TokenBudgetManager()
        assert m.total_budget == 100000
        assert m.safety_margin == 0.1
        assert m.reserved_budget == 10000
        assert m.allocatable_budget == 90000

    def test_init_custom(self):
        m = TokenBudgetManager(total_budget=50000, safety_margin=0.2)
        assert m.total_budget == 50000
        assert m.reserved_budget == 10000
        assert m.allocatable_budget == 40000

    def test_set_node_priority(self):
        m = TokenBudgetManager()
        m.set_node_priority("n1", 2)
        assert m.node_priorities["n1"] == 2

    def test_set_node_priority_clamped(self):
        m = TokenBudgetManager()
        m.set_node_priority("n1", 0)
        assert m.node_priorities["n1"] == 1
        m.set_node_priority("n2", 5)
        assert m.node_priorities["n2"] == 3

    def test_allocate_budget_empty(self):
        m = TokenBudgetManager()
        assert m.allocate_budget([]) == {}

    def test_allocate_budget_single_group(self):
        m = TokenBudgetManager(total_budget=10000)
        configs = [{"node_id": "n1", "priority": 1, "estimated_tokens": 5000}]
        allocations = m.allocate_budget(configs)
        assert "n1" in allocations
        assert allocations["n1"] > 0

    def test_allocate_budget_priority_groups(self):
        m = TokenBudgetManager(total_budget=100000)
        configs = [
            {"node_id": "p1", "priority": 1, "estimated_tokens": 5000},
            {"node_id": "p2", "priority": 2, "estimated_tokens": 3000},
            {"node_id": "p3", "priority": 3, "estimated_tokens": 1000},
        ]
        allocations = m.allocate_budget(configs)
        # Priority 1 should get more than priority 2
        assert allocations["p1"] > allocations["p2"]
        assert allocations["p2"] > allocations["p3"]

    def test_allocate_budget_respects_estimated_cap(self):
        m = TokenBudgetManager(total_budget=1000000)
        configs = [{"node_id": "n1", "priority": 1, "estimated_tokens": 500}]
        allocations = m.allocate_budget(configs)
        assert allocations["n1"] <= 500

    def test_allocate_budget_creates_node_budgets(self):
        m = TokenBudgetManager(total_budget=10000)
        configs = [{"node_id": "n1", "estimated_tokens": 1000}]
        m.allocate_budget(configs)
        assert m.get_node_budget("n1") is not None

    def test_get_node_budget_nonexistent(self):
        m = TokenBudgetManager()
        assert m.get_node_budget("nope") is None

    def test_record_usage(self):
        m = TokenBudgetManager(total_budget=10000)
        configs = [{"node_id": "n1", "estimated_tokens": 5000}]
        m.allocate_budget(configs)
        budget = m.get_node_budget("n1")
        assert budget is not None
        # allocate_budget creates budget with allocated=0; must allocate before use
        budget.allocate(500)
        m.record_usage("n1", 100)
        assert budget.used == 100

    def test_record_usage_unknown_node(self):
        m = TokenBudgetManager()
        # Should not raise — just records to workflow budget
        m.record_usage("unknown", 50)

    def test_check_budget_available(self):
        m = TokenBudgetManager(total_budget=10000)
        configs = [{"node_id": "n1", "estimated_tokens": 5000}]
        m.allocate_budget(configs)
        budget = m.get_node_budget("n1")
        assert budget is not None
        budget.allocate(500)
        assert m.check_budget_available("n1", 100) is True

    def test_check_budget_insufficient(self):
        m = TokenBudgetManager(total_budget=10000)
        configs = [{"node_id": "n1", "estimated_tokens": 100}]
        m.allocate_budget(configs)
        budget = m.get_node_budget("n1")
        assert budget is not None
        budget.allocate(100)
        assert m.check_budget_available("n1", 200) is False

    def test_check_budget_unknown_node(self):
        m = TokenBudgetManager()
        assert m.check_budget_available("nope", 100) is False

    def test_get_utilization_report(self):
        m = TokenBudgetManager(total_budget=10000)
        configs = [{"node_id": "n1", "estimated_tokens": 5000}]
        m.allocate_budget(configs)
        budget = m.get_node_budget("n1")
        assert budget is not None
        budget.allocate(2000)
        budget.use(1000)
        m.workflow_budget.allocate(1000)
        m.workflow_budget.use(1000)
        report = m.get_utilization_report()
        assert report["total_budget"] == 10000
        assert report["workflow_used"] == 1000
        assert "n1" in report["node_utilization"]
        assert report["node_utilization"]["n1"]["used"] == 1000

    def test_suggest_optimizations_low_utilization(self):
        m = TokenBudgetManager(total_budget=100000)
        configs = [
            {"node_id": "n1", "estimated_tokens": 10000},
            {"node_id": "n2", "estimated_tokens": 10000},
        ]
        m.allocate_budget(configs)
        b1 = m.get_node_budget("n1")
        assert b1 is not None
        b1.allocate(10000)
        b1.use(100)  # low utilization
        b2 = m.get_node_budget("n2")
        assert b2 is not None
        b2.allocate(10000)
        b2.use(5000)
        suggestions = m.suggest_optimizations()
        reduce_suggestions = [s for s in suggestions if s["type"] == "reduce_allocation"]
        assert len(reduce_suggestions) >= 1
        assert reduce_suggestions[0]["node_id"] == "n1"

    def test_suggest_optimizations_high_utilization(self):
        m = TokenBudgetManager(total_budget=100000)
        configs = [{"node_id": "n1", "estimated_tokens": 5000}]
        m.allocate_budget(configs)
        budget = m.get_node_budget("n1")
        assert budget is not None
        budget.allocate(5000)
        budget.use(int(5000 * 0.95))  # high utilization
        suggestions = m.suggest_optimizations()
        increase_suggestions = [s for s in suggestions if s["type"] == "increase_allocation"]
        assert len(increase_suggestions) >= 1

    def test_suggest_optimizations_redistribute(self):
        m = TokenBudgetManager(total_budget=100000)
        configs = [
            {"node_id": "high", "estimated_tokens": 10000},
            {"node_id": "low", "estimated_tokens": 10000},
        ]
        m.allocate_budget(configs)
        high = m.get_node_budget("high")
        low = m.get_node_budget("low")
        assert high is not None
        assert low is not None
        high.allocate(10000)
        high.use(int(10000 * 0.95))  # high utilization
        low.allocate(10000)
        low.use(100)  # low utilization
        suggestions = m.suggest_optimizations()
        redistribute = [s for s in suggestions if s["type"] == "redistribute"]
        assert len(redistribute) >= 1
