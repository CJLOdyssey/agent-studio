"""Graceful degradation strategies for workflow execution.

Implements fallback mechanisms to handle failures gracefully without
breaking the entire workflow execution.
"""

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum
from typing import Any


class DegradationLevel(Enum):
    """Degradation levels indicating system health."""
    NORMAL = "normal"           # Full functionality
    DEGRADED = "degraded"       # Some features disabled
    MINIMAL = "minimal"         # Core features only
    FAILSAFE = "failsafe"       # Emergency mode


@dataclass
class FallbackResult:
    """Result from a fallback operation."""
    success: bool
    data: Any
    degradation_level: DegradationLevel
    message: str = ""
    used_fallback: bool = False


class FallbackStrategy:
    """Strategy for executing operations with fallback mechanisms."""

    def __init__(
        self,
        primary: Callable,
        fallbacks: list[Callable] | None = None,
        timeout: float | None = None,
        max_retries: int = 0,
    ):
        """Initialize fallback strategy.

        Args:
            primary: Primary operation to execute
            fallbacks: List of fallback operations (tried in order)
            timeout: Timeout in seconds for each operation
            max_retries: Number of retries before trying fallback
        """
        self.primary = primary
        self.fallbacks = fallbacks or []
        self.timeout = timeout
        self.max_retries = max_retries

    async def execute(self, *args: Any, **kwargs: Any) -> FallbackResult:
        """Execute with fallback strategy.

        Tries primary operation first, then fallbacks in order.
        Each operation is retried up to max_retries times.

        Args:
            *args: Positional arguments for the operation
            **kwargs: Keyword arguments for the operation

        Returns:
            FallbackResult with execution outcome
        """
        # Try primary operation with retries
        for attempt in range(self.max_retries + 1):
            try:
                if self.timeout:
                    result = await asyncio.wait_for(
                        self.primary(*args, **kwargs),
                        timeout=self.timeout
                    )
                else:
                    result = await self.primary(*args, **kwargs)

                return FallbackResult(
                    success=True,
                    data=result,
                    degradation_level=DegradationLevel.NORMAL,
                    message="Primary operation succeeded",
                    used_fallback=False
                )
            except TimeoutError:
                if attempt < self.max_retries:
                    continue
                # Primary failed after all retries, try fallbacks
                break
            except Exception:
                if attempt < self.max_retries:
                    continue
                # Primary failed after all retries, try fallbacks
                break

        # Try fallback operations in order
        for idx, fallback in enumerate(self.fallbacks):
            try:
                if self.timeout:
                    result = await asyncio.wait_for(
                        fallback(*args, **kwargs),
                        timeout=self.timeout
                    )
                else:
                    result = await fallback(*args, **kwargs)

                # Determine degradation level based on fallback index
                if idx == 0:
                    level = DegradationLevel.DEGRADED
                elif idx == 1:
                    level = DegradationLevel.MINIMAL
                else:
                    level = DegradationLevel.FAILSAFE

                return FallbackResult(
                    success=True,
                    data=result,
                    degradation_level=level,
                    message=f"Fallback {idx + 1} succeeded",
                    used_fallback=True
                )
            except Exception:
                # This fallback failed, try next one
                continue

        # All operations failed
        return FallbackResult(
            success=False,
            data=None,
            degradation_level=DegradationLevel.FAILSAFE,
            message="All operations failed",
            used_fallback=True
        )


class WorkflowTimeoutController:
    """Controls workflow-level timeouts and enforces time limits."""

    def __init__(
        self,
        total_timeout: float | None = None,
        node_timeout: float | None = None,
        warning_threshold: float = 0.8,
    ):
        """Initialize timeout controller.

        Args:
            total_timeout: Total workflow timeout in seconds
            node_timeout: Per-node timeout in seconds
            warning_threshold: Fraction of timeout to trigger warning (0.0-1.0)
        """
        self.total_timeout = total_timeout
        self.node_timeout = node_timeout
        self.warning_threshold = warning_threshold
        self._start_time: float | None = None
        self._warnings_issued: list[str] = []

    def start(self) -> None:
        """Mark workflow start time."""
        import time
        self._start_time = time.time()

    def check_remaining_time(self) -> float | None:
        """Check remaining time before total timeout.

        Returns:
            Remaining seconds, or None if no timeout set
        """
        if not self.total_timeout or not self._start_time:
            return None

        import time
        elapsed = time.time() - self._start_time
        remaining = self.total_timeout - elapsed
        return max(0.0, remaining)

    def should_warn(self, node_id: str) -> bool:
        """Check if we should issue a timeout warning for a node.

        Args:
            node_id: Identifier of the node

        Returns:
            True if warning should be issued
        """
        remaining = self.check_remaining_time()
        if remaining is None:
            return False

        # Warn if we've used more than warning_threshold of total time
        elapsed = self.total_timeout - remaining
        threshold_time = self.total_timeout * self.warning_threshold

        if elapsed >= threshold_time and node_id not in self._warnings_issued:
            self._warnings_issued.append(node_id)
            return True

        return False

    async def execute_with_timeout(
        self,
        operation: Callable,
        *args: Any,
        node_id: str = "unknown",
        **kwargs: Any
    ) -> Any:
        """Execute operation with timeout control.

        Args:
            operation: Async operation to execute
            *args: Positional arguments
            node_id: Identifier of the node (for warnings)
            **kwargs: Keyword arguments

        Returns:
            Operation result

        Raises:
            asyncio.TimeoutError: If operation exceeds timeout
        """
        # Check if we should warn about approaching timeout
        if self.should_warn(node_id):
            import logging
            logger = logging.getLogger(__name__)
            remaining = self.check_remaining_time()
            logger.warning(
                f"Node {node_id}: Workflow approaching timeout "
                f"({remaining:.1f}s remaining)"
            )

        # Determine effective timeout
        effective_timeout = self.node_timeout
        remaining = self.check_remaining_time()
        if remaining is not None:
            effective_timeout = remaining if effective_timeout is None else min(effective_timeout, remaining)

        # Execute with timeout
        if effective_timeout:
            return await asyncio.wait_for(
                operation(*args, **kwargs),
                timeout=effective_timeout
            )
        else:
            return await operation(*args, **kwargs)


