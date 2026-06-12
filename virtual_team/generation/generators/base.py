"""生成器抽象基类 — 所有领域生成器统一接口.每个生成器实现 _generate 方法返回结构化产物."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class GenerateRequest:
    """生成请求."""
    description: str
    context: dict[str, Any] = field(default_factory=dict)


@dataclass
class GenerateResponse:
    """生成结果."""
    id: str
    name: str
    description: str
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseGenerator(ABC):
    """所有领域生成器的统一接口.

    子类只需实现 :meth:`_generate` 返回产物字典，
    基类负责 ID 生成、元数据封装等横切关注点。
    """

    @abstractmethod
    def generate(self, request: GenerateRequest) -> GenerateResponse:
        ...

    def supported_keywords(self) -> list[str]:
        return []
