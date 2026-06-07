"""MCP 生成器 — 自然语言描述 → MCP 服务配置."""
from __future__ import annotations

import hashlib

from virtual_team.generation.generators.base import (
    BaseGenerator,
    GenerateRequest,
    GenerateResponse,
)

TEMPLATES: dict = {
    "database": {
        "keywords": ["database", "数据库", "sql", "db", "postgres", "mysql", "redis"],
        "name": "database_mcp",
        "endpoint": "http://localhost:8001/mcp/database",
        "tool_filter": "(db|query|table|schema|insert|select|update|delete)",
        "config": {"type": "database", "driver": "postgresql", "pool_size": 10, "timeout": 30},
    },
    "web_search": {
        "keywords": ["search", "搜索", "web", "网页", "browser", "浏览", "google"],
        "name": "web_search_mcp",
        "endpoint": "http://localhost:8001/mcp/web-search",
        "tool_filter": "(search|query|browse|fetch|scrape|lookup)",
        "config": {"type": "web_search", "engine": "google", "max_results": 10, "timeout": 15},
    },
    "filesystem": {
        "keywords": ["file", "文件", "读写", "存储", "filesystem"],
        "name": "filesystem_mcp",
        "endpoint": "http://localhost:8001/mcp/filesystem",
        "tool_filter": "(read|write|list|delete|move|copy|upload)",
        "config": {"type": "filesystem", "allowed_paths": ["/data"], "max_file_size": 10485760},
    },
    "external_api": {
        "keywords": ["api", "rest", "http", "外部", "external"],
        "name": "external_api_mcp",
        "endpoint": "http://localhost:8001/mcp/api",
        "tool_filter": "(get|post|put|delete|patch|fetch|request)",
        "config": {"type": "external_api", "timeout": 30, "max_retries": 3},
    },
    "llm": {
        "keywords": ["llm", "ai", "chat", "gpt", "deepseek", "openai"],
        "name": "llm_mcp",
        "endpoint": "http://localhost:8001/mcp/llm",
        "tool_filter": "(complete|chat|embed|analyze|summarize|translate)",
        "config": {"type": "llm", "model": "gpt-4o", "temperature": 0.7, "max_tokens": 4096},
    },
    "storage": {
        "keywords": ["存储", "storage", "oss", "s3", "云存储", "对象存储"],
        "name": "storage_mcp",
        "endpoint": "http://localhost:8001/mcp/storage",
        "tool_filter": "(upload|download|list|delete|move|copy)",
        "config": {"type": "storage", "provider": "s3", "bucket": "default", "region": "us-east-1"},
    },
}


class McpGenerator(BaseGenerator):
    """自然语言描述 → MCP 服务配置."""

    def generate(self, request: GenerateRequest) -> GenerateResponse:
        mcp_id = f"mcp_{hashlib.md5(request.description.encode(), usedforsecurity=False).hexdigest()[:8]}"
        template = self._match_template(request.description)

        if template:
            return GenerateResponse(
                id=mcp_id,
                name=template["name"],
                description=template["name"].replace("_", " ").title() + " MCP服务器",
                content=template["endpoint"],
                metadata={
                    "endpoint": template["endpoint"],
                    "tool_filter": template["tool_filter"],
                    "config": template["config"],
                },
            )
        return GenerateResponse(
            id=mcp_id,
            name="custom_mcp",
            description="自定义MCP服务器",
            content="http://localhost:8001/mcp/custom",
            metadata={
                "endpoint": "http://localhost:8001/mcp/custom",
                "tool_filter": "(custom|execute|run)",
                "config": {"type": "custom", "runtime": "python", "entrypoint": "main.py"},
            },
        )

    def supported_keywords(self) -> list[str]:
        return [kw for t in TEMPLATES.values() for kw in t["keywords"]]

    def _match_template(self, description: str) -> dict | None:
        desc_lower = description.lower()
        for template in TEMPLATES.values():
            if any(kw in desc_lower for kw in template["keywords"]):
                return template
        return None