class GracefulDegradationManager:
    """Manages graceful degradation across workflow execution."""

    def __init__(
        self,
        timeout_controller: WorkflowTimeoutController | None = None,
        enable_fallback: bool = True,
    ):
        """Initialize degradation manager.

        Args:
            timeout_controller: Timeout controller for workflow
            enable_fallback: Whether to enable fallback mechanisms
        """
        self.timeout_controller = timeout_controller
        self.enable_fallback = enable_fallback
        self._current_level = DegradationLevel.NORMAL
        self._degradation_events: list[dict[str, Any]] = []

    @property
    def current_level(self) -> DegradationLevel:
        """Get current degradation level."""
        return self._current_level

    def record_degradation(self, level: DegradationLevel, reason: str) -> None:
        """Record a degradation event.

        Args:
            level: Degradation level that occurred
            reason: Reason for degradation
        """
        import time
        self._degradation_events.append({
            "timestamp": time.time(),
            "level": level.value,
            "reason": reason,
        })

        # Update current level to worst seen
        level_priority = {
            DegradationLevel.NORMAL: 0,
            DegradationLevel.DEGRADED: 1,
            DegradationLevel.MINIMAL: 2,
            DegradationLevel.FAILSAFE: 3,
        }
        if level_priority[level] > level_priority[self._current_level]:
            self._current_level = level

    def get_degradation_history(self) -> list[dict[str, Any]]:
        """Get history of degradation events."""
        return self._degradation_events.copy()

    async def execute_with_degradation(
        self,
        operation: Callable,
        *args: Any,
        node_id: str = "unknown",
        fallbacks: list[Callable] | None = None,
        **kwargs: Any
    ) -> FallbackResult:
        """Execute operation with graceful degradation.

        Combines timeout control and fallback mechanisms.

        Args:
            operation: Primary async operation
            *args: Positional arguments
            node_id: Node identifier
            fallbacks: List of fallback operations
            **kwargs: Keyword arguments

        Returns:
            FallbackResult with execution outcome
        """
        # Wrap operation with timeout if controller is available
        if self.timeout_controller:
            async def timed_operation(*a: Any, **kw: Any) -> Any:
                return await self.timeout_controller.execute_with_timeout(
                    operation, *a, node_id=node_id, **kw
                )
        else:
            timed_operation = operation

        # Execute with fallback strategy
        if self.enable_fallback and fallbacks:
            strategy = FallbackStrategy(
                primary=timed_operation,
                fallbacks=fallbacks,
                timeout=self.timeout_controller.node_timeout if self.timeout_controller else None,
                max_retries=1
            )
            result = await strategy.execute(*args, **kwargs)

            # Record degradation if fallback was used
            if result.used_fallback:
                self.record_degradation(
                    result.degradation_level,
                    f"Node {node_id}: {result.message}"
                )

            return result
        else:
            # No fallback, just execute with timeout
            try:
                if self.timeout_controller:
                    result_data = await self.timeout_controller.execute_with_timeout(
                        operation, *args, node_id=node_id, **kwargs
                    )
                else:
                    result_data = await operation(*args, **kwargs)

                return FallbackResult(
                    success=True,
                    data=result_data,
                    degradation_level=DegradationLevel.NORMAL,
                    message="Operation succeeded",
                    used_fallback=False
                )
            except TimeoutError:
                self.record_degradation(
                    DegradationLevel.MINIMAL,
                    f"Node {node_id}: Operation timed out"
                )
                return FallbackResult(
                    success=False,
                    data=None,
                    degradation_level=DegradationLevel.MINIMAL,
                    message="Operation timed out",
                    used_fallback=False
                )
            except Exception as e:
                self.record_degradation(
                    DegradationLevel.DEGRADED,
                    f"Node {node_id}: {str(e)}"
                )
                return FallbackResult(
                    success=False,
                    data=None,
                    degradation_level=DegradationLevel.DEGRADED,
                    message=f"Operation failed: {str(e)}",
                    used_fallback=False
                )
