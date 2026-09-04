"""LangGraph 工具节点（从 SingleAgentGraph._tools_node 提取）。

单一职责：执行工具调用、记录追踪 span、处理 LLM 工具回退。"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from cost.llm_span_recorder import record_llm_span, summarize_body
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from core.infra.logging_config import get_logger
from services.thinking_chain import format_result_preview, get_tool_prefix

logger = get_logger(__name__)


async def tools_node(graph: Any, state: Any) -> dict[str, Any]:
    """LangGraph 工具节点——执行工具调用。"""
    messages = state.get("messages", [])
    last_msg = messages[-1] if messages else None
    if not isinstance(last_msg, AIMessage) or not last_msg.tool_calls:
        return {}

    tool_messages = []
    for tc in last_msg.tool_calls:
        tool_name = tc.get("name", "")
        tool_args = tc.get("args", {})
        tool_id = tc.get("id", "")
        fn = graph._tool_map.get(tool_name)

        if graph._stream_cb:
            prefix = get_tool_prefix(tool_name)
            args_preview = json.dumps(tool_args, ensure_ascii=False)[:200]
            await graph._stream_cb({
                "event": "on_custom_thinking",
                "data": {"content": f"{prefix} {tool_name}({args_preview})"},
            })

        _tool_start = datetime.now(UTC)
        if fn:
            try:
                result = await fn.invoke(tool_args)
            except Exception as e:
                result = f"Error: {e}"
        else:
            result = f"Unknown tool: {tool_name}"
        if graph._trace_root_id:
            try:
                _dur_ms = int((datetime.now(UTC) - _tool_start).total_seconds() * 1000)
                await record_llm_span(
                    run_id=graph._run_id or "",
                    session_id=graph._trace_session_id,
                    node_id=f"{graph._trace_node_id}.{tool_name}",
                    model=graph.model,
                    prompt_tokens=0,
                    completion_tokens=0,
                    duration_ms=_dur_ms,
                    status="success",
                    parent_span_id=graph._trace_root_id,
                    input_snapshot=summarize_body({"tool": tool_name, "args": tool_args}),
                    output_snapshot=str(result or "")[:4000],
                    team_id=graph._trace_team_id,
                    user_id=graph._trace_user_id,
                    key_id=graph._trace_key_id,
                )
            except Exception:  # noqa: BLE001
                logger.warning("trace: failed to record tool span", exc_info=True)
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
                t0 = datetime.now(UTC)
                llm_result = await graph.llm.ainvoke([HumanMessage(content=prompt)])
                elapsed = (datetime.now(UTC) - t0).total_seconds()
                result = str(llm_result.content) if llm_result.content else ""
                logger.info(
                    "LLM tool-fallback | model=%s | tool=%s | elapsed=%.2fs | result_len=%d",
                    graph.model, tool_name, elapsed, len(result or ""),
                )
            except Exception as exc:
                logger.warning("LLM tool-fallback failed | tool=%s | error=%s", tool_name, exc)
        logger.info(
            "Tool result | tool=%s | result_len=%d | has_cb=%s",
            tool_name, len(str(result or "")), graph._stream_cb is not None,
        )

        tool_messages.append(
            ToolMessage(content=str(result or ""), tool_call_id=tool_id, name=tool_name)
        )

        if graph._stream_cb:
            result_preview = format_result_preview(result)
            await graph._stream_cb({
                "event": "on_custom_thinking",
                "data": {"content": f"[result] {tool_name} → {result_preview}"},
            })
    if graph._stream_cb:
        await graph._stream_cb({"event": "on_node_end", "data": {}})
    return {"messages": tool_messages}
