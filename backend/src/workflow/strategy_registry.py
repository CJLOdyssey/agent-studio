"""可扩展的策略注册表——无需修改本文件即可注册新的节点策略。"""

from typing import Any

from .strategies import GeneratorStrategy, ReporterStrategy, ReviewerStrategy, Strategy


class StrategyRegistry:
    """将节点策略名映射到 Strategy 实例。

    对未知名称回退到 GeneratorStrategy，从而避免拼写错误导致图崩溃。
    ``node_strategy`` 可以是 ``NodeStrategy`` 枚举或普通字符串。
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
