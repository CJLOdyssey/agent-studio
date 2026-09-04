"""Tests for context/cost_optimizer.py."""

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

from context.cost_optimizer import CostOptimizer, OptimizationSuggestion


# ---------------------------------------------------------------------------
# OptimizationSuggestion dataclass
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestOptimizationSuggestion:
    def test_creation(self):
        s = OptimizationSuggestion(
            category="token_usage",
            severity="high",
            title="Too many tokens",
            description="Node used too many tokens.",
            estimated_savings=0.3,
            action_items=["Reduce prompt"],
        )
        assert s.category == "token_usage"
        assert s.severity == "high"
        assert s.estimated_savings == 0.3


# ---------------------------------------------------------------------------
# CostOptimizer init
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestCostOptimizerInit:
    def test_defaults(self):
        o = CostOptimizer()
        assert o.target_cost_per_run == 1.0
        assert o.max_tokens_per_node == 10000
        assert o.min_cache_hit_rate == 0.3

    def test_custom(self):
        o = CostOptimizer(target_cost_per_run=0.5, max_tokens_per_node=5000, min_cache_hit_rate=0.5)
        assert o.target_cost_per_run == 0.5
        assert o.max_tokens_per_node == 5000
        assert o.min_cache_hit_rate == 0.5


# ---------------------------------------------------------------------------
# analyze_workflow — token usage analysis
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestAnalyzeTokenUsage:
    def test_high_token_usage_detected(self):
        o = CostOptimizer(max_tokens_per_node=1000)
        token_usage = {"node1": {"total_tokens": 5000}}
        suggestions = o.analyze_workflow({}, token_usage)
        high = [s for s in suggestions if s.severity == "high" and "token" in s.title.lower()]
        assert len(high) >= 1

    def test_verbose_output_detected(self):
        o = CostOptimizer()
        token_usage = {"node1": {"prompt_tokens": 1000, "completion_tokens": 5000, "total_tokens": 6000}}
        suggestions = o.analyze_workflow({}, token_usage)
        verbose = [s for s in suggestions if "verbose" in s.title.lower() or "Verbose" in s.title]
        assert len(verbose) >= 1

    def test_normal_usage_no_suggestions(self):
        o = CostOptimizer(max_tokens_per_node=10000)
        token_usage = {"node1": {"prompt_tokens": 1000, "completion_tokens": 500, "total_tokens": 1500}}
        suggestions = o.analyze_workflow({}, token_usage)
        assert len(suggestions) == 0

    def test_multiple_nodes(self):
        o = CostOptimizer(max_tokens_per_node=1000)
        token_usage = {
            "n1": {"total_tokens": 5000},
            "n2": {"total_tokens": 200},
            "n3": {"total_tokens": 8000},
        }
        suggestions = o.analyze_workflow({}, token_usage)
        high = [s for s in suggestions if s.severity == "high"]
        assert len(high) >= 2


# ---------------------------------------------------------------------------
# analyze_workflow — cache efficiency
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestAnalyzeCacheEfficiency:
    def test_low_cache_hit_rate(self):
        o = CostOptimizer(min_cache_hit_rate=0.3)
        cache_stats = {"hit_rate": 0.1}
        suggestions = o.analyze_workflow({}, {}, cache_stats)
        cache_suggestions = [s for s in suggestions if s.category == "caching"]
        assert len(cache_suggestions) == 1
        assert cache_suggestions[0].severity == "medium"

    def test_good_cache_hit_rate(self):
        o = CostOptimizer(min_cache_hit_rate=0.3)
        cache_stats = {"hit_rate": 0.8}
        suggestions = o.analyze_workflow({}, {}, cache_stats)
        cache_suggestions = [s for s in suggestions if s.category == "caching"]
        assert len(cache_suggestions) == 0

    def test_no_cache_stats(self):
        o = CostOptimizer()
        suggestions = o.analyze_workflow({}, {})
        cache_suggestions = [s for s in suggestions if s.category == "caching"]
        assert len(cache_suggestions) == 0


# ---------------------------------------------------------------------------
# analyze_workflow — workflow structure
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestAnalyzeWorkflowStructure:
    def test_many_nodes_low_tokens(self):
        o = CostOptimizer()
        execution_data = {"node_count": 15, "total_tokens": 3000}
        suggestions = o.analyze_workflow(execution_data, {})
        structure = [s for s in suggestions if s.category == "workflow_structure"]
        assert len(structure) >= 1

    def test_long_duration_low_tokens(self):
        o = CostOptimizer()
        execution_data = {"node_count": 5, "total_tokens": 5000, "duration_seconds": 400}
        suggestions = o.analyze_workflow(execution_data, {})
        structure = [s for s in suggestions if s.category == "workflow_structure"]
        assert len(structure) >= 1

    def test_normal_structure_no_suggestions(self):
        o = CostOptimizer()
        execution_data = {"node_count": 5, "total_tokens": 20000, "duration_seconds": 60}
        suggestions = o.analyze_workflow(execution_data, {})
        structure = [s for s in suggestions if s.category == "workflow_structure"]
        assert len(structure) == 0


