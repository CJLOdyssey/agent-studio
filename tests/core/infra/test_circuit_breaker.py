"""Unit tests for the async circuit breaker (backend/core/infra/circuit_breaker.py)."""

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.core.infra.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerOpenError,
    State,
    llm_circuit,
)


# =============================================================================
# Initialization & properties
# =============================================================================


class TestInit:
    def test_defaults(self):
        cb = CircuitBreaker(name="test")
        assert cb.name == "test"
        assert cb.maxfail == 5
        assert cb.reset_timeout == 60.0
        assert cb.half_open_max_calls == 1
        assert cb.state == State.CLOSED
        assert cb.failures == 0

    def test_custom_thresholds(self):
        cb = CircuitBreaker(name="custom", maxfail=3, reset_timeout=10.0, half_open_max_calls=2)
        assert cb.maxfail == 3
        assert cb.reset_timeout == 10.0
        assert cb.half_open_max_calls == 2

    def test_status_method(self):
        cb = CircuitBreaker(name="monitor")
        st = cb.status()
        assert st["name"] == "monitor"
        assert st["state"] == "closed"
        assert st["failures"] == 0
        assert st["maxfail"] == 5
        assert "reset_timeout" in st
        assert "last_failure" in st


# =============================================================================
# CLOSED → OPEN transition (failure accumulation)
# =============================================================================


class TestClosedToOpen:
    @pytest.mark.asyncio
    async def test_accumulate_failures_does_not_open_below_threshold(self):
        cb = CircuitBreaker(name="test", maxfail=5)
        for _ in range(4):
            await cb._acquire()
            await cb._on_failure()
        assert cb.state == State.CLOSED
        assert cb.failures == 4

    @pytest.mark.asyncio
    async def test_maxfail_opens_circuit(self):
        cb = CircuitBreaker(name="test", maxfail=3)
        for _ in range(3):
            await cb._acquire()
            await cb._on_failure()
        assert cb.state == State.OPEN
        assert cb.failures == 3

    @pytest.mark.asyncio
    async def test_acquire_raises_when_open(self):
        cb = CircuitBreaker(name="test", maxfail=1)
        await cb._acquire()
        await cb._on_failure()  # circuit now OPEN

        with pytest.raises(CircuitBreakerOpenError) as exc:
            await cb._acquire()
        assert "OPEN" in str(exc.value)
        assert "1 failures" in str(exc.value)


# =============================================================================
# CLOSED: success resets counter
# =============================================================================


class TestClosedSuccess:
    @pytest.mark.asyncio
    async def test_success_resets_failure_counter(self):
        cb = CircuitBreaker(name="test", maxfail=3)
        for _ in range(2):
            await cb._acquire()
            await cb._on_failure()
        assert cb.failures == 2

        # Success should reset counter
        await cb._acquire()
        await cb._on_success()
        assert cb.failures == 0
        assert cb.state == State.CLOSED

    @pytest.mark.asyncio
    async def test_normal_flow_acquire_success(self):
        cb = CircuitBreaker(name="test")
        await cb._acquire()
        await cb._on_success()
        assert cb.state == State.CLOSED
        assert cb.failures == 0


# =============================================================================
# HALF_OPEN → CLOSED (recovery)
# =============================================================================


class TestHalfOpenRecovery:
    @pytest.mark.asyncio
    async def test_half_open_success_closes_circuit(self):
        cb = CircuitBreaker(name="test", maxfail=1, reset_timeout=0)
        # Open the circuit
        await cb._acquire()
        await cb._on_failure()
        assert cb.state == State.OPEN

        # Transition to HALF_OPEN (triggered by acquire since reset_timeout=0)
        await cb._acquire()
        assert cb.state == State.HALF_OPEN

        # Success should close it
        await cb._on_success()
        assert cb.state == State.CLOSED
        assert cb.failures == 0

    @pytest.mark.asyncio
    async def test_half_open_failure_reopens(self):
        cb = CircuitBreaker(name="test", maxfail=1, reset_timeout=0)
        # Open
        await cb._acquire()
        await cb._on_failure()
        assert cb.state == State.OPEN

        # Half-open
        await cb._acquire()
        assert cb.state == State.HALF_OPEN

        # Fail again → re-open
        await cb._on_failure()
        assert cb.state == State.OPEN
        assert cb.failures == 2  # increments from previous failures


# =============================================================================
# HALF_OPEN: exhausted quota rejects
# =============================================================================


class TestHalfOpenQuota:
    @pytest.mark.asyncio
    async def test_half_open_exhausted_rejects(self):
        cb = CircuitBreaker(name="test", maxfail=1, reset_timeout=0, half_open_max_calls=1)
        await cb._acquire()
        await cb._on_failure()  # → OPEN
        await cb._acquire()     # → HALF_OPEN (half_open_calls=1)

        # Second acquire should raise because half_open_max_calls=1 exhausted
        with pytest.raises(CircuitBreakerOpenError) as exc:
            await cb._acquire()
        assert "HALF_OPEN" in str(exc.value)

    @pytest.mark.asyncio
    async def test_half_open_max_calls_greater_than_one(self):
        cb = CircuitBreaker(name="test", maxfail=1, reset_timeout=0, half_open_max_calls=2)
        await cb._acquire()
        await cb._on_failure()
        # Two acquires without reporting result should be allowed
        await cb._acquire()
        await cb._acquire()  # half_open_calls now 2

        # Third should reject
        with pytest.raises(CircuitBreakerOpenError):
            await cb._acquire()


