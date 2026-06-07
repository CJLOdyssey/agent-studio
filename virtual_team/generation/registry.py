"""生成器注册表 — 管理和发现所有领域生成器.

使用方式::

    from virtual_team.generation import registry
    prompt_gen = registry.get("prompt")
    result = prompt_gen.generate(GenerateRequest(description="代码审查"))
"""
from __future__ import annotations

from typing import Any

from virtual_team.generation.generators.base import BaseGenerator
from virtual_team.generation.generators.mcp_generator import McpGenerator
from virtual_team.generation.generators.prompt_generator import PromptGenerator
from virtual_team.generation.generators.schema_generator import SchemaGenerator
from virtual_team.logging_config import get_logger

logger = get_logger(__name__)

_registry: dict[str, BaseGenerator] = {}


def register(name: str, generator: BaseGenerator) -> None:
    """注册一个生成器到全局注册表."""
    _registry[name] = generator
    logger.info("Registered generator: %s (%s)", name, type(generator).__name__)


def get(name: str) -> BaseGenerator | None:
    """按名称获取生成器实例."""
    return _registry.get(name)


def list_generators() -> dict[str, Any]:
    """列出所有已注册的生成器及其支持的关键词."""
    return {name: gen.supported_keywords() for name, gen in _registry.items()}


# ── 注册内置生成器 ──────────────────────────────────────────────────────────
register("prompt", PromptGenerator())
register("schema", SchemaGenerator())
register("mcp", McpGenerator())