# ---------------------------------------------------------------------------
# analyze_workflow — model selection
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestAnalyzeModelSelection:
    def test_expensive_model_small_task(self):
        o = CostOptimizer()
        execution_data = {"model": "gpt-4", "total_tokens": 1000}
        suggestions = o.analyze_workflow(execution_data, {})
        model_suggestions = [s for s in suggestions if s.category == "model_selection"]
        assert len(model_suggestions) == 1
        assert model_suggestions[0].severity == "low"
        assert model_suggestions[0].estimated_savings == 0.5

    def test_expensive_model_large_task_ok(self):
        o = CostOptimizer()
        execution_data = {"model": "gpt-4", "total_tokens": 5000}
        suggestions = o.analyze_workflow(execution_data, {})
        model_suggestions = [s for s in suggestions if s.category == "model_selection"]
        assert len(model_suggestions) == 0

    def test_cheap_model_no_suggestion(self):
        o = CostOptimizer()
        execution_data = {"model": "gpt-3.5-turbo", "total_tokens": 500}
        suggestions = o.analyze_workflow(execution_data, {})
        model_suggestions = [s for s in suggestions if s.category == "model_selection"]
        assert len(model_suggestions) == 0

    def test_claude3_opus_detected(self):
        o = CostOptimizer()
        execution_data = {"model": "claude-3-opus", "total_tokens": 500}
        suggestions = o.analyze_workflow(execution_data, {})
        model_suggestions = [s for s in suggestions if s.category == "model_selection"]
        assert len(model_suggestions) == 1

    def test_deepseek_chat_detected(self):
        o = CostOptimizer()
        execution_data = {"model": "deepseek-chat", "total_tokens": 100}
        suggestions = o.analyze_workflow(execution_data, {})
        model_suggestions = [s for s in suggestions if s.category == "model_selection"]
        assert len(model_suggestions) == 1


# ---------------------------------------------------------------------------
# generate_report
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestGenerateReport:
    def test_report_structure(self):
        o = CostOptimizer()
        execution_data = {"node_count": 15, "total_tokens": 3000, "model": "gpt-4"}
        token_usage = {"n1": {"total_tokens": 5000}}
        report = o.generate_report(execution_data, token_usage)
        assert "total_suggestions" in report
        assert "estimated_savings" in report
        assert "high_priority" in report
        assert "medium_priority" in report
        assert "low_priority" in report
        assert "suggestions" in report

    def test_report_with_no_suggestions(self):
        o = CostOptimizer(max_tokens_per_node=100000)
        execution_data = {"node_count": 2, "total_tokens": 50000, "duration_seconds": 30}
        token_usage = {"n1": {"prompt_tokens": 1000, "completion_tokens": 500, "total_tokens": 1500}}
        report = o.generate_report(execution_data, token_usage)
        assert report["total_suggestions"] == 0
        assert report["estimated_savings"] == "0%"

    def test_report_suggestion_format(self):
        o = CostOptimizer(max_tokens_per_node=100)
        token_usage = {"n1": {"total_tokens": 500}}
        report = o.generate_report({}, token_usage)
        assert report["total_suggestions"] > 0
        s = report["suggestions"][0]
        assert "category" in s
        assert "severity" in s
        assert "title" in s
        assert "description" in s
        assert "estimated_savings" in s
        assert "action_items" in s

    def test_report_with_cache_stats(self):
        o = CostOptimizer(min_cache_hit_rate=0.5)
        cache_stats = {"hit_rate": 0.1}
        report = o.generate_report({}, {}, cache_stats)
        cache_suggestions = [s for s in report["suggestions"] if s["category"] == "caching"]
        assert len(cache_suggestions) == 1

    def test_report_priority_counts(self):
        o = CostOptimizer(max_tokens_per_node=100)
        execution_data = {"node_count": 15, "total_tokens": 3000, "model": "gpt-4"}
        token_usage = {"n1": {"total_tokens": 5000, "prompt_tokens": 1000, "completion_tokens": 5000}}
        report = o.generate_report(execution_data, token_usage)
        total = report["high_priority"] + report["medium_priority"] + report["low_priority"]
        assert total == report["total_suggestions"]
