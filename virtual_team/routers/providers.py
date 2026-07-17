"""Provider definitions — capabilities, base URLs, and model hints.

Single source of truth consumed by:
  - Frontend ProviderEditModal (type selector, capability badges)
  - Backend key validation (usage_type against provider capabilities)

Adding a new provider or capability requires only updating the PROVIDERS dict.
"""

from typing import Literal, Any

from fastapi import APIRouter

Capability = Literal["llm", "embedding"]

PROVIDERS: dict[str, dict] = {  # type: ignore[type-arg]
    "openai": {
        "name": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "capabilities": ["llm", "embedding"],
        "docs_url": "https://platform.openai.com/api-keys",
    },
    "deepseek": {
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com",
        "capabilities": ["llm"],
        "docs_url": "https://platform.deepseek.com/api_keys",
    },
    "anthropic": {
        "name": "Anthropic",
        "base_url": "https://api.anthropic.com",
        "capabilities": ["llm"],
        "docs_url": "https://console.anthropic.com/settings/keys",
    },
    "dashscope": {
        "name": "DashScope（阿里云百炼）",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "capabilities": ["llm", "embedding"],
        "docs_url": "https://bailian.console.aliyun.com/#/api-key",
    },
    "custom": {
        "name": "自定义",
        "base_url": "",
        "capabilities": ["llm", "embedding"],
        "docs_url": None,
    },
}

router = APIRouter(tags=["providers"])


@router.get("/api/providers")
async def list_providers() -> Any:
    """Return all known providers with their capabilities and base URLs."""
    return PROVIDERS

