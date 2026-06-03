"""Available models API route.

Returns the list of models that users can select in the frontend.
Models are configured server-side via environment variables — API keys
never leave the server.
"""

import os

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["models"])


class ModelInfo(BaseModel):
    id: str
    label: str
    provider: str


def _get_available_models() -> list[ModelInfo]:
    """Build model list from environment configuration."""
    models: list[ModelInfo] = []

    # DeepSeek models (available when DEEPSEEK_API_KEY is set)
    if os.environ.get("DEEPSEEK_API_KEY"):
        models.extend([
            ModelInfo(id="deepseek-chat", label="DeepSeek Chat", provider="DeepSeek"),
            ModelInfo(id="deepseek-reasoner", label="DeepSeek Reasoner", provider="DeepSeek"),
        ])

    # OpenAI models (available when OPENAI_API_KEY is set)
    if os.environ.get("OPENAI_API_KEY"):
        models.extend([
            ModelInfo(id="gpt-4o", label="GPT-4o", provider="OpenAI"),
            ModelInfo(id="gpt-4o-mini", label="GPT-4o Mini", provider="OpenAI"),
        ])

    # Anthropic models (available when ANTHROPIC_API_KEY is set)
    if os.environ.get("ANTHROPIC_API_KEY"):
        models.extend([
            ModelInfo(id="claude-sonnet-4-20250514", label="Claude Sonnet 4", provider="Anthropic"),
            ModelInfo(id="claude-3-5-haiku-20241022", label="Claude 3.5 Haiku", provider="Anthropic"),
        ])

    # Fallback: always show DeepSeek as default
    if not models:
        models.append(ModelInfo(id="deepseek-chat", label="DeepSeek Chat", provider="DeepSeek"))

    return models


@router.get("/api/models", response_model=list[ModelInfo])
async def list_models():
    """Return available models based on configured API keys."""
    return _get_available_models()
