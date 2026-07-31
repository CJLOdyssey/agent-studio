"""Fetch Page tool — retrieves web page content as text."""

from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)


async def fetch_page_handler(tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Fetch a URL and return its content as text.

    Args:
        tool_name: 'fetch_page'
        args: {'url': 'https://example.com', 'max_length': 5000}
    """
    url = (args.get("url") or "").strip()
    if not url:
        return {"tool": tool_name, "error": "No URL provided"}

    if not url.startswith(("http://", "https://")):
        return {"tool": tool_name, "error": "Only http/https URLs are supported"}

    max_length = int(args.get("max_length", 5000))

    import httpx

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "AgentStudio/1.0"})
            resp.raise_for_status()

        # Detect encoding and extract readable text
        content_type = resp.headers.get("content-type", "")
        if "charset=" in content_type:
            encoding = content_type.split("charset=")[-1].split(";")[0].strip()
        else:
            encoding = "utf-8"

        raw = resp.content
        try:
            text = raw.decode(encoding)
        except (LookupError, UnicodeDecodeError):
            text = raw.decode("utf-8", errors="replace")

        # Strip HTML tags for readability
        import re

        clean = re.sub(r"<[^>]+>", " ", text)
        clean = re.sub(r"\s+", " ", clean).strip()

        if len(clean) > max_length:
            clean = clean[:max_length] + "…"

        return {
            "tool": tool_name,
            "url": url,
            "content": clean,
            "content_length": len(clean),
            "status_code": resp.status_code,
            "success": True,
        }
    except httpx.TimeoutException:
        return {"tool": tool_name, "error": f"Request timed out after 15s: {url}"}
    except httpx.HTTPStatusError as e:
        return {"tool": tool_name, "error": f"HTTP {e.response.status_code}: {url}"}
    except Exception as e:
        logger.warning("fetch_page failed for %s: %s", url, e)
        return {"tool": tool_name, "error": str(e)}


# Self-register on import
from thinking_tree.registry import registry  # noqa: E402

registry.register_plugin(
    tool_name="fetch_page",
    handler=fetch_page_handler,
    label="Web Page Fetcher",
    description="Fetch and extract readable text content from any web page",
    config_schema={
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "Full URL of the web page to fetch (http/https only)",
            },
            "max_length": {
                "type": "integer",
                "default": 5000,
                "description": "Maximum characters to return",
            },
        },
        "required": ["url"],
    },
    priority=100,
)
