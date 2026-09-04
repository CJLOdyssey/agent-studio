"""Tests for backend/workflow/strategy_registry.py."""

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

from workflow.models import NodeStrategy
from workflow.strategies import GeneratorStrategy, ReporterStrategy, ReviewerStrategy
from workflow.strategy_registry import StrategyRegistry, registry


@pytest.mark.unit
class TestStrategyRegistry:
    def test_builtin_strategies_registered(self):
        assert registry.get(NodeStrategy.GENERATOR.value).node_strategy == NodeStrategy.GENERATOR
        assert registry.get(NodeStrategy.REVIEWER.value).node_strategy == NodeStrategy.REVIEWER
        assert registry.get(NodeStrategy.REPORTER.value).node_strategy == NodeStrategy.REPORTER

    def test_enum_key_get(self):
        assert registry.get(NodeStrategy.REVIEWER).node_strategy == NodeStrategy.REVIEWER

    def test_unknown_name_falls_back_to_generator(self):
        assert isinstance(registry.get("no-such-strategy"), GeneratorStrategy)

    def test_register_custom_strategy(self):
        class CustomStrategy:
            node_strategy = "custom"

            def build_prompt_context(self, state, node):
                return ""

            def process_output(self, state, node, output):
                return {"artifacts": state.get("artifacts", {})}

        reg = StrategyRegistry()
        custom = CustomStrategy()
        reg.register(custom)
        assert reg.get("custom") is custom

    def test_register_overwrites_same_key(self):
        class A:
            node_strategy = "dup"

        class B:
            node_strategy = "dup"

        reg = StrategyRegistry()
        a, b = A(), B()
        reg.register(a)
        reg.register(b)
        assert reg.get("dup") is b

    def test_registered_custom_strategy_has_node_strategy(self):
        assert registry.get(NodeStrategy.REVIEWER.value).node_strategy == NodeStrategy.REVIEWER
        assert registry.get(NodeStrategy.REPORTER.value).node_strategy == NodeStrategy.REPORTER


class TestBuiltinStrategyInstances:
    def test_instances_are_distinct(self):
        assert isinstance(registry.get(NodeStrategy.GENERATOR.value), GeneratorStrategy)
        assert isinstance(registry.get(NodeStrategy.REVIEWER.value), ReviewerStrategy)
        assert isinstance(registry.get(NodeStrategy.REPORTER.value), ReporterStrategy)
