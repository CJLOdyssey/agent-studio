"""Calculator tool — evaluates math expressions safely.

Supported operators: +, -, *, /, **, %, //, abs, round
Math functions: sqrt, sin, cos, tan, log, log10, floor, ceil, pi, e
"""

import math
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)

# Whitelist of safe names for the eval sandbox
_SAFE_GLOBALS: dict[str, Any] = {
    "__builtins__": {
        "abs": abs,
        "round": round,
        "int": int,
        "float": float,
        "max": max,
        "min": min,
        "pow": pow,
        "sum": sum,
    },
    "math": math,
    "sqrt": math.sqrt,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "log": math.log,
    "log10": math.log10,
    "floor": math.floor,
    "ceil": math.ceil,
    "pi": math.pi,
    "e": math.e,
    "inf": math.inf,
}


async def calculator_handler(tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Evaluate a math expression.

    Args:
        tool_name: 'calculator'
        args: {'expression': '2 + 2 * 3'}
    """
    expression = (args.get("expression") or "").strip()
    if not expression:
        return {"tool": tool_name, "error": "No expression provided"}

    # Block dangerous patterns
    forbidden = ["__", "import", "exec", "eval", "open", "getattr", "setattr"]
    for token in forbidden:
        if token in expression:
            return {"tool": tool_name, "error": f"Expression contains forbidden token: {token}"}

    try:
        result = eval(expression, _SAFE_GLOBALS, {})  # noqa: S307 — sandboxed globals
        # Convert non-serializable returns
        if isinstance(result, (float, int)):
            return {
                "tool": tool_name,
                "expression": expression,
                "result": result,
                "success": True,
            }
        return {
            "tool": tool_name,
            "expression": expression,
            "result": str(result),
            "success": True,
        }
    except Exception as e:
        logger.warning("Calculator failed on '%s': %s", expression, e)
        return {"tool": tool_name, "error": str(e)}


# Self-register on import
from thinking_tree.registry import registry  # noqa: E402

registry.register_plugin(
    tool_name="calculator",
    handler=calculator_handler,
    label="Math Calculator",
    description="Evaluate mathematical expressions: +, -, *, /, **, %, sqrt, sin, cos, log, etc.",
    config_schema={
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "Math expression to evaluate (e.g. 'sqrt(144) + 3 * 7')",
            },
        },
        "required": ["expression"],
    },
    priority=100,
)
