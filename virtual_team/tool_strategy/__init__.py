"""ToolStrategy abstraction and registry for agent tool execution.

Each concrete strategy implements the ToolStrategy ABC and is registered
via a name pattern that _ToolWrapper matches against.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


@dataclass
class ToolMetadata:
    """Read-only descriptor for strategy lookup — mirrors ToolConfig fields a strategy needs."""

    name: str
    description: str
    instructions: str
    mcp_type: str
    mcp_endpoint: str
    mcp_tool_name: str
    endpoint: str
    method: str
    headers: str


class ToolStrategy(ABC):
    """Abstract strategy for executing a single tool by name.

    Each subclass implements :meth:`invoke` and declares a class-level
    ``match`` predicate that determines whether it handles a given
    tool name.
    """

    @staticmethod
    @abstractmethod
    def match(metadata: ToolMetadata) -> bool:
        """Return True if this strategy handles *metadata.name*."""

    @abstractmethod
    async def invoke(self, metadata: ToolMetadata, args: dict) -> str:
        """Execute the tool and return a JSON string."""


# ── Strategy-table builder ──────────────────────────────────────


def build_strategy_table(
    strategies: list[type[ToolStrategy]],
    metadata: ToolMetadata,
) -> list[ToolStrategy]:
    """Return instantiated strategies whose ``match()`` returns True, in declaration order."""
    return [s() for s in strategies if s.match(metadata)]


async def dispatch(
    strategies: list[ToolStrategy],
    metadata: ToolMetadata,
    args: dict,
) -> str | None:
    """Try each strategy in order; return the first non-error result or *None*."""
    for strategy in strategies:
        try:
            return await strategy.invoke(metadata, args)
        except Exception:
            continue
    return None
