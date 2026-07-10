"""Shared models for tool generation."""

from pydantic import BaseModel


class GeneratedTool(BaseModel):
    id: str
    name: str
    description: str
    code: str
    language: str
    parameters: dict
    is_valid: bool
    error_message: str | None = None
