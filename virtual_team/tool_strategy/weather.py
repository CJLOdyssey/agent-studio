"""Weather tool strategy — fetch weather forecasts for a city."""

from __future__ import annotations

import json

from virtual_team.tool_strategy import ToolMetadata, ToolStrategy


class WeatherStrategy(ToolStrategy):
    """Simulated weather tool — returns canned data for any city."""

    @staticmethod
    def match(metadata: ToolMetadata) -> bool:
        n = metadata.name.lower()
        return any(k in n for k in ("weather", "天气"))

    async def invoke(self, metadata: ToolMetadata, args: dict) -> str:
        city = args.get("city", "北京")
        return json.dumps(
            {
                "tool": metadata.name,
                "city": city,
                "temperature": "22°C",
                "weather": "晴",
                "humidity": "30%",
                "wind": "3级",
            }
        )
