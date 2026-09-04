"""原始 LLM 流式输出（从 SingleAgentGraph._raw_llm_stream 提取）。

单一职责：构造请求、调用流式 API、记录追踪 span。"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import httpx
from cost.llm_span_recorder import record_llm_span, summarize_body
from langchain_core.messages import BaseMessage

from core._interfaces import StreamResponseHandler
from core.infra.logging_config import get_logger
from graph.helpers import emit_balance_warning, is_balance_error
from streaming.llm_stream import (
    build_llm_request_body,
    build_tool_calls_list,
    convert_messages_to_api,
    stream_llm_response,
)

logger = get_logger(__name__)


async def raw_llm_stream(
    graph: Any,
    messages: list[BaseMessage],
    _stream_handler: StreamResponseHandler = stream_llm_response,
) -> tuple[str, str, list[dict[str, Any]]]:
    """异步原始 HTTP 流式输出——捕获 content + reasoning_content + tool_calls。"""
    graph._span_start = datetime.now(UTC)
    api_messages = convert_messages_to_api(messages)
    url, headers, body = build_llm_request_body(
        api_messages,
        model=graph.model,
        api_key=graph.api_key,
        base_url=graph.base_url,
        temperature=graph.temperature,
        max_tokens=graph.max_tokens,
        tool_definitions=graph._tool_definitions,
    )

    try:
        content_chunks, thinking_chunks, tool_calls_map, finish_reason, usage_info = (
            await _stream_handler(url, headers, body, graph._stream_cb, graph._tool_definitions)
        )
    except httpx.HTTPStatusError as exc:
        error_detail = ""
        if exc.response is not None:
            try:
                error_detail = exc.response.text[:1000]
            except Exception:
                error_detail = str(exc)[:1000]
        logger.error("LLM API rejected request | status=%s | body=%s",
                     exc.response.status_code if exc.response else "?", error_detail)

        if is_balance_error(error_detail) and graph._stream_cb:
            await emit_balance_warning(graph._stream_cb)

        raise

    full_content = "".join(content_chunks)
    thinking = "".join(thinking_chunks).strip()

    final_tool_calls = build_tool_calls_list(tool_calls_map)

    logger.info(
        "Raw LLM | content=%d chars | thinking=%d chars | tool_calls=%d | finish=%s",
        len(full_content), len(thinking), len(final_tool_calls), finish_reason,
    )
    if final_tool_calls:
        for tc in final_tool_calls:
            logger.info(
                "  tool=%s args=%s",
                tc["name"],
                json.dumps(tc.get("args", {}), ensure_ascii=False)[:200],
            )
    graph._last_usage = usage_info

    if graph._trace_root_id:
        try:
            prompt_tok = int(
                (usage_info or {}).get("prompt_tokens")
                or (usage_info or {}).get("input_tokens")
                or 0
            )
            completion_tok = int(
                (usage_info or {}).get("completion_tokens")
                or (usage_info or {}).get("output_tokens")
                or 0
            )
            dur_ms = int((datetime.now(UTC) - graph._span_start).total_seconds() * 1000)
            await record_llm_span(
                run_id=graph._run_id or "",
                session_id=graph._trace_session_id,
                node_id=graph._trace_node_id,
                model=graph.model,
                prompt_tokens=prompt_tok,
                completion_tokens=completion_tok,
                duration_ms=dur_ms,
                status="success",
                parent_span_id=graph._trace_root_id,
                input_snapshot=summarize_body({"messages": [getattr(m, "content", str(m)) for m in messages]}),
                output_snapshot=full_content[:4000],
                team_id=graph._trace_team_id,
                user_id=graph._trace_user_id,
                key_id=graph._trace_key_id,
            )
        except Exception:  # noqa: BLE001
            logger.warning("trace: failed to record LLM span", exc_info=True)
    return full_content, thinking, final_tool_calls
