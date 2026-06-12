"""共享生成引擎 — 自然语言描述 → 结构化产物.

使用方式::

    from virtual_team.generation import registry
    result = registry.get("prompt").generate("代码审查助手")

各领域生成器继承 BaseGenerator 并注册到 registry。
"""
from virtual_team.generation import registry
from virtual_team.generation.generators.base import BaseGenerator, GenerateRequest, GenerateResponse

__all__ = ["BaseGenerator", "GenerateRequest", "GenerateResponse", "registry"]
