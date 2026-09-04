"""工作流依赖的熔断器。

实现熔断器模式，以防止外部依赖（LLM、工具、数据库）失败时产生级联故障。
"""

import asyncio
import time
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum
from typing import Any


class CircuitState(Enum):
    """熔断器状态。"""
    CLOSED = "closed"      # 正常运行，请求放行
    OPEN = "open"          # 已失败，请求被阻断
    HALF_OPEN = "half_open"  # 探测恢复，仅放行有限请求


@dataclass
class CircuitBreakerStats:
    """熔断器的统计信息。"""
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: float = 0.0
    last_success_time: float = 0.0
    total_requests: int = 0
    blocked_requests: int = 0


class CircuitBreaker:
    """用于抵御依赖故障的熔断器。

    实现三态熔断器模式：
    - CLOSED：正常运行，请求放行
    - OPEN：依赖已失败，请求立即被阻断
    - HALF_OPEN：探测恢复，仅放行有限请求

    当失败次数超过阈值时熔断器打开。超时后进入半开状态以探测恢复。
    半开状态下成功则闭合熔断器；失败则重新打开。
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        success_threshold: int = 2,
    ):
        """初始化熔断器。

        Args:
            name: 该熔断器的标识
            failure_threshold: 打开熔断器前的失败次数
            recovery_timeout: 探测恢复前的等待秒数
            success_threshold: 半开状态下闭合熔断器所需的成功次数
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time = 0.0
        self._last_success_time = 0.0
        self._total_requests = 0
        self._blocked_requests = 0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        """获取当前熔断器状态。"""
        return self._state

    @property
    def stats(self) -> CircuitBreakerStats:
        """获取熔断器统计信息。"""
        return CircuitBreakerStats(
            state=self._state,
            failure_count=self._failure_count,
            success_count=self._success_count,
            last_failure_time=self._last_failure_time,
            last_success_time=self._last_success_time,
            total_requests=self._total_requests,
            blocked_requests=self._blocked_requests,
        )

    async def call(self, func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        """通过熔断器执行函数。

        Args:
            func: 要执行的异步函数
            *args: 位置参数
            **kwargs: 关键字参数

        Returns:
            函数结果

        Raises:
            CircuitBreakerOpenError: 若熔断器处于打开状态
            Exception: 若函数执行失败
        """
        async with self._lock:
            self._total_requests += 1

            # 检查是否应从 OPEN 转换到 HALF_OPEN
            if self._state == CircuitState.OPEN:
                if time.time() - self._last_failure_time >= self.recovery_timeout:
                    self._state = CircuitState.HALF_OPEN
                    self._success_count = 0
                else:
                    self._blocked_requests += 1
                    raise CircuitBreakerOpenError(
                        f"Circuit breaker '{self.name}' is open"
                    )

        try:
            result = await func(*args, **kwargs)

            async with self._lock:
                self._success_count += 1
                self._last_success_time = time.time()

                if self._state == CircuitState.HALF_OPEN:
                    if self._success_count >= self.success_threshold:
                        self._state = CircuitState.CLOSED
                        self._failure_count = 0
                elif self._state == CircuitState.CLOSED:
                    self._failure_count = 0

            return result

        except Exception:
            async with self._lock:
                self._failure_count += 1
                self._last_failure_time = time.time()

                if self._state == CircuitState.HALF_OPEN:
                    # 半开状态下任何失败都会重新打开熔断器
                    self._state = CircuitState.OPEN
                elif self._state == CircuitState.CLOSED and self._failure_count >= self.failure_threshold:
                    self._state = CircuitState.OPEN

            raise

    def reset(self) -> None:
        """将熔断器重置为闭合状态。"""
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time = 0.0
        self._last_success_time = 0.0


class CircuitBreakerOpenError(Exception):
    """当熔断器打开且请求被阻断时抛出。"""
    pass


class CircuitBreakerRegistry:
    """管理多个熔断器的注册表。"""

    def __init__(self) -> None:
        self._breakers: dict[str, CircuitBreaker] = {}
        self._lock = asyncio.Lock()

    async def get_or_create(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        success_threshold: int = 2,
    ) -> CircuitBreaker:
        """获取现有熔断器或新建一个。

        Args:
            name: 熔断器标识
            failure_threshold: 打开前的失败次数
            recovery_timeout: 探测恢复前的秒数
            success_threshold: 闭合熔断器所需的成功次数

        Returns:
            CircuitBreaker 实例
        """
        async with self._lock:
            if name not in self._breakers:
                self._breakers[name] = CircuitBreaker(
                    name=name,
                    failure_threshold=failure_threshold,
                    recovery_timeout=recovery_timeout,
                    success_threshold=success_threshold,
                )
            return self._breakers[name]

    def get(self, name: str) -> CircuitBreaker | None:
        """按名称获取熔断器。"""
        return self._breakers.get(name)

    def get_all_stats(self) -> dict[str, CircuitBreakerStats]:
        """获取所有熔断器的统计信息。"""
        return {name: cb.stats for name, cb in self._breakers.items()}

    async def reset_all(self) -> None:
        """重置所有熔断器。"""
        async with self._lock:
            for cb in self._breakers.values():
                cb.reset()


# 全局注册表
_registry = CircuitBreakerRegistry()


def get_circuit_breaker_registry() -> CircuitBreakerRegistry:
    """获取全局熔断器注册表。"""
    return _registry


async def with_circuit_breaker(
    name: str,
    func: Callable[..., Any],
    *args: Any,
    failure_threshold: int = 5,
    recovery_timeout: float = 60.0,
    success_threshold: int = 2,
    **kwargs: Any,
) -> Any:
    """通过熔断器执行函数。

    便捷函数：获取或创建一个熔断器，并通过它执行函数。

    Args:
        name: 熔断器标识
        func: 要执行的异步函数
        *args: 位置参数
        failure_threshold: 打开前的失败次数
        recovery_timeout: 探测恢复前的秒数
        success_threshold: 闭合熔断器所需的成功次数
        **kwargs: 关键字参数

    Returns:
        函数结果

    Raises:
        CircuitBreakerOpenError: 若熔断器处于打开状态
        Exception: 若函数执行失败
    """
    cb = await _registry.get_or_create(
        name=name,
        failure_threshold=failure_threshold,
        recovery_timeout=recovery_timeout,
        success_threshold=success_threshold,
    )
    return await cb.call(func, *args, **kwargs)
