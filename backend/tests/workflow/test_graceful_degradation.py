"""Tests for workflow/graceful_degradation.py."""

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

from workflow.graceful_degradation import (
    DegradationLevel,
    FallbackResult,
    FallbackStrategy,
    GracefulDegradationManager,
    WorkflowTimeoutController,
)


# ---------------------------------------------------------------------------
# FallbackResult dataclass
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestFallbackResult:
    def test_defaults(self):
        r = FallbackResult(success=True, data="ok", degradation_level=DegradationLevel.NORMAL)
        assert r.success is True
        assert r.data == "ok"
        assert r.degradation_level == DegradationLevel.NORMAL
        assert r.message == ""
        assert r.used_fallback is False

    def test_with_all_fields(self):
        r = FallbackResult(
            success=False,
            data=None,
            degradation_level=DegradationLevel.FAILSAFE,
            message="boom",
            used_fallback=True,
        )
        assert r.success is False
        assert r.used_fallback is True
        assert r.message == "boom"


# ---------------------------------------------------------------------------
# DegradationLevel enum
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestDegradationLevel:
    def test_values(self):
        assert DegradationLevel.NORMAL.value == "normal"
        assert DegradationLevel.DEGRADED.value == "degraded"
        assert DegradationLevel.MINIMAL.value == "minimal"
        assert DegradationLevel.FAILSAFE.value == "failsafe"


# ---------------------------------------------------------------------------
# FallbackStrategy
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestFallbackStrategy:
    async def test_primary_success(self):
        async def primary():
            return "primary-ok"

        strategy = FallbackStrategy(primary=primary, fallbacks=[])
        result = await strategy.execute()
        assert result.success is True
        assert result.data == "primary-ok"
        assert result.used_fallback is False
        assert result.degradation_level == DegradationLevel.NORMAL

    async def test_primary_fails_first_fallback_succeeds(self):
        async def primary():
            raise RuntimeError("primary down")

        async def fallback1():
            return "fallback1-ok"

        strategy = FallbackStrategy(primary=primary, fallbacks=[fallback1])
        result = await strategy.execute()
        assert result.success is True
        assert result.data == "fallback1-ok"
        assert result.used_fallback is True
        assert result.degradation_level == DegradationLevel.DEGRADED

    async def test_primary_fails_second_fallback_succeeds(self):
        async def primary():
            raise RuntimeError("primary down")

        async def fallback1():
            raise RuntimeError("fallback1 down")

        async def fallback2():
            return "fallback2-ok"

        strategy = FallbackStrategy(primary=primary, fallbacks=[fallback1, fallback2])
        result = await strategy.execute()
        assert result.success is True
        assert result.data == "fallback2-ok"
        assert result.used_fallback is True
        assert result.degradation_level == DegradationLevel.MINIMAL

    async def test_all_operations_fail(self):
        async def primary():
            raise RuntimeError("primary down")

        async def fallback1():
            raise RuntimeError("f1 down")

        async def fallback2():
            raise RuntimeError("f2 down")

        strategy = FallbackStrategy(primary=primary, fallbacks=[fallback1, fallback2])
        result = await strategy.execute()
        assert result.success is False
        assert result.data is None
        assert result.used_fallback is True
        assert result.degradation_level == DegradationLevel.FAILSAFE
        assert "All operations failed" in result.message

    async def test_fallback3_or_beyond_gets_failsafe_level(self):
        async def primary():
            raise RuntimeError("down")

        async def fb_fail():
            raise RuntimeError("fail")

        async def fb_ok():
            return "ok"

        # First two fallbacks fail, third succeeds → idx=2 → FAILSAFE
        fallbacks = [fb_fail, fb_fail, fb_ok]
        strategy = FallbackStrategy(primary=primary, fallbacks=fallbacks)
        result = await strategy.execute()
        assert result.success is True
        assert result.degradation_level == DegradationLevel.FAILSAFE

    async def test_max_retries_retries_before_fallback(self):
        attempt_counter = 0

        async def primary():
            nonlocal attempt_counter
            attempt_counter += 1
            if attempt_counter < 3:
                raise RuntimeError("not yet")
            return "recovered"

        strategy = FallbackStrategy(primary=primary, fallbacks=[], max_retries=2)
        result = await strategy.execute()
        assert result.success is True
        assert result.data == "recovered"
        assert attempt_counter == 3

    async def test_max_retries_exhausted_tries_fallback(self):
        async def primary():
            raise RuntimeError("always fail")

        async def fallback1():
            return "fallback-ok"

        strategy = FallbackStrategy(primary=primary, fallbacks=[fallback1], max_retries=1)
        result = await strategy.execute()
        assert result.success is True
        assert result.data == "fallback-ok"

    async def test_timeout_on_primary(self):
        import asyncio

        async def slow_primary():
            await asyncio.sleep(10)
            return "never"

        strategy = FallbackStrategy(primary=slow_primary, fallbacks=[], timeout=0.05)
        result = await strategy.execute()
        assert result.success is False

    async def test_args_kwargs_forwarded(self):
        received = {}

        async def primary(a, b, extra=None):
            received["a"] = a
            received["b"] = b
            received["extra"] = extra
            return "ok"

        strategy = FallbackStrategy(primary=primary, fallbacks=[])
        await strategy.execute(1, 2, extra="x")
        assert received == {"a": 1, "b": 2, "extra": "x"}

    async def test_no_fallbacks_with_primary_success(self):
        async def primary():
            return "ok"

        strategy = FallbackStrategy(primary=primary)
        result = await strategy.execute()
        assert result.success is True

    async def test_timeout_on_fallback(self):
        import asyncio

        async def primary():
            raise RuntimeError("fail")

        async def slow_fallback():
            await asyncio.sleep(10)
            return "never"

        strategy = FallbackStrategy(primary=primary, fallbacks=[slow_fallback], timeout=0.05)
        result = await strategy.execute()
        assert result.success is False


