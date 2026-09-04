"""工具生成的共享模型。"""

from typing import Any

from pydantic import BaseModel


class GeneratedTool(BaseModel):
    id: str
    name: str
    description: str
    code: str
    language: str
    parameters: dict[str, Any]
    is_valid: bool
    error_message: str | None = None
