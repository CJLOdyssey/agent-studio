"""Output quality validation for workflow nodes.

Validates node outputs before passing to downstream nodes to prevent
error cascading and ensure quality standards.
"""

import re
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum
from typing import Any


class ValidationSeverity(Enum):
    """Severity level for validation failures."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class ValidationResult:
    """Result of a quality validation check."""
    passed: bool
    severity: ValidationSeverity
    message: str
    score: float = 1.0  # 0.0 to 1.0, where 1.0 is perfect quality
    details: dict[str, Any] | None = None


class QualityValidator:
    """Validates node output quality before passing to downstream nodes."""

    def __init__(
        self,
        min_length: int = 10,
        max_length: int = 100000,
        min_confidence: float = 0.5,
        require_non_empty: bool = True,
        custom_validators: list[Callable[[str], ValidationResult]] | None = None,
    ):
        """Initialize quality validator with configurable thresholds.

        Args:
            min_length: Minimum output length in characters
            max_length: Maximum output length in characters
            min_confidence: Minimum confidence score (if provided in metadata)
            require_non_empty: Whether empty outputs should fail validation
            custom_validators: List of custom validation functions
        """
        self.min_length = min_length
        self.max_length = max_length
        self.min_confidence = min_confidence
        self.require_non_empty = require_non_empty
        self.custom_validators = custom_validators or []

    def validate(self, output: str, metadata: dict[str, Any] | None = None) -> ValidationResult:
        """Validate node output quality.

        Args:
            output: The node output string to validate
            metadata: Optional metadata including confidence scores

        Returns:
            ValidationResult with pass/fail status and details
        """
        metadata = metadata or {}

        # Check empty output
        if self.require_non_empty and not output.strip():
            return ValidationResult(
                passed=False,
                severity=ValidationSeverity.ERROR,
                message="Output is empty",
                score=0.0,
            )

        # Check length constraints
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

        # Check confidence if provided
        confidence = metadata.get("confidence")
        if confidence is not None and confidence < self.min_confidence:
            return ValidationResult(
                passed=False,
                severity=ValidationSeverity.WARNING,
                message=f"Low confidence: {confidence:.2f} (min: {self.min_confidence:.2f})",
                score=confidence / self.min_confidence,
                details={"confidence": confidence, "min_confidence": self.min_confidence},
            )

        # Check for common error patterns
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

        # Run custom validators
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

        # All checks passed
        return ValidationResult(
            passed=True,
            severity=ValidationSeverity.INFO,
            message="Output quality validation passed",
            score=1.0,
        )


class NodeOutputGate:
    """Gate that validates node outputs before passing to downstream nodes.

    Implements a fail-fast strategy: if validation fails, the output is either
    rejected (raising an exception) or replaced with a fallback value.
    """

    def __init__(
        self,
        validator: QualityValidator,
        fallback_output: str | None = None,
        fail_on_validation_error: bool = True,
    ):
        """Initialize output gate.

        Args:
            validator: QualityValidator instance to use
            fallback_output: Optional fallback output if validation fails
            fail_on_validation_error: Whether to raise exception on validation failure
        """
        self.validator = validator
        self.fallback_output = fallback_output
        self.fail_on_validation_error = fail_on_validation_error

    def gate(self, output: str, metadata: dict[str, Any] | None = None) -> str:
        """Gate node output through quality validation.

        Args:
            output: Node output to validate
            metadata: Optional metadata for validation

        Returns:
            Validated output or fallback if validation fails

        Raises:
            ValueError: If validation fails and fail_on_validation_error is True
        """
        result = self.validator.validate(output, metadata)

        if result.passed:
            return output

        # Validation failed
        if self.fail_on_validation_error:
            raise ValueError(
                f"Node output failed quality validation: {result.message} "
                f"(severity: {result.severity.value}, score: {result.score:.2f})"
            )

        # Use fallback if available
        if self.fallback_output is not None:
            return self.fallback_output

        # Return original output with warning
        return output


def create_default_validator() -> QualityValidator:
    """Create a default quality validator with reasonable thresholds."""
    return QualityValidator(
        min_length=10,
        max_length=50000,
        min_confidence=0.5,
        require_non_empty=True,
    )


def create_strict_validator() -> QualityValidator:
    """Create a strict quality validator for critical nodes."""
    return QualityValidator(
        min_length=50,
        max_length=10000,
        min_confidence=0.8,
        require_non_empty=True,
    )


def create_lenient_validator() -> QualityValidator:
    """Create a lenient quality validator for experimental nodes."""
    return QualityValidator(
        min_length=1,
        max_length=200000,
        min_confidence=0.3,
        require_non_empty=False,
    )
