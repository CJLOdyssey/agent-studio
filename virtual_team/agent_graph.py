"""
LangGraph-based single Agent engine with DeepSeek thinking support.

Architecture:
  START -> agent -> [has tool_calls?] --yes--> tools -> agent
                    `-- no ---> END
"""

import asyncio
import json
import os
import re
import subprocess
import urllib.parse
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Annotated, TypedDict

import httpx
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from virtual_team.logging_config import get_logger

# Import tool plugins so they self-register with the ToolRegistry
import virtual_team.thinking_tree.tools.tavily_search  # noqa: F401


logger = get_logger(__name__)


@dataclass
class ToolConfig:
    """Lightweight tool descriptor for registration with the agent graph."""

    name: str
    description: str = ""
    parameters: dict | None = None
    instructions: str = ""
    mcp_type: str = ""
    mcp_endpoint: str = ""
    endpoint: str = ""
    method: str = "GET"
    headers: str = "{}"


class _ToolWrapper:
    """Wraps a tool name so it can be invoked by the graph's tools node.

    Real implementations:
      - websearch / mcp_websearch → Bing search (free, no key)
      - calculator → simple arithmetic eval
      - weather_* → simulated
      - skill_* → Returns full instructions (Anthropic progressive disclosure pattern)
      - custom → LLM-powered execution
    """

    def __init__(
        self,
        name: str,
        description: str = "",
        instructions: str = "",
        mcp_type: str = "",
        mcp_endpoint: str = "",
        endpoint: str = "",
        method: str = "GET",
        headers: str = "{}",
    ):
        self.name = name
        self.description = description
        self.instructions = instructions
        self.mcp_type = mcp_type
        self.mcp_endpoint = mcp_endpoint
        self.endpoint = endpoint
        self.method = method
        self.headers = headers
        self._llm = None

    def set_llm(self, llm) -> None:
        self._llm = llm

    async def invoke(self, args: dict) -> str:
        from virtual_team.thinking_tree.registry import registry

        for handler in registry.get_handlers(self.name):
            try:
                result = await handler(self.name, args)
                if isinstance(result, dict) and result.get("error") and not result.get("results"):
                    continue
                return json.dumps(result) if not isinstance(result, str) else result
            except Exception:
                continue

        # HTTP endpoint (user-added custom tools)
        if self.endpoint and self.endpoint.startswith(("http://", "https://")):
            return await self._call_http_endpoint(args)

        # Builtin endpoint
        if self.endpoint and self.endpoint.startswith("builtin://"):
            return await self._call_builtin(args)

        n = self.name.lower()

        if n.startswith("skill_"):
            return (
                self.instructions
                if self.instructions
                else json.dumps(
                    {
                        "role": "skill",
                        "name": self.name,
                        "content": (
                            "This skill provides specialized guidance. "
                            "Follow these instructions to complete the task."
                        ),
                    }
                )
            )

        if n.startswith("mcp_") and (self.mcp_type or self.mcp_endpoint):
            return _execute_mcp(self.name, self.mcp_type, self.mcp_endpoint, args)

        if any(k in n for k in ("weather", "天气")):
            city = args.get("city", "北京")
            return json.dumps(
                {
                    "tool": self.name,
                    "city": city,
                    "temperature": "22°C",
                    "weather": "晴",
                    "humidity": "30%",
                    "wind": "3级",
                }
            )

        if "calculator" in n or "calc" in n:
            expr = args.get("expression") or args.get("expr") or args.get("query") or ""
            if not expr:
                return json.dumps(
                    {
                        "tool": self.name,
                        "error": "No expression provided. "
                        "Pass {'expression': '<math>'} or {'expr': '<math>'}.",
                    }
                )
            try:
                result = eval(expr, {"__builtins__": {}}, {})
                return json.dumps({"tool": self.name, "expression": expr, "result": result})
            except Exception as e:
                return json.dumps({"tool": self.name, "expression": expr, "error": str(e)})

        if "websearch" in n or "search" in n:
            query = args.get("query", "")
            if query:
                try:
                    result = await _web_search(query)
                    return json.dumps({"tool": self.name, "query": query, "results": result})
                except Exception as e:
                    return json.dumps({"tool": self.name, "query": query, "error": str(e)})

        return await self._llm_fallback(args)

    async def _call_http_endpoint(self, args: dict) -> str:
        try:
            hdrs = json.loads(self.headers) if isinstance(self.headers, str) else {}
            hdrs.setdefault("Content-Type", "application/json")
            async with httpx.AsyncClient(timeout=30.0) as client:
                if self.method.upper() == "GET":
                    resp = await client.get(self.endpoint, params=args, headers=hdrs)
                else:
                    resp = await client.post(self.endpoint, json=args, headers=hdrs)
                resp.raise_for_status()
                return resp.text
        except httpx.HTTPStatusError as e:
            return json.dumps({"tool": self.name, "error": f"HTTP {e.response.status_code}: {e.response.text[:500]}"})
        except Exception as e:
            return json.dumps({"tool": self.name, "error": str(e)})

    async def _call_builtin(self, args: dict) -> str:
        action = self.endpoint.replace("builtin://", "")
        if action == "web_search":
            query = args.get("query", "")
            if query:
                try:
                    result = await _web_search(query)
                    return json.dumps({"tool": self.name, "query": query, "results": result})
                except Exception as e:
                    return json.dumps({"tool": self.name, "query": query, "error": str(e)})
        if action in ("calculator", "calc"):
            expr = args.get("expression") or args.get("expr") or ""
            try:
                result = eval(expr, {"__builtins__": {}}, {})
                return json.dumps({"tool": self.name, "expression": expr, "result": result})
            except Exception as e:
                return json.dumps({"tool": self.name, "expression": expr, "error": str(e)})
        if action == "fetch_page":
            url = args.get("url", "")
            if url:
                try:
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        resp = await client.get(url)
                        return resp.text[:2000]
                except Exception as e:
                    return json.dumps({"tool": self.name, "url": url, "error": str(e)})
        return json.dumps({"tool": self.name, "error": f"Unknown builtin action: {action}"})

    async def _llm_fallback(self, args: dict) -> str:
        if self._llm:
            try:
                prompt = (
                    f"You are the '{self.name}' tool. "
                    f"Your description: {self.description or 'No description'}.\n"
                    "Execute this tool call and return ONLY the result "
                    "as plain text or JSON (no markdown, no explanation):\n"
                    f"Arguments: {json.dumps(args, ensure_ascii=False)}\n"
                    "Output:"
                )
                resp = await self._llm.ainvoke([HumanMessage(content=prompt)])
                return resp.content
            except Exception as e:
                return json.dumps({"tool": self.name, "status": "error", "error": str(e)})
        return json.dumps(
            {
                "tool": self.name,
                "status": "executed",
                "note": "no LLM available, falling back",
                "args": args,
            }
        )


