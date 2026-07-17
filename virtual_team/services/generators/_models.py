"""Shared models for tool generation."""

from pydantic import BaseModel
from typing import Any



class GeneratedTool(BaseModel):
    id: str
    name: str
    description: str
    code: str
    language: str
    parameters: dict[str, Any]
    is_valid: bool
    error_message: str | None = None
