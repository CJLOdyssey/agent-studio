"""Extensible strategy registry — register new node strategies without editing this file."""

from typing import Any

from .strategies import GeneratorStrategy, ReporterStrategy, ReviewerStrategy, Strategy


class StrategyRegistry:
    """Maps node-strategy names to Strategy instances.

    Defaults to GeneratorStrategy for unknown names so a typo never crashes the
    graph. ``node_strategy`` may be a ``NodeStrategy`` enum or a plain string.
    """

    def __init__(self) -> None:
        self._strategies: dict[str, Strategy] = {}

    @staticmethod
    def _key(name: Any) -> str:
        return name.value if hasattr(name, "value") else str(name)

    def register(self, strategy: Strategy) -> None:
        self._strategies[self._key(strategy.node_strategy)] = strategy

    def get(self, name: Any) -> Strategy:
        return self._strategies.get(self._key(name), GeneratorStrategy())


registry = StrategyRegistry()
registry.register(GeneratorStrategy())
registry.register(ReviewerStrategy())
registry.register(ReporterStrategy())