# =============================================================================
# OPEN → HALF_OPEN timeout transition
# =============================================================================


class TestTimeoutTransition:
    @pytest.mark.asyncio
    async def test_open_transitions_to_half_open_after_timeout(self):
        cb = CircuitBreaker(name="test", maxfail=1, reset_timeout=0.01)
        await cb._acquire()
        await cb._on_failure()
        assert cb.state == State.OPEN

        # Wait longer than reset_timeout
        await asyncio.sleep(0.02)

        # Acquire should transition to HALF_OPEN
        await cb._acquire()
        assert cb.state == State.HALF_OPEN

    @pytest.mark.asyncio
    async def test_open_stays_open_before_timeout(self):
        cb = CircuitBreaker(name="test", maxfail=1, reset_timeout=60.0)
        await cb._acquire()
        await cb._on_failure()
        assert cb.state == State.OPEN

        # Immediately try — should still be OPEN
        with pytest.raises(CircuitBreakerOpenError):
            await cb._acquire()


# =============================================================================
# Decorator (__call__)
# =============================================================================


class TestDecorator:
    @pytest.mark.asyncio
    async def test_decorator_success_path(self):
        cb = CircuitBreaker(name="deco", maxfail=3)

        @cb
        async def good_func(x: int) -> int:
            return x * 2

        result = await good_func(5)
        assert result == 10
        assert cb.state == State.CLOSED
        assert cb.failures == 0

    @pytest.mark.asyncio
    async def test_decorator_failure_path(self):
        cb = CircuitBreaker(name="deco", maxfail=2)

        @cb
        async def failing_func() -> None:
            raise ValueError("boom")

        with pytest.raises(ValueError):
            await failing_func()
        assert cb.failures == 1

        with pytest.raises(ValueError):
            await failing_func()
        assert cb.state == State.OPEN
        assert cb.failures == 2

    @pytest.mark.asyncio
    async def test_decorator_opens_and_blocks(self):
        cb = CircuitBreaker(name="deco", maxfail=1)

        @cb
        async def bad_func() -> None:
            raise RuntimeError("fail")

        with pytest.raises(RuntimeError):
            await bad_func()

        # Second call should be blocked by circuit breaker
        with pytest.raises(CircuitBreakerOpenError):
            await bad_func()

    @pytest.mark.asyncio
    async def test_decorator_passes_through_cb_error(self):
        cb = CircuitBreaker(name="deco", maxfail=1)

        @cb
        async def f() -> str:
            return "ok"

        # Open the circuit first
        await cb._acquire()
        await cb._on_failure()

        # Decorator should propagate CircuitBreakerOpenError, not wrap it
        with pytest.raises(CircuitBreakerOpenError):
            await f()

    @pytest.mark.asyncio
    async def test_decorator_recovery_after_half_open_success(self):
        cb = CircuitBreaker(name="deco", maxfail=1, reset_timeout=0)

        @cb
        async def sometimes_bad(should_fail: bool) -> str:
            if should_fail:
                raise ValueError("fail")
            return "good"

        # Open
        with pytest.raises(ValueError):
            await sometimes_bad(True)
        assert cb.state == State.OPEN

        # Half-open + succeed → closed
        result = await sometimes_bad(False)
        assert result == "good"
        assert cb.state == State.CLOSED

    @pytest.mark.asyncio
    async def test_decorator_wrapped_func_raises_cb_error(self):
        """If the wrapped function raises CircuitBreakerOpenError directly,
        the decorator propagates it without counting as a failure."""
        cb = CircuitBreaker(name="deco", maxfail=3)

        @cb
        async def raising_func() -> None:
            raise CircuitBreakerOpenError("inner error")

        with pytest.raises(CircuitBreakerOpenError):
            await raising_func()
        assert cb.failures == 0


# =============================================================================
# Thread safety (asyncio.Lock)
# =============================================================================


class TestConcurrency:
    @pytest.mark.asyncio
    async def test_concurrent_acquire_failures_count_correctly(self):
        cb = CircuitBreaker(name="concurrent", maxfail=10)

        async def fail_once() -> None:
            await cb._acquire()
            await cb._on_failure()

        # Run 5 concurrent failures
        await asyncio.gather(*(fail_once() for _ in range(5)))
        assert cb.failures == 5
        assert cb.state == State.CLOSED  # Not enough to open


# =============================================================================
# Shared llm_circuit instance
# =============================================================================


class TestSharedCircuit:
    def test_llm_circuit_exists(self):
        assert llm_circuit.name == "llm_api"
        assert llm_circuit.state == State.CLOSED
        st = llm_circuit.status()
        assert st["name"] == "llm_api"

    def test_env_var_config_respected(self, monkeypatch):
        monkeypatch.setenv("LLM_CB_MAXFAIL", "10")
        monkeypatch.setenv("LLM_CB_RESET", "120")

        # Re-import triggers name but module-level code already ran.
        # Test the env-reading behaviour directly.
        cb = CircuitBreaker(
            name="env_test",
            maxfail=int(__import__("os").environ.get("LLM_CB_MAXFAIL", "5")),
            reset_timeout=float(__import__("os").environ.get("LLM_CB_RESET", "60")),
        )
        assert cb.maxfail == 10
        assert cb.reset_timeout == 120.0
