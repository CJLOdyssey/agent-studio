"""Tests for workflow/circuit_breaker.py."""

import asyncio
import os
import time
from unittest.mock import patch

import pytest

os.environ.setdefault("AUTH_MODE", "legacy")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("KEY_VAULT_SECRET", "0123456789abcdef0123456789abcdef")
os.environ.setdefault("AUTH_ENABLED", "0")
os.environ.setdefault("RATE_LIMIT", "9999")
os.environ.setdefault("CHECKPOINTER_BACKEND", "memory")
os.environ.setdefault("DATABASE_POOL_SIZE", "0")

from workflow.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerOpenError,
    CircuitBreakerRegistry,
    CircuitBreakerStats,
    CircuitState,
    get_circuit_breaker_registry,
    with_circuit_breaker,
)


# ---------------------------------------------------------------------------
# CircuitState enum
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestCircuitState:
    def test_values(self):
        assert CircuitState.CLOSED.value == "closed"
        assert CircuitState.OPEN.value == "open"
        assert CircuitState.HALF_OPEN.value == "half_open"


# ---------------------------------------------------------------------------
# CircuitBreakerStats dataclass
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestCircuitBreakerStats:
    def test_defaults(self):
        s = CircuitBreakerStats()
        assert s.state == CircuitState.CLOSED
        assert s.failure_count == 0
        assert s.success_count == 0
        assert s.total_requests == 0
        assert s.blocked_requests == 0


# ---------------------------------------------------------------------------
# CircuitBreaker
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestCircuitBreaker:
    def test_init_defaults(self):
        cb = CircuitBreaker("test")
        assert cb.name == "test"
        assert cb.failure_threshold == 5
        assert cb.recovery_timeout == 60.0
        assert cb.success_threshold == 2
        assert cb.state == CircuitState.CLOSED

    def test_init_custom(self):
        cb = CircuitBreaker("c", failure_threshold=3, recovery_timeout=10.0, success_threshold=1)
        assert cb.failure_threshold == 3
        assert cb.recovery_timeout == 10.0
        assert cb.success_threshold == 1

    def test_stats_initial(self):
        cb = CircuitBreaker("s")
        s = cb.stats
        assert s.state == CircuitState.CLOSED
        assert s.failure_count == 0
        assert s.total_requests == 0

    async def test_call_success(self):
        cb = CircuitBreaker("ok")

        async def func():
            return 42

        result = await cb.call(func)
        assert result == 42
        assert cb.state == CircuitState.CLOSED
        assert cb.stats.total_requests == 1
        assert cb.stats.success_count == 1

    async def test_call_resets_failure_count_on_success(self):
        cb = CircuitBreaker("r", failure_threshold=5)

        async def fail_once():
            raise RuntimeError("fail")

        async def succeed():
            return "ok"

        # Accumulate 2 failures
        for _ in range(2):
            with pytest.raises(RuntimeError):
                await cb.call(fail_once)
        assert cb._failure_count == 2

        # Success resets failure count
        await cb.call(succeed)
        assert cb._failure_count == 0

    async def test_call_failure_trips_breaker(self):
        cb = CircuitBreaker("trip", failure_threshold=3)

        async def fail():
            raise RuntimeError("boom")

        for _ in range(3):
            with pytest.raises(RuntimeError):
                await cb.call(fail)

        assert cb.state == CircuitState.OPEN
        assert cb.stats.failure_count == 3

    async def test_call_when_open_rejects(self):
        cb = CircuitBreaker("reject", failure_threshold=1, recovery_timeout=999.0)

        async def fail():
            raise RuntimeError("boom")

        # Trip the breaker
        with pytest.raises(RuntimeError):
            await cb.call(fail)
        assert cb.state == CircuitState.OPEN

        # Now open breaker rejects
        with pytest.raises(CircuitBreakerOpenError, match="is open"):
            await cb.call(fail)
        assert cb.stats.blocked_requests == 1

    async def test_call_half_open_after_recovery(self):
        cb = CircuitBreaker("half", failure_threshold=1, recovery_timeout=0.01, success_threshold=1)

        async def fail():
            raise RuntimeError("boom")

        async def ok():
            return "recovered"

        # Trip
        with pytest.raises(RuntimeError):
            await cb.call(fail)
        assert cb.state == CircuitState.OPEN

        # Wait for recovery
        await asyncio.sleep(0.02)

        # Should transition to HALF_OPEN then succeed → CLOSED
        result = await cb.call(ok)
        assert result == "recovered"
        assert cb.state == CircuitState.CLOSED

    async def test_half_open_failure_reopens(self):
        cb = CircuitBreaker("reopen", failure_threshold=1, recovery_timeout=0.01, success_threshold=2)

        async def fail():
            raise RuntimeError("boom")

        # Trip
        with pytest.raises(RuntimeError):
            await cb.call(fail)
        assert cb.state == CircuitState.OPEN

        await asyncio.sleep(0.02)

        # HALF_OPEN → failure reopens
        with pytest.raises(RuntimeError):
            await cb.call(fail)
        assert cb.state == CircuitState.OPEN

    async def test_half_open_needs_enough_successes(self):
        cb = CircuitBreaker("th", failure_threshold=1, recovery_timeout=0.01, success_threshold=2)

        async def fail():
            raise RuntimeError("boom")

        async def ok():
            return "ok"

        # Trip
        with pytest.raises(RuntimeError):
            await cb.call(fail)

        await asyncio.sleep(0.02)

        # First success in HALF_OPEN — still HALF_OPEN
        await cb.call(ok)
        assert cb.state == CircuitState.HALF_OPEN

        # Second success — transitions to CLOSED
        await cb.call(ok)
        assert cb.state == CircuitState.CLOSED

    def test_reset(self):
        cb = CircuitBreaker("rst", failure_threshold=1)
        cb._state = CircuitState.OPEN
        cb._failure_count = 5
        cb._success_count = 3
        cb._last_failure_time = 999.0
        cb._last_success_time = 888.0

        cb.reset()
        assert cb.state == CircuitState.CLOSED
        s = cb.stats
        assert s.failure_count == 0
        assert s.success_count == 0
        assert s.last_failure_time == 0.0

    async def test_args_forwarded(self):
        cb = CircuitBreaker("args")

        async def add(a, b):
            return a + b

        result = await cb.call(add, 3, 4)
        assert result == 7


