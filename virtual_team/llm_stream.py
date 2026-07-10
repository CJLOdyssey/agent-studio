"""LLM streaming helpers: message conversion + SSE parsing."""

from __future__ import annotations

import contextlib
import json
from typing import Any

import httpx
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)


def convert_messages_to_api(messages: list[BaseMessage]) -> list[dict]:
    """Convert LangChain BaseMessage list to OpenAI API message dicts."""
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
            api_messages.append({"role": "tool", "tool_call_id": msg.tool_call_id, "content": msg.content})
    return api_messages


def build_tool_calls_list(tool_calls_map: dict[int, dict]) -> list[dict]:
    """Consolidate streaming tool-call fragments into final list."""
    final = []
    for idx in sorted(tool_calls_map):
        tc = tool_calls_map[idx]
        if tc["name"]:
            try:
                args = json.loads(tc["arguments"]) if tc["arguments"] else {}
            except json.JSONDecodeError:
                args = {}
            final.append({"id": tc["id"], "name": tc["name"], "args": args})
    return final


async def stream_llm_response(
    url: str,
    headers: dict,
    body: dict,
    stream_cb: Any = None,
    tool_definitions: list[dict] | None = None,
) -> tuple[list[str], list[str], dict[int, dict], str | None, dict]:
    """Stream SSE from the LLM endpoint, parse chunks, emit callbacks.

    Returns (content_chunks, thinking_chunks, tool_calls_map, finish_reason, usage_info).
    """
    content_chunks: list[str] = []
    thinking_chunks: list[str] = []
    tool_calls_map: dict[int, dict] = {}
    finish_reason: str | None = None
    _thinking_flushed = False
    _pending_content: list[str] = []
    _tool_calls_seen = False
    usage_info: dict = {}

    try:
        async with (
            httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0), proxy=None) as client,
            client.stream("POST", url, headers=headers, json=body) as response,
        ):
            if response.status_code != 200:
                body_text = await response.aread()
                error_body = body_text.decode(errors="replace")[:1000]
                print(f"\n[DEEPSEEK ERROR] status={response.status_code} body={error_body}\n", flush=True)
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
                    if stream_cb:
                        with contextlib.suppress(Exception):
                            await stream_cb({"event": "on_custom_thinking", "data": {"content": rc}})

                content = delta.get("content")
                if content:
                    if thinking_chunks and not _thinking_flushed:
                        _thinking_flushed = True
                    if _tool_calls_seen or not tool_definitions:
                        content_chunks.append(content)
                        if stream_cb:
                            await stream_cb({"event": "on_custom_token", "data": {"content": content}})
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
                            tool_calls_map[idx] = {"id": tc.get("id", ""), "name": "", "arguments": ""}
                        fn = tc.get("function", {})
                        if fn.get("name"):
                            tool_calls_map[idx]["name"] += fn["name"]
                        if fn.get("arguments"):
                            tool_calls_map[idx]["arguments"] += fn["arguments"]
                        if tc.get("id"):
                            tool_calls_map[idx]["id"] = tc["id"]

    except httpx.HTTPError:
        import logging
        logging.getLogger(__name__).error("Raw LLM stream failed", exc_info=True)
        raise

    if _pending_content and not _tool_calls_seen and tool_definitions:
        for chunk in _pending_content:
            content_chunks.append(chunk)
            if stream_cb:
                await stream_cb({"event": "on_custom_token", "data": {"content": chunk}})
    _pending_content.clear()

    return content_chunks, thinking_chunks, tool_calls_map, finish_reason, usage_info
