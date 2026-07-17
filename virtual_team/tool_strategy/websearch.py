from typing import Any

"""Web search tool strategy — perform web searches via DuckDuckGo."""

from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request

from virtual_team.tool_strategy import ToolMetadata, ToolStrategy


class WebSearchStrategy(ToolStrategy):
    """Web search tool with multi-backend fallback: Tavily → Baidu → Bing → stub."""

    @staticmethod
    def match(metadata: ToolMetadata) -> bool:
        n = metadata.name.lower()
        return "websearch" in n or "search" in n

    async def invoke(self, metadata: ToolMetadata, args: dict[str, Any]) -> str:
        query = args.get("query", "")
        if not query:
            return json.dumps({"tool": metadata.name, "error": "No query provided"})
        try:
            result = await _web_search(query)
            return json.dumps({"tool": metadata.name, "query": query, "results": result})
        except Exception as e:
            return json.dumps({"tool": metadata.name, "query": query, "error": str(e)})


# ── search backends (module-level helpers, no class overhead needed) ──


async def _web_search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Multi-backend web search: Tavily → Baidu Qianfan → Bing → stub."""
    tavily_key = os.environ.get("TAVILY_API_KEY", "")
    if tavily_key:
        try:
            from virtual_team.thinking_tree.tools.tavily_search import tavily_search

            result = await tavily_search("web_search", {"query": query, "max_results": max_results})
            refs = result.get("results", [])
            if refs:
                return [{"title": r["title"], "snippet": r.get("snippet", ""), "url": r["url"]} for r in refs]
        except Exception:
            pass

    baidu_key = os.environ.get("BAIDU_QIANFAN_API_KEY", "")
    if baidu_key:
        try:
            results = _baidu_qianfan_search(query, baidu_key, max_results)
            if results:
                return results[:max_results]
        except Exception:
            pass

    try:
        results = _bing_search(query, max_results, enrich=True)
        return results[:max_results]
    except Exception:
        pass

    return [{"snippet": f"搜索失败: {query}"}]


def _bing_search(query: str, max_results: int = 5, enrich: bool = False) -> list[dict[str, Any]]:
    url = f"https://cn.bing.com/search?q={urllib.parse.quote(query)}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode("utf-8", errors="ignore")

    results: list[dict[str, Any]] = []
    for match in re.finditer(r'<li class="b_algo"[^>]*>(.*?)</li>', html, re.DOTALL):
        if len(results) >= max_results:
            break
        block = match.group(1)
        title_m = re.search(r'<h2[^>]*><a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', block, re.DOTALL)
        snippet_m = re.search(r"<p[^>]*>(.*?)</p>", block, re.DOTALL)
        url_found = title_m.group(1) if title_m else ""
        title = re.sub(r"<[^>]+>", "", title_m.group(2) if title_m else "").strip()
        snippet = re.sub(r"<[^>]+>", "", snippet_m.group(1) if snippet_m else "").strip()
        if title and snippet:
            item = {"title": title, "snippet": snippet, "url": url_found, "full_text": ""}
            if enrich and url_found:
                item["full_text"] = _fetch_page(url_found, max_chars=2000)
            results.append(item)

    return results[:max_results] if results else [{"snippet": f"No results for: {query}"}]


def _fetch_page(url: str, max_chars: int = 2000) -> str:
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept-Encoding": "gzip",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read()
            if resp.headers.get("Content-Encoding") == "gzip":
                import gzip
                raw = gzip.decompress(raw)
            html = raw.decode("utf-8", errors="ignore")

        for tag in ("script", "style", "nav", "footer", "header", "aside", "iframe", "noscript"):
            html = re.sub(rf"<{tag}[^>]*>.*?</{tag}>", "", html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r"<[^>]+>", " ", html)
        html = re.sub(r"&[a-z]+;", " ", html)
        lines = [line.strip() for line in html.splitlines() if line.strip()]
        text = " ".join(lines)
        text = re.sub(r"\s{2,}", " ", text)
        return text[:max_chars].strip()
    except Exception:
        return ""


def _baidu_qianfan_search(query: str, api_key: str, max_results: int = 5) -> list[dict[str, Any]]:
    import json as _json

    body = _json.dumps(
        {
            "messages": [{"content": query, "role": "user"}],
            "search_source": "baidu_search_v2",
            "resource_type_filter": [{"type": "web", "top_k": max_results}],
        }
    ).encode()
    req = urllib.request.Request(
        "https://qianfan.baidubce.com/v2/ai_search/web_search",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = _json.loads(resp.read())
    results = []
    for ref in (data.get("references") or [])[:max_results]:
        results.append(
            {
                "title": ref.get("title", ""),
                "snippet": ref.get("content", "")[:300],
                "url": ref.get("url", ""),
            }
        )
    return results if results else [{"snippet": f"No Baidu results for: {query}"}]
