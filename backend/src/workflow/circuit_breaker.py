"""Circuit breaker for workflow dependencies.

Implements circuit breaker pattern to prevent cascading failures when
external dependencies (LLM, tools, databases) fail.
"""

import asyncio
import time
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum
from typing import Any


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation, requests pass through
    OPEN = "open"          # Failed, requests blocked
    HALF_OPEN = "half_open"  # Testing recovery, limited requests


@dataclass
class CircuitBreakerStats:
    """Statistics for a circuit breaker."""
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: float = 0.0
    last_success_time: float = 0.0
    total_requests: int = 0
    blocked_requests: int = 0


class CircuitBreaker:
    """Circuit breaker for protecting against dependency failures.

    Implements the three-state circuit breaker pattern:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Dependency failed, requests blocked immediately
    - HALF_OPEN: Testing recovery, limited requests allowed

    When failures exceed threshold, circuit opens. After timeout,
    enters half-open state to test recovery. Success in half-open
    closes the circuit; failure reopens it.
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        success_threshold: int = 2,
    ):
        """Initialize circuit breaker.

        Args:
            name: Identifier for this circuit breaker
            failure_threshold: Number of failures before opening circuit
            recovery_timeout: Seconds to wait before testing recovery
            success_threshold: Successes needed in half-open to close circuit
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
        """Get current circuit state."""
        return self._state

    @property
    def stats(self) -> CircuitBreakerStats:
        """Get circuit breaker statistics."""
        return CircuitBreakerStats(
            state=self._state,
            failure_count=self._failure_count,
            success_count=self._success_count,
            last_failure_time=self._last_failure_time,
            last_success_time=self._last_success_time,
            total_requests=self._total_requests,
            blocked_requests=self._blocked_requests,
        )

    async def call(self, func: Callable, *args: Any, **kwargs: Any) -> Any:
        """Execute function through circuit breaker.

        Args:
            func: Async function to execute
            *args: Positional arguments
            **kwargs: Keyword arguments

        Returns:
            Function result

        Raises:
            CircuitBreakerOpenError: If circuit is open
            Exception: If function fails
        """
        async with self._lock:
            self._total_requests += 1

            # Check if we should transition from OPEN to HALF_OPEN
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
                    # Any failure in half-open reopens circuit
                    self._state = CircuitState.OPEN
                elif self._state == CircuitState.CLOSED and self._failure_count >= self.failure_threshold:
                    self._state = CircuitState.OPEN

            raise

    def reset(self) -> None:
        """Reset circuit breaker to closed state."""
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time = 0.0
        self._last_success_time = 0.0


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is open and request is blocked."""
    pass


class CircuitBreakerRegistry:
    """Registry managing multiple circuit breakers."""

    def __init__(self):
        self._breakers: dict[str, CircuitBreaker] = {}
        self._lock = asyncio.Lock()

    async def get_or_create(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        success_threshold: int = 2,
    ) -> CircuitBreaker:
        """Get existing circuit breaker or create new one.

        Args:
            name: Circuit breaker identifier
            failure_threshold: Failures before opening
            recovery_timeout: Seconds before testing recovery
            success_threshold: Successes to close circuit

        Returns:
            CircuitBreaker instance
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
        """Get circuit breaker by name."""
        return self._breakers.get(name)

    def get_all_stats(self) -> dict[str, CircuitBreakerStats]:
        """Get statistics for all circuit breakers."""
        return {name: cb.stats for name, cb in self._breakers.items()}

    async def reset_all(self) -> None:
        """Reset all circuit breakers."""
        async with self._lock:
            for cb in self._breakers.values():
                cb.reset()


# Global registry
_registry = CircuitBreakerRegistry()


def get_circuit_breaker_registry() -> CircuitBreakerRegistry:
    """Get global circuit breaker registry."""
    return _registry


async def with_circuit_breaker(
    name: str,
    func: Callable,
    *args: Any,
    failure_threshold: int = 5,
    recovery_timeout: float = 60.0,
    success_threshold: int = 2,
    **kwargs: Any,
) -> Any:
    """Execute function through circuit breaker.

    Convenience function that gets or creates a circuit breaker
    and executes the function through it.

    Args:
        name: Circuit breaker identifier
        func: Async function to execute
        *args: Positional arguments
        failure_threshold: Failures before opening
        recovery_timeout: Seconds before testing recovery
        success_threshold: Successes to close circuit
        **kwargs: Keyword arguments

    Returns:
        Function result

    Raises:
        CircuitBreakerOpenError: If circuit is open
        Exception: If function fails
    """
    cb = await _registry.get_or_create(
        name=name,
        failure_threshold=failure_threshold,
        recovery_timeout=recovery_timeout,
        success_threshold=success_threshold,
    )
    return await cb.call(func, *args, **kwargs)
