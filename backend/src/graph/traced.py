"""带追踪的 agent 运行循环（从 SingleAgentGraph.run_traced 提取）。

单一职责：在进程内复现 agent↔tools 循环，产出真实 span 树。"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from cost.llm_span_recorder import close_node_span, open_node_span
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from core.infra.logging_config import get_logger

logger = get_logger(__name__)


async def run_traced(
    graph: Any,
    *,
    requirement: str,
    system_prompt: str = "",
    session_context: str = "",
    chat_history: list[Any] | None = None,
    thread_id: str = "",
    run_id: str = "",
    session_id: str | None = None,
    team_id: str | None = None,
    user_id: str | None = None,
    key_id: str | None = None,
    node_id: str = "agent",
) -> dict[str, Any]:
    """带追踪的运行（粒度 B）。

    在进程内复现 agent↔tools 的 LangGraph 循环，从而产出一棵以单个
    ``agent`` span 为根的真实 span 树：每次 LLM 流式输出与每次工具执行
    都记录为子 span（Langfuse 结构）。流式事件通过复用
    ``_agent_node``/``_tools_node`` 得以保留。
    """
    if run_id:
        for wrapper in graph._tool_map.values():
            wrapper.set_run_id(run_id)
    graph._run_id = run_id
    graph._trace_session_id = session_id
    graph._trace_team_id = team_id
    graph._trace_user_id = user_id
    graph._trace_key_id = key_id
    graph._trace_node_id = node_id

    messages: list[BaseMessage] = list(chat_history) if chat_history else []
    messages.append(HumanMessage(content=requirement))
    state: dict[str, Any] = {
        "messages": messages,
        "system_prompt": system_prompt,
        "session_context": session_context,
    }
    root_id: str | None = None
    status = "success"
    error: str | None = None
    root_start = datetime.now(UTC)
    try:
        if run_id:
            is_generic_chat = not node_id or node_id == "chat"
            root_id = await open_node_span(
                run_id=run_id, session_id=session_id, node_id=node_id,
                span_type="chat" if is_generic_chat else "agent",
                model=graph.model, team_id=team_id,
                user_id=user_id, key_id=key_id,
            )
            graph._trace_root_id = root_id

        rounds = 0
        while rounds < 100:
            rounds += 1
            out = await graph._agent_node(state)
            new_msgs = out.get("messages", [])
            if new_msgs:
                messages.extend(new_msgs)
                state["messages"] = messages
            last = messages[-1] if messages else None
            if not (isinstance(last, AIMessage) and last.tool_calls):
                break
            tools_out = await graph._tools_node(state)
            if tools_out.get("messages"):
                messages.extend(tools_out["messages"])
                state["messages"] = messages
    except Exception as exc:  # noqa: BLE001
        status = "error"
        error = str(exc)[:1000]
        logger.warning("run_traced failed | run=%s | error=%s", run_id, error)
        raise
    finally:
        graph._trace_root_id = None
        if root_id and run_id:
            try:
                usage = graph._last_usage or {}
                pt = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
                ct = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
                dur_ms = int((datetime.now(UTC) - root_start).total_seconds() * 1000)
                from graph.helpers import as_text

                in_text = next(
                    (m.content for m in messages if isinstance(m, HumanMessage) and m.content),
                    None,
                )
                out_text = next(
                    (m.content for m in reversed(messages) if isinstance(m, AIMessage) and m.content),
                    None,
                )
                await close_node_span(
                    root_id, prompt_tokens=pt, completion_tokens=ct, cost_usd=0.0,
                    duration_ms=dur_ms, status=status, error=error, model=graph.model,
                    input_snapshot=as_text(in_text),
                    output_snapshot=as_text(out_text),
                )
            except Exception:  # noqa: BLE001
                logger.warning("trace: failed to close root span", exc_info=True)

    usage = graph._last_usage or {}
    return {
        "messages": messages,
        "input_tokens": usage.get("input_tokens") or usage.get("prompt_tokens", 0),
        "output_tokens": usage.get("output_tokens") or usage.get("completion_tokens", 0),
        "model": graph.model,
    }
