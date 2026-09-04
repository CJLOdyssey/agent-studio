"""工作流执行的优雅降级策略。

实现回退机制，在不中断整个工作流执行的前提下优雅地处理故障。
"""

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum
from typing import Any


class DegradationLevel(Enum):
    """指示系统健康状况的降级级别。"""

    NORMAL = "normal"  # 功能完整
    DEGRADED = "degraded"  # 部分功能被禁用
    MINIMAL = "minimal"  # 仅核心功能
    FAILSAFE = "failsafe"  # 应急模式


@dataclass
class FallbackResult:
    """回退操作的结果。"""

    success: bool
    data: Any
    degradation_level: DegradationLevel
    message: str = ""
    used_fallback: bool = False


class FallbackStrategy:
    """带回退机制执行操作的策略。"""

    def __init__(
        self,
        primary: Callable[..., Any],
        fallbacks: list[Callable[..., Any]] | None = None,
        timeout: float | None = None,
        max_retries: int = 0,
    ):
        """初始化回退策略。

        Args:
            primary: 要执行的主操作
            fallbacks: 回退操作列表（按顺序尝试）
            timeout: 每个操作的超时秒数
            max_retries: 尝试回退前的重试次数
        """
        self.primary = primary
        self.fallbacks = fallbacks or []
        self.timeout = timeout
        self.max_retries = max_retries

    async def execute(self, *args: Any, **kwargs: Any) -> FallbackResult:
        """以回退策略执行。

        先尝试主操作，再按顺序尝试回退操作。
        每个操作最多重试 max_retries 次。

        Args:
            *args: 操作的位置参数
            **kwargs: 操作的关键字参数

        Returns:
            带执行结果的 FallbackResult
        """
        # 带重试地尝试主操作
        for attempt in range(self.max_retries + 1):
            try:
                if self.timeout:
                    result = await asyncio.wait_for(self.primary(*args, **kwargs), timeout=self.timeout)
                else:
                    result = await self.primary(*args, **kwargs)

                return FallbackResult(
                    success=True,
                    data=result,
                    degradation_level=DegradationLevel.NORMAL,
                    message="Primary operation succeeded",
                    used_fallback=False,
                )
            except TimeoutError:
                if attempt < self.max_retries:
                    continue
                # 主操作重试耗尽后失败，尝试回退
                break
            except Exception:
                if attempt < self.max_retries:
                    continue
                # 主操作重试耗尽后失败，尝试回退
                break

        # 按顺序尝试回退操作
        for idx, fallback in enumerate(self.fallbacks):
            try:
                if self.timeout:
                    result = await asyncio.wait_for(fallback(*args, **kwargs), timeout=self.timeout)
                else:
                    result = await fallback(*args, **kwargs)

                # 根据回退索引确定降级级别
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
                    used_fallback=True,
                )
            except Exception:
                # 该回退失败，尝试下一个
                continue

        # 所有操作均失败
        return FallbackResult(
            success=False,
            data=None,
            degradation_level=DegradationLevel.FAILSAFE,
            message="All operations failed",
            used_fallback=True,
        )


class WorkflowTimeoutController:
    """控制工作流级超时并强制时限。"""

    def __init__(
        self,
        total_timeout: float | None = None,
        node_timeout: float | None = None,
        warning_threshold: float = 0.8,
    ):
        """初始化超时控制器。

        Args:
            total_timeout: 工作流总超时秒数
            node_timeout: 每个节点的超时秒数
            warning_threshold: 触发告警的超时占比（0.0-1.0）
        """
        self.total_timeout = total_timeout
        self.node_timeout = node_timeout
        self.warning_threshold = warning_threshold
        self._start_time: float | None = None
        self._warnings_issued: list[str] = []

    def start(self) -> None:
        """标记工作流开始时间。"""
        import time

        self._start_time = time.time()

    def check_remaining_time(self) -> float | None:
        """检查总超时前的剩余时间。

        Returns:
            剩余秒数，或未设置超时时返回 None
        """
        if not self.total_timeout or not self._start_time:
            return None

        import time

        elapsed = time.time() - self._start_time
        remaining = self.total_timeout - elapsed
        return max(0.0, remaining)

    def should_warn(self, node_id: str) -> bool:
        """检查是否应为某节点发出超时告警。

        Args:
            node_id: Identifier of the node

        Returns:
            True if warning should be issued
        """
        remaining = self.check_remaining_time()
        if remaining is None or not self.total_timeout:
            return False

        # 若已使用超过总时间 warning_threshold 的时长则告警
        elapsed = self.total_timeout - remaining
        threshold_time = self.total_timeout * self.warning_threshold

        if elapsed >= threshold_time and node_id not in self._warnings_issued:
            self._warnings_issued.append(node_id)
            return True

        return False

    async def execute_with_timeout(
        self, operation: Callable[..., Any], *args: Any, node_id: str = "unknown", **kwargs: Any
    ) -> Any:
        """带超时控制地执行操作。

        Args:
            operation: 要执行的异步操作
            *args: 位置参数
            node_id: 节点标识（用于告警）
            **kwargs: 关键字参数

        Returns:
            操作结果

        Raises:
            asyncio.TimeoutError: 若操作超时
        """
        # 检查是否应就即将超时发出告警
        if self.should_warn(node_id):
            import logging

            logger = logging.getLogger(__name__)
            remaining = self.check_remaining_time()
            logger.warning(f"Node {node_id}: Workflow approaching timeout ({remaining:.1f}s remaining)")

        # 确定有效超时
        effective_timeout = self.node_timeout
        remaining = self.check_remaining_time()
        if remaining is not None:
            effective_timeout = remaining if effective_timeout is None else min(effective_timeout, remaining)

        # 带超时执行
        if effective_timeout:
            return await asyncio.wait_for(operation(*args, **kwargs), timeout=effective_timeout)
        else:
            return await operation(*args, **kwargs)


