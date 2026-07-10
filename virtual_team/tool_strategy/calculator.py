from __future__ import annotations

import json

from virtual_team.tool_strategy import ToolMetadata, ToolStrategy


class CalculatorStrategy(ToolStrategy):
    """Evaluates simple arithmetic expressions via safe eval."""

    @staticmethod
    def match(metadata: ToolMetadata) -> bool:
        n = metadata.name.lower()
        return "calculator" in n or "calc" in n

    async def invoke(self, metadata: ToolMetadata, args: dict) -> str:
        expr = args.get("expression") or args.get("expr") or args.get("query") or ""
        if not expr:
            return json.dumps(
                {
                    "tool": metadata.name,
                    "error": "No expression provided. "
                    "Pass {'expression': '<math>'} or {'expr': '<math>'}.",
                }
            )
        try:
            result = eval(expr, {"__builtins__": {}}, {})
            return json.dumps({"tool": metadata.name, "expression": expr, "result": result})
        except Exception as e:
            return json.dumps({"tool": metadata.name, "expression": expr, "error": str(e)})