# ---------------------------------------------------------------------------
# CircuitBreakerRegistry
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestCircuitBreakerRegistry:
    async def test_get_or_create_new(self):
        reg = CircuitBreakerRegistry()
        cb = await reg.get_or_create("my_cb", failure_threshold=3)
        assert cb.name == "my_cb"
        assert cb.failure_threshold == 3

    async def test_get_or_create_existing(self):
        reg = CircuitBreakerRegistry()
        cb1 = await reg.get_or_create("x")
        cb2 = await reg.get_or_create("x")
        assert cb1 is cb2

    async def test_get_existing(self):
        reg = CircuitBreakerRegistry()
        await reg.get_or_create("y")
        assert reg.get("y") is not None

    async def test_get_nonexistent(self):
        reg = CircuitBreakerRegistry()
        assert reg.get("nope") is None

    async def test_get_all_stats(self):
        reg = CircuitBreakerRegistry()
        await reg.get_or_create("a")
        await reg.get_or_create("b")
        stats = reg.get_all_stats()
        assert "a" in stats
        assert "b" in stats
        assert isinstance(stats["a"], CircuitBreakerStats)

    async def test_reset_all(self):
        reg = CircuitBreakerRegistry()
        cb = await reg.get_or_create("r", failure_threshold=1)
        # Trip it
        async def fail():
            raise RuntimeError("boom")

        with pytest.raises(RuntimeError):
            await cb.call(fail)
        assert cb.state == CircuitState.OPEN

        await reg.reset_all()
        assert cb.state == CircuitState.CLOSED
        assert cb._failure_count == 0


# ---------------------------------------------------------------------------
# get_circuit_breaker_registry (global singleton)
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestGlobalRegistry:
    def test_returns_singleton(self):
        r1 = get_circuit_breaker_registry()
        r2 = get_circuit_breaker_registry()
        assert r1 is r2
        assert isinstance(r1, CircuitBreakerRegistry)


# ---------------------------------------------------------------------------
# with_circuit_breaker helper
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestWithCircuitBreaker:
    async def test_success(self):
        async def func():
            return "ok"

        result = await with_circuit_breaker("helper_ok", func)
        assert result == "ok"

    async def test_failure_propagates(self):
        async def func():
            raise ValueError("bad")

        with pytest.raises(ValueError, match="bad"):
            await with_circuit_breaker("helper_fail", func)

    async def test_reuses_global_registry(self):
        async def func():
            return "shared"

        result = await with_circuit_breaker("shared_cb", func)
        assert result == "shared"
        # Verify it was registered in the global registry
        cb = get_circuit_breaker_registry().get("shared_cb")
        assert cb is not None

    async def test_args_kwargs_forwarded(self):
        async def add(a, b, extra=0):
            return a + b + extra

        result = await with_circuit_breaker("args_cb", add, 1, 2, extra=10)
        assert result == 13