class GracefulDegradationManager:
    """管理整个工作流执行过程中的优雅降级。"""

    def __init__(
        self,
        timeout_controller: WorkflowTimeoutController | None = None,
        enable_fallback: bool = True,
    ):
        """初始化降级管理器。

        Args:
            timeout_controller: 工作流的超时控制器
            enable_fallback: 是否启用回退机制
        """
        self.timeout_controller = timeout_controller
        self.enable_fallback = enable_fallback
        self._current_level = DegradationLevel.NORMAL
        self._degradation_events: list[dict[str, Any]] = []

    @property
    def current_level(self) -> DegradationLevel:
        """获取当前降级级别。"""
        return self._current_level

    def record_degradation(self, level: DegradationLevel, reason: str) -> None:
        """记录一次降级事件。

        Args:
            level: Degradation level that occurred
            reason: Reason for degradation
        """
        import time

        self._degradation_events.append(
            {
                "timestamp": time.time(),
                "level": level.value,
                "reason": reason,
            }
        )

        # 将当前级别更新为迄今最差级别
        level_priority = {
            DegradationLevel.NORMAL: 0,
            DegradationLevel.DEGRADED: 1,
            DegradationLevel.MINIMAL: 2,
            DegradationLevel.FAILSAFE: 3,
        }
        if level_priority[level] > level_priority[self._current_level]:
            self._current_level = level

    def get_degradation_history(self) -> list[dict[str, Any]]:
        """获取降级事件的历史。"""
        return self._degradation_events.copy()

    async def execute_with_degradation(
        self,
        operation: Callable[..., Any],
        *args: Any,
        node_id: str = "unknown",
        fallbacks: list[Callable[..., Any]] | None = None,
        **kwargs: Any,
    ) -> FallbackResult:
        """以优雅降级方式执行操作。

        结合超时控制与回退机制。

        Args:
            operation: 主异步操作
            *args: 位置参数
            node_id: 节点标识
            fallbacks: 回退操作列表
            **kwargs: 关键字参数

        Returns:
            带执行结果的 FallbackResult
        """
        # 若控制器可用则给操作包裹超时
        controller = self.timeout_controller
        if controller:

            async def timed_operation(*a: Any, **kw: Any) -> Any:
                return await controller.execute_with_timeout(operation, *a, node_id=node_id, **kw)
        else:
            timed_operation = operation

        # 以回退策略执行
        if self.enable_fallback and fallbacks:
            strategy = FallbackStrategy(
                primary=timed_operation,
                fallbacks=fallbacks,
                timeout=self.timeout_controller.node_timeout if self.timeout_controller else None,
                max_retries=1,
            )
            result = await strategy.execute(*args, **kwargs)

            # 若使用了回退则记录降级
            if result.used_fallback:
                self.record_degradation(result.degradation_level, f"Node {node_id}: {result.message}")

            return result
        else:
            # 无回退，仅带超时执行
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
                    used_fallback=False,
                )
            except TimeoutError:
                self.record_degradation(DegradationLevel.MINIMAL, f"Node {node_id}: Operation timed out")
                return FallbackResult(
                    success=False,
                    data=None,
                    degradation_level=DegradationLevel.MINIMAL,
                    message="Operation timed out",
                    used_fallback=False,
                )
            except Exception as e:
                self.record_degradation(DegradationLevel.DEGRADED, f"Node {node_id}: {str(e)}")
                return FallbackResult(
                    success=False,
                    data=None,
                    degradation_level=DegradationLevel.DEGRADED,
                    message=f"Operation failed: {str(e)}",
                    used_fallback=False,
                )
