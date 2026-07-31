"""Tavily Web Search tool — official SDK wrapper."""

import asyncio
import os
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)


def _get_api_key() -> str:
    key = os.environ.get("TAVILY_API_KEY", "")
    if key:
        return key
    return ""


async def _get_api_key_from_vault() -> str:
    """Fallback: read Tavily key from the API Key Management vault."""
    try:
        from repository.keys_crud import get_tool_api_key
        vault_key = await get_tool_api_key("tavily")
        if vault_key:
            return vault_key
    except Exception:
        logger.warning("Failed to read Tavily key from vault", exc_info=True)
    return ""


async def tavily_search(tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
    query = args.get("query", "")
    max_results = int(args.get("max_results", 5))
    topic = args.get("topic", "general")
    time_range = args.get("time_range")
    if not query:
        return {"tool": tool_name, "error": "No query provided"}

    api_key = _get_api_key()
    if not api_key:
        api_key = await _get_api_key_from_vault()
    if not api_key:
        return {
            "tool": tool_name,
            "error": "Tavily API key not configured. Set TAVILY_API_KEY env var or add via API Key management.",
            "results": [],
            "answer": "",
        }

    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=api_key)
        kwargs: dict[str, Any] = {
            "query": query,
            "search_depth": "advanced",
            "max_results": max_results,
            "include_answer": True,
        }
        if topic:
            kwargs["topic"] = topic
        if time_range:
            kwargs["time_range"] = time_range

        # Tavily SDK is synchronous — run in executor to avoid blocking
        data = await asyncio.to_thread(lambda: client.search(**kwargs))
    except Exception as e:
        logger.error("Tavily search failed: %s", e)
        return {"tool": tool_name, "error": str(e), "results": []}

    results = data.get("results", [])
    refs = [
        {"title": r.get("title", ""), "url": r.get("url", ""), "snippet": (r.get("content") or "")[:200]}
        for r in results
    ]

    return {
        "tool": tool_name,
        "query": query,
        "results": refs,
        "answer": data.get("answer", ""),
        "success": True,
    }


# Self-register on import as the web_search plugin
from thinking_tree.registry import registry  # noqa: E402

registry.register_plugin(
    tool_name="web_search",
    handler=tavily_search,
    label="Tavily AI Search",
    description="AI-powered web search with semantic understanding and answer generation",
    config_schema={
        "type": "object",
        "properties": {
            "api_key": {
                "type": "string",
                "title": "Tavily API Key",
                "description": "Get from https://tavily.com",
            },
            "max_results": {
                "type": "integer",
                "default": 5,
                "minimum": 1,
                "maximum": 20,
                "title": "Max Results",
            },
        },
        "required": ["api_key"],
    },
    priority=100,
)