# ---------------------------------------------------------------------------
# WorkflowTimeoutController
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestWorkflowTimeoutController:
    def test_init_defaults(self):
        c = WorkflowTimeoutController()
        assert c.total_timeout is None
        assert c.node_timeout is None
        assert c.warning_threshold == 0.8

    def test_init_custom(self):
        c = WorkflowTimeoutController(total_timeout=10.0, node_timeout=5.0, warning_threshold=0.5)
        assert c.total_timeout == 10.0
        assert c.node_timeout == 5.0
        assert c.warning_threshold == 0.5

    def test_check_remaining_time_no_timeout(self):
        c = WorkflowTimeoutController()
        c.start()
        assert c.check_remaining_time() is None

    def test_check_remaining_time_no_start(self):
        c = WorkflowTimeoutController(total_timeout=10.0)
        assert c.check_remaining_time() is None

    def test_should_warn_no_timeout(self):
        c = WorkflowTimeoutController()
        c.start()
        assert c.should_warn("node1") is False

    async def test_execute_with_timeout_no_timeout(self):
        c = WorkflowTimeoutController()

        async def op():
            return 42

        result = await c.execute_with_timeout(op, node_id="n1")
        assert result == 42

    async def test_execute_with_timeout_exceeded(self):
        import asyncio

        c = WorkflowTimeoutController(node_timeout=0.05)

        async def slow():
            await asyncio.sleep(10)

        with pytest.raises(asyncio.TimeoutError):
            await c.execute_with_timeout(slow, node_id="n1")

    async def test_execute_with_total_timeout(self):
        import asyncio

        c = WorkflowTimeoutController(total_timeout=0.05)
        c.start()

        async def slow():
            await asyncio.sleep(10)

        with pytest.raises(asyncio.TimeoutError):
            await c.execute_with_timeout(slow, node_id="n1")