async def _web_search(query: str, max_results: int = 5) -> list[dict]:
    """Multi-backend web search with automatic fallback.

    Priority: Tavily → Baidu Qianfan → Bing → simulated stub.
    """

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
            if results and len(results) > 0:
                return results[:max_results]
        except Exception:
            pass

    try:
        results = _bing_search(query, max_results, enrich=True)
        return results[:max_results]
    except Exception:
        pass

    return [{"snippet": f"搜索失败: {query}"}]


def _bing_search(query: str, max_results: int = 5, enrich: bool = False) -> list[dict]:
    import urllib.parse
    import urllib.request

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

    results = []
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
    import gzip
    import urllib.request

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


def _baidu_qianfan_search(query: str, api_key: str, max_results: int = 5) -> list[dict]:
    import json
    import urllib.request

    body = json.dumps(
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
        data = json.loads(resp.read())
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


def _execute_tool(name: str, endpoint: str, args: dict) -> str:
    """Real tool execution: HTTP endpoint + sandboxed code eval."""
    if endpoint:
        if endpoint.startswith("http://") or endpoint.startswith("https://"):
            try:
                body = json.dumps(args).encode()
                req = urllib.request.Request(
                    endpoint, data=body, headers={"Content-Type": "application/json"}, method="POST"
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    return resp.read().decode("utf-8", errors="ignore")[:5000]
            except Exception as e:
                return json.dumps({"error": str(e)})
        else:
            try:
                cmd = [endpoint] + [str(v) for v in args.values()]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                return json.dumps(
                    {
                        "stdout": result.stdout[:3000],
                        "stderr": result.stderr[:500],
                        "rc": result.returncode,
                    }
                )
            except subprocess.TimeoutExpired:
                return json.dumps({"error": "timeout (30s)"})
            except Exception as e:
                return json.dumps({"error": str(e)})
    return json.dumps({"status": "called", "args": args})


def _execute_mcp(tool_name: str, tool_type: str, endpoint: str, args: dict) -> str:
    """MCP execution: stdio=subprocess, sse=HTTP, optional JSON-RPC discovery."""
    if tool_type == "sse" and endpoint:
        try:
            body = json.dumps(
                {
                    "jsonrpc": "2.0",
                    "method": "tools/call",
                    "params": {"name": tool_name, "arguments": args},
                    "id": 1,
                }
            ).encode()
            req = urllib.request.Request(
                endpoint, data=body, headers={"Content-Type": "application/json"}, method="POST"
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8", errors="ignore")[:5000]
        except Exception as e:
            return json.dumps({"error": str(e)})
    elif tool_type == "stdio" and endpoint:
        try:
            cmd = [endpoint] + [str(v) for v in args.values()]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            return json.dumps(
                {
                    "stdout": result.stdout[:3000],
                    "stderr": result.stderr[:500],
                    "rc": result.returncode,
                }
            )
        except subprocess.TimeoutExpired:
            return json.dumps({"error": "timeout (30s)"})
        except Exception as e:
            return json.dumps({"error": str(e)})
    result = _execute_tool(tool_name, endpoint, args)
    logger.debug("MCP fallback to tool execution | tool=%s", tool_name)
    return result


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    system_prompt: str
    session_context: str


class SingleAgentGraph:
    """Builds and runs a ReAct agent graph with DeepSeek thinking support."""

    def __init__(
        self,
        model: str,
        api_key: str,
        base_url: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 65536,
        checkpointer: BaseCheckpointSaver | None = None,
    ):
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.temperature = temperature
        self.max_tokens = max_tokens
        self._run_id = None
        self._last_usage: dict = {}

        # LLM metadata only
        llm_kwargs = {
            "model": model,
            "api_key": api_key,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if base_url:
            llm_kwargs["base_url"] = base_url
        self.llm = ChatOpenAI(**llm_kwargs)

        self._tools: list = []
        self._tool_map: dict = {}
        self._tool_definitions: list[dict] = []
        # Persistent checkpointer — env-controlled (sqlite/postgres/memory)
        if checkpointer is not None:
            self.checkpointer = checkpointer
        else:
            from virtual_team.checkpoint import create_checkpointer

            self.checkpointer = create_checkpointer()
        self._graph = self._build_graph()

        self._stream_cb: Callable | None = None

    async def _raw_llm_stream(self, messages: list[BaseMessage]) -> tuple[str, str, list[dict]]:
        """Async raw HTTP streaming — captures content + reasoning_content + tool_calls.

        Emits on_custom_token / on_custom_thinking events to self._stream_cb in real time.
        Returns (full_content, thinking, tool_calls_list).
        Sets self._last_usage with token usage from the response.
        """
        api_messages = []
        for msg in messages:
            if isinstance(msg, SystemMessage):
                api_messages.append({"role": "system", "content": msg.content})
            elif isinstance(msg, HumanMessage):
                api_messages.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                entry: dict = {"role": "assistant", "content": msg.content}
                if msg.tool_calls:
                    entry["tool_calls"] = [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {"name": tc["name"], "arguments": json.dumps(tc["args"])},
                        }
                        for tc in msg.tool_calls
                    ]
                api_messages.append(entry)
            elif isinstance(msg, ToolMessage):
                api_messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": msg.tool_call_id,
                        "content": msg.content,
                    }
                )

        base_url = (self.base_url or "https://api.deepseek.com").rstrip("/")
        url = f"{base_url}/chat/completions"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

        body: dict = {
            "model": self.model,
            "messages": api_messages,
            "stream": True,
            "stream_options": {"include_usage": True},
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

        if self._tool_definitions:
            body["tools"] = self._tool_definitions
            body["tool_choice"] = "auto"

        is_deepseek = (
            "deepseek" in (self.base_url or "").lower() or "deepseek" in self.model.lower()
        )
        if is_deepseek and not self._tool_definitions:
            body["thinking"] = {"type": "enabled"}

        content_chunks: list[str] = []
        thinking_chunks: list[str] = []
        tool_calls_map: dict[int, dict] = {}
        finish_reason: str | None = None
        _raw_llm_thinking_flushed = False
        _pending_content: list[str] = []
        _tool_calls_seen = False
        usage_info: dict = {}

        cb = self._stream_cb

        logger.info(
            "LLM request | model=%s | msgs=%d | tools=%d | thinking=%s",
            self.model,
            len(api_messages),
            len(self._tool_definitions or []),
            "thinking" in body,
        )
        if self._tool_definitions:
            logger.info(
                "Tools sent: %s",
                json.dumps([t["function"]["name"] for t in self._tool_definitions]),
            )

        try:
            async with (
                httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0), proxy=None) as client,
                client.stream("POST", url, headers=headers, json=body) as response,
            ):
                if response.status_code != 200:
                    body_text = await response.aread()
                    logger.error(
                        "LLM %s %s -> %s: %s",
                        url,
                        body.get("model"),
                        response.status_code,
                        body_text.decode(errors="replace")[:500],
                    )
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    choices = chunk.get("choices", [])
                    if not choices:
                        continue
                    delta = choices[0].get("delta", {})
                    fr = choices[0].get("finish_reason")
                    if fr:
                        finish_reason = fr
                        usage_info = chunk.get("usage", {}) or usage_info

                    rc = delta.get("reasoning_content")
                    if rc:
                        thinking_chunks.append(rc)
                        if cb:
                            try:
                                await cb({"event": "on_custom_thinking", "data": {"content": rc}})
                            except Exception as e:
                                logger.error(
                                    "on_custom_thinking callback failed: %s", e, exc_info=True
                                )

                    content = delta.get("content")
                    if content:
                        if thinking_chunks and not _raw_llm_thinking_flushed:
                            _raw_llm_thinking_flushed = True
                        if _tool_calls_seen:
                            content_chunks.append(content)
                            if cb:
                                await cb({"event": "on_custom_token", "data": {"content": content}})
                        elif not self._tool_definitions:
                            content_chunks.append(content)
                            if cb:
                                await cb({"event": "on_custom_token", "data": {"content": content}})
                        else:
                            _pending_content.append(content)

                    tc_delta = delta.get("tool_calls")
                    if tc_delta:
                        if not _tool_calls_seen:
                            _tool_calls_seen = True
                            _pending_content.clear()
                        for tc in tc_delta:
                            idx = tc.get("index", 0)
                            if idx not in tool_calls_map:
                                tool_calls_map[idx] = {
                                    "id": tc.get("id", ""),
                                    "name": "",
                                    "arguments": "",
                                }
                            fn = tc.get("function", {})
                            if fn.get("name"):
                                tool_calls_map[idx]["name"] += fn["name"]
                            if fn.get("arguments"):
                                tool_calls_map[idx]["arguments"] += fn["arguments"]
                            if tc.get("id"):
                                tool_calls_map[idx]["id"] = tc["id"]

        except httpx.HTTPError as e:
            logger.error("Raw LLM stream failed: %s", e, exc_info=True)
            raise

        if _pending_content and not _tool_calls_seen and self._tool_definitions:
            for chunk in _pending_content:
                content_chunks.append(chunk)
                if cb:
                    await cb({"event": "on_custom_token", "data": {"content": chunk}})
        _pending_content.clear()

        full_content = "".join(content_chunks)
        thinking = "".join(thinking_chunks).strip()

        final_tool_calls = []
        for idx in sorted(tool_calls_map.keys()):
            tc = tool_calls_map[idx]
            if tc["name"]:
                try:
                    args = json.loads(tc["arguments"]) if tc["arguments"] else {}
                except json.JSONDecodeError:
                    args = {}
                final_tool_calls.append({"id": tc["id"], "name": tc["name"], "args": args})

        logger.info(
            "Raw LLM | content=%d chars | thinking=%d chars | tool_calls=%d | finish=%s",
            len(full_content),
            len(thinking),
            len(final_tool_calls),
            finish_reason,
        )
        if final_tool_calls:
            for tc in final_tool_calls:
                logger.info(
                    "  ↳ tool=%s args=%s",
                    tc["name"],
                    json.dumps(tc.get("args", {}), ensure_ascii=False)[:200],
                )
        self._last_usage = usage_info
        return full_content, thinking, final_tool_calls

    def _build_graph(self):
        workflow = StateGraph(AgentState)

        async def _agent_node(state: AgentState) -> dict:
            messages = state.get("messages", [])
            system_prompt = state.get("system_prompt", "")
            session_context = state.get("session_context", "")

            full_messages = []
            now = datetime.now(timezone.utc).astimezone()
            weekday_cn = ["一", "二", "三", "四", "五", "六", "日"][now.weekday()]
            date_context = (
                f"当前日期：{now.year}年{now.month}月{now.day}日 周{weekday_cn} "
                f"{now.hour:02d}:{now.minute:02d}（北京时间 CST）"
            )
            full_messages.append(SystemMessage(content=date_context))
            if system_prompt:
                full_messages.append(SystemMessage(content=system_prompt))
            if session_context:
                full_messages.append(SystemMessage(content=session_context))
            full_messages.extend(messages)

            content, thinking, raw_tool_calls = await self._raw_llm_stream(full_messages)

            kwargs: dict = {"content": content}
            if raw_tool_calls:
                kwargs["tool_calls"] = [
                    {"name": tc["name"], "args": tc["args"], "id": tc["id"]}
                    for tc in raw_tool_calls
                ]
            if thinking:
                kwargs["additional_kwargs"] = {"thinking": thinking}

            # Emit thinking nodes (summary for final answer, full for tool calls)
            if thinking:
                thinking_nodes: list[dict] = [{"type": "thought", "content": thinking}]
                for tc in (raw_tool_calls or []):
                    tc_name = tc.get("name", "")
                    tc_args = tc.get("args", {})
                    thinking_nodes.append({
                        "type": "tool_call",
                        "content": f"Calling {tc_name}",
                        "toolName": tc_name,
                        "toolParams": {k: str(v) for k, v in tc_args.items()} if tc_args else {},
                    })
                if self._stream_cb:
                    await self._stream_cb({
                        "event": "on_thinking_nodes",
                        "data": {"nodes": thinking_nodes},
                    })
            if self._stream_cb:
                await self._stream_cb({"event": "on_node_end", "data": {}})

            return {"messages": [AIMessage(**kwargs)]}

        async def _tools_node(state: AgentState) -> dict:
            messages = state.get("messages", [])
            last_msg = messages[-1] if messages else None
            if not isinstance(last_msg, AIMessage) or not last_msg.tool_calls:
                return {}

            tool_messages = []
            for tc in last_msg.tool_calls:
                tool_name = tc.get("name", "")
                tool_args = tc.get("args", {})
                tool_id = tc.get("id", "")
                fn = self._tool_map.get(tool_name)
                if fn:
                    try:
                        result = await fn.invoke(tool_args)
                    except Exception as e:
                        result = f"Error: {e}"
                else:
                    result = f"Unknown tool: {tool_name}"
                # If result indicates fallback, use graph's LLM directly
                if (
                    fn
                    and isinstance(result, str)
                    and ('"status":' in result or '"status": "' in result)
                ):
                    try:
                        desc = getattr(fn, "description", "") or ""
                        prompt = (
                            f"Tool: {tool_name}\n"
                            f"Description: {desc}\n"
                            f"Args: {json.dumps(tool_args, ensure_ascii=False)}\n"
                            "Execute and return ONLY the result (no markdown):"
                        )
                        llm_result = await self.llm.ainvoke([HumanMessage(content=prompt)])
                        result = llm_result.content
                    except Exception:
                        pass
                print(f"\n[DEBUG] _tools_node: tool={tool_name} result_len={len(str(result or ''))} has_cb={self._stream_cb is not None}")
                if self._stream_cb:
                    result_str = str(result) if result else ""
                    await self._stream_cb({
                        "event": "on_tool_complete",
                        "data": {
                            "toolName": tool_name,
                            "tool_call_id": tool_id,
                            "tool_args": tool_args,
                            "result": result_str[:300],
                            "status": "success" if result_str and not result_str.startswith("Error") else "error",
                        },
                    })
                tool_messages.append(
                    ToolMessage(content=str(result), tool_call_id=tool_id, name=tool_name)
                )
            return {"messages": tool_messages}

        def _should_continue(state: AgentState) -> str:
            messages = state.get("messages", [])
            last_msg = messages[-1] if messages else None
            if isinstance(last_msg, AIMessage) and last_msg.tool_calls:
                return "tools"
            return END

        workflow.add_node("agent", _agent_node)
        workflow.add_node("tools", _tools_node)
        workflow.set_entry_point("agent")
        workflow.add_conditional_edges("agent", _should_continue, {"tools": "tools", END: END})
        workflow.add_edge("tools", "agent")

        return workflow.compile(checkpointer=self.checkpointer)

    def bind_tools(self, tool_configs: list[ToolConfig]) -> None:
        self._tool_definitions = []
        self._tool_map = {}
        for tc in tool_configs:
            params = tc.parameters or {"type": "object"}
            # DeepSeek rejects empty "properties": {} — strip it
            if isinstance(params, dict) and params.get("properties") == {}:
                params = {k: v for k, v in params.items() if k != "properties"}
            self._tool_definitions.append(
                {
                    "type": "function",
                    "function": {
                        "name": tc.name,
                        "description": tc.description,
                        "parameters": params,
                    },
                }
            )
            wrapper = _ToolWrapper(
                tc.name,
                description=tc.description,
                instructions=getattr(tc, "instructions", ""),
                mcp_type=getattr(tc, "mcp_type", ""),
                mcp_endpoint=getattr(tc, "mcp_endpoint", ""),
                endpoint=getattr(tc, "endpoint", ""),
                method=getattr(tc, "method", "GET"),
                headers=getattr(tc, "headers", "{}"),
            )
            wrapper.set_llm(self.llm)
            self._tool_map[tc.name] = wrapper

    async def run(
        self,
        system_prompt: str,
        user_input: str,
        thread_id: str,
        session_context: str = "",
        chat_history: list[BaseMessage] | None = None,
        stream_callback: Callable | None = None,
    ) -> dict:
        self._stream_cb = stream_callback
        self._run_id = thread_id

        config: dict = {
            "configurable": {"thread_id": thread_id},
            "recursion_limit": 25,
        }

        messages: list[BaseMessage] = list(chat_history or [])
        messages.append(HumanMessage(content=user_input))
        initial_state: AgentState = {
            "messages": messages,
            "system_prompt": system_prompt,
            "session_context": session_context,
        }

        final_state = None
        async for event in self._graph.astream_events(initial_state, config=config, version="v2"):  # type: ignore[call-overload]
            kind = event.get("event", "")
            if stream_callback and kind in ("on_chain_end", "on_chain_start"):
                await stream_callback(event)
            if kind == "on_chain_end" and event.get("name") == "LangGraph":
                output = event.get("data", {}).get("output", {})
                if output:
                    final_state = output

        self._stream_cb = None

        if final_state:
            msgs = final_state.get("messages", [])
            final_text = ""
            all_tool_calls: list[dict] = []
            for msg in msgs:
                if isinstance(msg, AIMessage):
                    if msg.content:
                        final_text = msg.content
                    if msg.tool_calls:
                        all_tool_calls.extend(
                            {"name": tc.get("name"), "args": tc.get("args")}
                            for tc in msg.tool_calls
                        )
            return {
                "response": final_text,
                "tool_calls": all_tool_calls,
                "message_count": len(msgs),
            }

        return {"response": "", "tool_calls": [], "message_count": 0}

    def invoke_sync(
        self, system_prompt: str, user_input: str, thread_id: str, session_context: str = ""
    ) -> dict:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(
                    lambda: asyncio.run(
                        self.run(
                            system_prompt=system_prompt,
                            user_input=user_input,
                            thread_id=thread_id,
                            session_context=session_context,
                        )
                    )
                )
                return future.result()
        else:
            return asyncio.run(
                self.run(
                    system_prompt=system_prompt,
                    user_input=user_input,
                    thread_id=thread_id,
                    session_context=session_context,
                )
            )


# Default tools for CLI usage
DEFAULT_TOOLS: list[ToolConfig] = [
    ToolConfig(
        name="web_search",
        description="Search the web for current information. Finds recent news, facts, and data.",
        parameters={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query",
                }
            },
            "required": ["query"],
        },
    ),
    ToolConfig(
        name="calculator",
        description="Evaluate math expressions: +, -, *, /, **, %, sqrt, sin, cos.",
        parameters={
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "The mathematical expression to evaluate",
                }
            },
            "required": ["expression"],
        },
    ),
    ToolConfig(
        name="fetch_page",
        description="Fetch and read the content of a web page.",
        parameters={
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The URL to fetch",
                }
            },
            "required": ["url"],
        },
    ),
]
