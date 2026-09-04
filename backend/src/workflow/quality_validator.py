"""工作流节点的输出质量校验。

在传给下游节点前校验节点输出，以防止错误级联并保证质量标准。
"""

import re
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum
from typing import Any


class ValidationSeverity(Enum):
    """校验失败的严重级别。"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class ValidationResult:
    """质量校验检查的结果。"""
    passed: bool
    severity: ValidationSeverity
    message: str
    score: float = 1.0  # 0.0 到 1.0，1.0 表示质量最佳
    details: dict[str, Any] | None = None


class QualityValidator:
    """在传给下游节点前校验节点输出质量。"""

    def __init__(
        self,
        min_length: int = 10,
        max_length: int = 100000,
        min_confidence: float = 0.5,
        require_non_empty: bool = True,
        custom_validators: list[Callable[[str], ValidationResult]] | None = None,
    ):
        """使用可配置阈值初始化质量校验器。

        Args:
            min_length: 最小输出长度（字符数）
            max_length: 最大输出长度（字符数）
            min_confidence: 最小置信度分数（若元数据中提供）
            require_non_empty: 空输出是否应校验失败
            custom_validators: 自定义校验函数列表
        """
        self.min_length = min_length
        self.max_length = max_length
        self.min_confidence = min_confidence
        self.require_non_empty = require_non_empty
        self.custom_validators = custom_validators or []

    def validate(self, output: str, metadata: dict[str, Any] | None = None) -> ValidationResult:
        """校验节点输出质量。

        Args:
            output: 待校验的节点输出字符串
            metadata: 可选元数据，可含置信度分数

        Returns:
            带通过/失败状态与详情的 ValidationResult
        """
        metadata = metadata or {}

        # 检查空输出
        if self.require_non_empty and not output.strip():
            return ValidationResult(
                passed=False,
                severity=ValidationSeverity.ERROR,
                message="Output is empty",
                score=0.0,
            )

        # 检查长度约束
        output_length = len(output)
        if output_length < self.min_length:
            return ValidationResult(
                passed=False,
                severity=ValidationSeverity.WARNING,
                message=f"Output too short: {output_length} chars (min: {self.min_length})",
                score=output_length / self.min_length,
                details={"length": output_length, "min_length": self.min_length},
            )

        if output_length > self.max_length:
            return ValidationResult(
                passed=False,
                severity=ValidationSeverity.WARNING,
                message=f"Output too long: {output_length} chars (max: {self.max_length})",
                score=self.max_length / output_length,
                details={"length": output_length, "max_length": self.max_length},
            )

        # 若提供了置信度则检查
        confidence = metadata.get("confidence")
        if confidence is not None and confidence < self.min_confidence:
            return ValidationResult(
                passed=False,
                severity=ValidationSeverity.WARNING,
                message=f"Low confidence: {confidence:.2f} (min: {self.min_confidence:.2f})",
                score=confidence / self.min_confidence,
                details={"confidence": confidence, "min_confidence": self.min_confidence},
            )

        # 检查常见错误模式
        error_patterns = [
            r"error[:\s]",
            r"exception[:\s]",
            r"failed[:\s]",
            r"traceback \(most recent call last\)",
        ]
        output_lower = output.lower()
        for pattern in error_patterns:
            if re.search(pattern, output_lower):
                return ValidationResult(
                    passed=False,
                    severity=ValidationSeverity.WARNING,
                    message=f"Output contains error pattern: {pattern}",
                    score=0.6,
                    details={"pattern": pattern},
                )

        # 运行自定义校验器
        for validator in self.custom_validators:
            try:
                result = validator(output)
                if not result.passed:
                    return result
            except Exception as e:
                return ValidationResult(
                    passed=False,
                    severity=ValidationSeverity.ERROR,
                    message=f"Custom validator failed: {str(e)}",
                    score=0.5,
                )

        # 所有检查均通过
        return ValidationResult(
            passed=True,
            severity=ValidationSeverity.INFO,
            message="Output quality validation passed",
            score=1.0,
        )


class NodeOutputGate:
    """在传给下游节点前校验节点输出的门控。

    实现 fail-fast 策略：若校验失败，则输出要么被拒绝（抛出异常），
    要么被回退值替换。
    """

    def __init__(
        self,
        validator: QualityValidator,
        fallback_output: str | None = None,
        fail_on_validation_error: bool = True,
    ):
        """初始化输出门控。

        Args:
            validator: 要使用的 QualityValidator 实例
            fallback_output: 校验失败时使用的可选回退输出
            fail_on_validation_error: 校验失败时是否抛出异常
        """
        self.validator = validator
        self.fallback_output = fallback_output
        self.fail_on_validation_error = fail_on_validation_error

    def gate(self, output: str, metadata: dict[str, Any] | None = None) -> str:
        """通过质量校验门控节点输出。

        Args:
            output: 待校验的节点输出
            metadata: 可选的校验元数据

        Returns:
            校验通过的输出，或校验失败时的回退值

        Raises:
            ValueError: 若校验失败且 fail_on_validation_error 为 True
        """
        result = self.validator.validate(output, metadata)

        if result.passed:
            return output

        # 校验失败
        if self.fail_on_validation_error:
            raise ValueError(
                f"Node output failed quality validation: {result.message} "
                f"(severity: {result.severity.value}, score: {result.score:.2f})"
            )

        # 若有回退值则使用
        if self.fallback_output is not None:
            return self.fallback_output

        # 原样返回输出并告警
        return output


def create_default_validator() -> QualityValidator:
    """创建带合理阈值的默认质量校验器。"""
    return QualityValidator(
        min_length=10,
        max_length=50000,
        min_confidence=0.5,
        require_non_empty=True,
    )


def create_strict_validator() -> QualityValidator:
    """为关键节点创建严格的质量校验器。"""
    return QualityValidator(
        min_length=50,
        max_length=10000,
        min_confidence=0.8,
        require_non_empty=True,
    )


def create_lenient_validator() -> QualityValidator:
    """为实验性节点创建宽松的质量校验器。"""
    return QualityValidator(
        min_length=1,
        max_length=200000,
        min_confidence=0.3,
        require_non_empty=False,
    )
