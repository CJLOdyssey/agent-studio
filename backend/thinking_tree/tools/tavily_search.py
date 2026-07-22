"""Tavily Web Search tool — hybrid keyword + semantic search with AI reranking."""

import os
from typing import Any

from backend.core.infra.logging_config import get_logger

logger = get_logger(__name__)

TAVILY_API_URL = "https://api.tavily.com/search"


def _get_api_key() -> str:
    key = os.environ.get("TAVILY_API_KEY", "")
    if key:
        return key
    return ""


async def tavily_search(tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
    query = args.get("query", "")
    max_results = int(args.get("max_results", 5))
    if not query:
        return {"tool": tool_name, "error": "No query provided"}

    api_key = _get_api_key()
    if not api_key:
        return {
            "tool": tool_name,
            "error": "Tavily API key not configured. Set TAVILY_API_KEY env var or add via API Key management.",
            "results": [],
            "answer": "",
        }

    import httpx

    payload = {
        "api_key": api_key,
        "query": query,
        "search_depth": "advanced",
        "include_answer": True,
        "max_results": max_results,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(TAVILY_API_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()
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
from backend.thinking_tree.registry import registry  # noqa: E402

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
