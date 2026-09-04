"""用于保护下游服务调用（LLM、Celery 等）的异步熔断器。

简单的三态机：closed → open → half-open → closed。
在内存中跟踪连续失败次数；无外部依赖。
"""

from __future__ import annotations

import asyncio
import time
from enum import Enum
from typing import Any


class State(Enum):
    CLOSED = "closed"          # 正常工作
    OPEN = "open"              # 拒绝所有调用
    HALF_OPEN = "half_open"    # 放行一次试探调用


class CircuitBreakerOpenError(Exception):
    """当调用因熔断器打开而被拒绝时抛出。"""


class CircuitBreaker:
    """带可配置阈值的异步熔断器。

    用法::

        llm_cb = CircuitBreaker(name="llm_api", maxfail=5, reset_timeout=30)

        async with llm_cb:
            result = await call_llm_api()

    连续 `maxfail` 次失败后熔断器打开。
    OPEN 状态经过 `reset_timeout` 秒后转为 HALF_OPEN。
    HALF_OPEN 下一次成功调用转回 CLOSED。
    HALF_OPEN 下任何失败都会重新打开熔断器。
    """

    def __init__(
        self,
        name: str,
        maxfail: int = 5,
        reset_timeout: float = 60.0,
        half_open_max_calls: int = 1,
    ) -> None:
        self.name = name
        self.maxfail = maxfail
        self.reset_timeout = reset_timeout
        self.half_open_max_calls = half_open_max_calls

        self._state = State.CLOSED
        self._failures: int = 0
        self._last_failure: float = 0.0
        self._opened_at: float = 0.0
        self._half_open_calls: int = 0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> State:
        return self._state

    @property
    def failures(self) -> int:
        return self._failures

    async def _transition(self) -> None:
        """根据当前状态与已流逝时间评估状态迁移。

        当熔断器应拒绝调用（如 half-open 配额耗尽）时抛出 CircuitBreakerOpenError。
        """
        now = time.time()

        if self._state == State.OPEN:
            if now - self._opened_at >= self.reset_timeout:
                self._state = State.HALF_OPEN
                self._half_open_calls = 0

        elif self._state == State.HALF_OPEN and self._half_open_calls >= self.half_open_max_calls:
            raise CircuitBreakerOpenError(
                f"Circuit '{self.name}' is HALF_OPEN — "
                f"{self._half_open_calls} test calls already in flight"
            )

    async def _on_success(self) -> None:
        """记录一次成功调用。"""
        async with self._lock:
            if self._state == State.HALF_OPEN:
                self._state = State.CLOSED
                self._failures = 0
                self._half_open_calls = 0
            elif self._state == State.CLOSED:
                self._failures = 0

    async def _on_failure(self) -> None:
        """记录一次失败调用。"""
        async with self._lock:
            now = time.time()
            self._failures += 1
            self._last_failure = now

            if self._state == State.HALF_OPEN or self._state == State.CLOSED and self._failures >= self.maxfail:
                self._state = State.OPEN
                self._opened_at = now

    async def _acquire(self) -> None:
        """尝试获取发起调用的许可；被拒绝时抛出 CircuitBreakerOpenError。"""
        async with self._lock:
            await self._transition()

            if self._state == State.OPEN:
                elapsed = time.time() - self._opened_at
                remaining = max(0.0, self.reset_timeout - elapsed)
                raise CircuitBreakerOpenError(
                    f"Circuit '{self.name}' is OPEN — {self._failures} failures, "
                    f"retry in {remaining:.0f}s"
                )

            if self._state == State.HALF_OPEN:
                self._half_open_calls += 1

    def __call__(self, func: Any) -> Any:
        """用熔断器保护包装异步可调用对象的装饰器。

        用法::

            cb = CircuitBreaker(name="llm", maxfail=5, reset_timeout=30)

            @cb
            async def call_llm(prompt: str) -> str:
                return await api.chat(prompt)

        抛出：
            CircuitBreakerOpenError：熔断器打开、调用被拒绝时。
        """
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            await self._acquire()
            try:
                result = await func(*args, **kwargs)
            except CircuitBreakerOpenError:
                raise
            except Exception:
                await self._on_failure()
                raise
            else:
                await self._on_success()
            return result

        return wrapper

    def status(self) -> dict[str, Any]:
        """返回当前状态，供监控/调试端点使用。"""
        return {
            "name": self.name,
            "state": self._state.value,
            "failures": self._failures,
            "maxfail": self.maxfail,
            "reset_timeout": self.reset_timeout,
            "last_failure": self._last_failure,
        }


# ── 共享熔断器 ──────────────────────────────────────────────────

# LLM API 熔断器 —— 在 LLM 提供商宕机或返回错误时防止级联失败。
# 所有图引擎共享。可通过环境变量配置：LLM_CB_MAXFAIL（默认 5）、LLM_CB_RESET（默认 60s）。
import os as _os

_llm_maxfail = int(_os.environ.get("LLM_CB_MAXFAIL", "5"))
_llm_reset = float(_os.environ.get("LLM_CB_RESET", "60"))

llm_circuit = CircuitBreaker(
    name="llm_api",
    maxfail=_llm_maxfail,
    reset_timeout=_llm_reset,
)