# ---------------------------------------------------------------------------
# GracefulDegradationManager
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestGracefulDegradationManager:
    def test_init_defaults(self):
        mgr = GracefulDegradationManager()
        assert mgr.current_level == DegradationLevel.NORMAL
        assert mgr.enable_fallback is True
        assert mgr.timeout_controller is None

    def test_record_degradation_updates_level(self):
        mgr = GracefulDegradationManager()
        mgr.record_degradation(DegradationLevel.DEGRADED, "test")
        assert mgr.current_level == DegradationLevel.DEGRADED

    def test_record_degradation_worst_level_wins(self):
        mgr = GracefulDegradationManager()
        mgr.record_degradation(DegradationLevel.DEGRADED, "d1")
        mgr.record_degradation(DegradationLevel.MINIMAL, "m1")
        assert mgr.current_level == DegradationLevel.MINIMAL

    def test_record_degradation_lower_does_not_downgrade(self):
        mgr = GracefulDegradationManager()
        mgr.record_degradation(DegradationLevel.MINIMAL, "m1")
        mgr.record_degradation(DegradationLevel.DEGRADED, "d1")
        assert mgr.current_level == DegradationLevel.MINIMAL

    def test_get_degradation_history(self):
        mgr = GracefulDegradationManager()
        mgr.record_degradation(DegradationLevel.DEGRADED, "reason1")
        history = mgr.get_degradation_history()
        assert len(history) == 1
        assert history[0]["level"] == "degraded"
        assert history[0]["reason"] == "reason1"
        assert "timestamp" in history[0]

    def test_get_degradation_history_returns_copy(self):
        mgr = GracefulDegradationManager()
        mgr.record_degradation(DegradationLevel.DEGRADED, "r1")
        history = mgr.get_degradation_history()
        history.clear()
        assert len(mgr.get_degradation_history()) == 1

    async def test_execute_with_degradation_success_no_fallbacks(self):
        mgr = GracefulDegradationManager()

        async def op():
            return "ok"

        result = await mgr.execute_with_degradation(op, node_id="n1")
        assert result.success is True
        assert result.data == "ok"
        assert result.used_fallback is False

    async def test_execute_with_degradation_no_fallback_exception(self):
        mgr = GracefulDegradationManager()

        async def op():
            raise RuntimeError("boom")

        result = await mgr.execute_with_degradation(op, node_id="n1")
        assert result.success is False
        assert result.used_fallback is False
        assert mgr.current_level == DegradationLevel.DEGRADED

    async def test_execute_with_degradation_with_fallbacks_success(self):
        mgr = GracefulDegradationManager()

        async def op():
            return "primary-ok"

        async def fb():
            return "fallback-ok"

        result = await mgr.execute_with_degradation(op, node_id="n1", fallbacks=[fb])
        assert result.success is True
        assert result.data == "primary-ok"
        assert result.used_fallback is False

    async def test_execute_with_degradation_with_fallbacks_fallback_used(self):
        mgr = GracefulDegradationManager()

        async def op():
            raise RuntimeError("fail")

        async def fb():
            return "fallback-ok"

        result = await mgr.execute_with_degradation(op, node_id="n1", fallbacks=[fb])
        assert result.success is True
        assert result.data == "fallback-ok"
        assert result.used_fallback is True
        assert len(mgr.get_degradation_history()) == 1

    async def test_execute_with_degradation_all_fail(self):
        mgr = GracefulDegradationManager()

        async def op():
            raise RuntimeError("fail")

        async def fb():
            raise RuntimeError("fb-fail")

        result = await mgr.execute_with_degradation(op, node_id="n1", fallbacks=[fb])
        assert result.success is False

    async def test_execute_with_degradation_with_timeout_controller(self):
        tc = WorkflowTimeoutController(node_timeout=1.0)
        mgr = GracefulDegradationManager(timeout_controller=tc)

        async def op():
            return "timed-ok"

        result = await mgr.execute_with_degradation(op, node_id="n1")
        assert result.success is True
        assert result.data == "timed-ok"

    async def test_execute_with_degradation_fallback_disabled(self):
        mgr = GracefulDegradationManager(enable_fallback=False)

        async def op():
            return "ok"

        async def fb():
            return "fb"

        result = await mgr.execute_with_degradation(op, node_id="n1", fallbacks=[fb])
        assert result.success is True
        assert result.used_fallback is False
