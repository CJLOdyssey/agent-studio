"""
Celery tasks — LangGraph-powered agent execution.

Single-agent task uses LangGraph's agent graph with:
  - Built-in checkpointing (SqliteSaver/MemorySaver)
  - Native streaming via astream_events
  - LangChain tool calling
"""

import asyncio
import contextlib
import logging
import os

from virtual_team.broker import celery_app, publish_run_message
from virtual_team.config import load_config
from virtual_team.repository import (
    get_agent_config,
    get_run_messages,
    get_session_memories,
    save_message,
    update_run_result,
    update_run_status,
)

logger = logging.getLogger(__name__)

# ── Feature flags ─────────────────────────────────────────────────────────────

ENABLE_MOCK_FALLBACK = os.environ.get("ENABLE_MOCK_FALLBACK", "0") == "1"

# ── Event loop helpers ───────────────────────────────────────────────────────

def _run_async(coro):
    """Safely run an async coroutine inside a Celery task.

    Creates a fresh event loop per invocation to avoid cross-task
    contamination in multi-process worker pools.
    """
    return asyncio.run(coro)


# ── Streaming emitter ────────────────────────────────────────────────────────

class _StreamEmitter:
    """Bridges LangGraph streaming events to Redis pub/sub + DB persistence.

    Since LangGraph's astream_events yields events inside an async loop,
    the emitter uses native async/await rather than manual loop management.
    """

    def __init__(self, run_id: str):
        self._run_id = run_id
        self._message_index = 0  # Per-event sequence, not conversational "round"

    async def __call__(self, event: dict):
        kind = event.get("event", "")
        data = event.get("data", {})

        if kind == "on_chat_model_stream":
            chunk = data.get("chunk")
            if chunk and hasattr(chunk, "content") and chunk.content:
                await self._emit("Agent", chunk.content, msg_type="stream")

        elif kind == "on_tool_start":
            tool_name = event.get("name", "tool")
            tool_input = data.get("input", "")
            await self._emit("Agent", f"\U0001f527 调用工具: {tool_name}({str(tool_input)[:200]})")

        elif kind == "on_tool_end":
            tool_name = event.get("name", "tool")
            output = str(data.get("output", ""))[:500]
            await self._emit("Agent", f"\U0001f441 {tool_name} 返回: {output}")

    async def _emit(self, agent_name: str, content: str, msg_type: str = "message"):
        self._message_index += 1
        payload = {
            "type": msg_type,
            "role": agent_name,
            "agent_name": agent_name,
            "content": content,
            "round_number": self._message_index,
        }
        try:
            await publish_run_message(self._run_id, payload)
            if msg_type == "message":
                await save_message(
                    run_id=self._run_id,
                    role=agent_name,
                    agent_name=agent_name,
                    content=content,
                    round_number=self._message_index,
                )
        except Exception:
            logger.exception("Stream emit failed for run %s", self._run_id)


# ── Session context ──────────────────────────────────────────────────────────

def _build_session_context(memories) -> str:
    if not memories:
        return ""
    lines = ["\n\n【历史上下文】"]
    for m in memories:
        lines.append(f"- [{m.content_type}] {m.agent_role}: {m.summary}")
    return "\n".join(lines)


async def _get_rag_context(query: str, session_id: str) -> str:
    try:
        from virtual_team.rag import retrieve_context
        return await retrieve_context(query=query, session_id=session_id, top_k=3)
    except Exception:
        return ""


# ── Memory persistence ───────────────────────────────────────────────────────

async def _save_output_memories(session_id: str, run_id: str, response: str, metadata: dict):
    from virtual_team.repository import create_memory_entry

    summary = response[:200].replace("\n", " ")
    try:
        await create_memory_entry(
            session_id=session_id,
            run_id=run_id,
            agent_role="agent",
            content_type="code",
            summary=summary,
            details=response[:2000],
        )
    except Exception:
        logger.exception("Failed to save memory for run %s", run_id)


# ── Mock fallback (opt-in only) ──────────────────────────────────────────────

async def _run_mock_discussion(requirement: str, run_id: str, session_id: str | None):
    """Simulate agent discussion — only used when ENABLE_MOCK_FALLBACK=1."""
    emitter = _StreamEmitter(run_id)

    messages = [
        f"收到需求：{requirement[:100]}",
        "正在分析需求...",
        "根据分析，这是一个标准的软件开发需求。需要明确输入输出和边界条件。",
        "建议采用模块化设计，优先实现核心功能。",
        "需求分析完成。请提供更多细节或确认开始开发。",
    ]
    for msg in messages:
        await emitter._emit("Agent", msg)
        await asyncio.sleep(0.5)

    from dataclasses import dataclass

    @dataclass
    class MockOutput:
        response: str = ""
        status: str = "converged"
        approved: bool = False

    return MockOutput(response="\n".join(messages), approved=True)


# ── Main async pipeline ──────────────────────────────────────────────────────

async def _run_agent_pipeline(
    requirement: str,
    run_id: str,
    session_id: str | None,
    agent_id: str | None,
    api_key: str | None = None,
    api_base: str | None = None,
    model: str | None = None,
) -> dict:
    """Async core of the agent execution pipeline.

    Uses api_key/api_base/model from the frontend request if provided;
    falls back to server environment variables.
    """

    # 1. Mark running
    await update_run_status(run_id, "running")

    # 2. Load config (server-side fallback)
    cfg = load_config()

    # Use frontend-provided credentials if available, else server env vars
    effective_api_key = api_key or cfg.api_key
    effective_api_base = api_base or cfg.api_base
    effective_model = model or cfg.model

    # 3. Load agent system prompt
    system_prompt = "你是一个智能助手，负责理解用户需求并完成任务。"
    if agent_id:
        try:
            ac = await get_agent_config(agent_id)
            if ac:
                system_prompt = ac.system_prompt
                if ac.model:
                    effective_model = ac.model
        except Exception:
            pass

    # 4. RAG context
    session_context = ""
    if session_id:
        try:
            memories = await get_session_memories(session_id)
            if memories:
                session_context = _build_session_context(memories)
            rag_ctx = await _get_rag_context(requirement, session_id)
            if rag_ctx:
                session_context += "\n" + rag_ctx
        except Exception:
            pass

    # 5. Build agent graph with frontend-provided credentials
    from virtual_team.agent_graph import DEFAULT_TOOLS, SingleAgentGraph

    graph = SingleAgentGraph(
        model=effective_model,
        api_key=effective_api_key,
        base_url=effective_api_base,
        temperature=cfg.temperature,
    )
    graph.set_tools(DEFAULT_TOOLS)

    # 6. Run LangGraph agent with streaming
    emitter = _StreamEmitter(run_id)
    result = await graph.run(
        system_prompt=system_prompt,
        user_input=requirement,
        thread_id=session_id or run_id or "default",
        session_context=session_context,
        stream_callback=emitter,
    )

    response = result.get("response", "")
    tool_calls = result.get("tool_calls", [])

    # Build a meaningful review summary for the single-agent flow
    review_summary = (
        f"Agent completed successfully with {result.get('message_count', 0)} messages "
        f"and {len(tool_calls)} tool call(s)."
    )

    # 7. Save results — field mapping for single-agent pipeline:
    #    pm_document = requirement analysis (no separate PM phase in ReAct agent)
    #    code        = the agent's final response
    #    review      = execution summary
    await update_run_result(
        run_id=run_id,
        pm_document=requirement,
        code=response,
        review=review_summary,
        approved=True,
        status="converged",
    )
    await publish_run_message(run_id, {
        "type": "result",
        "status": "completed",
        "approved": True,
        "pm_document": requirement,
        "code": response,
        "review": review_summary,
    })

    # 8. Save memories + RAG ingestion
    if session_id:
        try:
            await _save_output_memories(session_id, run_id, response, {"tool_calls": tool_calls})
            from virtual_team.rag import ingest_session_messages
            messages = await get_run_messages(run_id)
            if messages:
                msg_dicts = [{"content": m.content, "role": m.role, "agent_name": m.agent_name} for m in messages]
                await ingest_session_messages(session_id, run_id, msg_dicts)
        except Exception:
            logger.exception("RAG/memory save failed for run %s", run_id)

    logger.info("LangGraph agent completed | run=%s | msgs=%d | tools=%d",
                run_id, result.get("message_count", 0), len(tool_calls))
    return {"run_id": run_id, "status": "completed"}


# ── Celery task entry point ─────────────────────────────────────────────────

@celery_app.task(bind=True, max_retries=2, default_retry_delay=5)
def run_agent(
    self,
    requirement: str,
    run_id: str | None = None,
    session_id: str | None = None,
    agent_id: str | None = None,
    api_key: str | None = None,
    api_base: str | None = None,
    model: str | None = None,
):
    """
    Run a single agent with the complete pipeline:
      1. Load session + system prompt
      2. Retrieve RAG context
      3. Run LangGraph ReAct agent
      4. Stream output via Redis
      5. Save results to DB
      6. Ingest into RAG pipeline
    """
    logger.info("LangGraph agent task | run=%s | session=%s | agent=%s", run_id, session_id, agent_id)

    assert run_id is not None, "run_id must be provided"
    try:
        return _run_async(_run_agent_pipeline(
            requirement, run_id, session_id, agent_id,
            api_key=api_key, api_base=api_base, model=model,
        ))

    except Exception as exc:
        logger.exception("LangGraph agent failed | run=%s", run_id)

        # Mock fallback — opt-in only via ENABLE_MOCK_FALLBACK env var
        if ENABLE_MOCK_FALLBACK:
            logger.warning("Mock fallback enabled — using simulated response for run=%s", run_id)
            try:
                output = _run_async(_run_mock_discussion(requirement, run_id, session_id))
                _run_async(update_run_result(
                    run_id=run_id,
                    pm_document="Mock fallback",
                    code=output.response,
                    review="LangGraph 调用失败，使用了模拟回复",
                    approved=True,
                    status="converged",
                ))
                _run_async(publish_run_message(run_id, {
                    "type": "result", "status": "completed", "approved": True,
                    "pm_document": "Mock fallback",
                    "code": output.response,
                    "review": "LangGraph fallback",
                }))
                if session_id:
                    with contextlib.suppress(Exception):
                        _run_async(_save_output_memories(session_id, run_id, output.response, {}))
                return {"run_id": run_id, "status": "completed", "fallback": True}
            except Exception as mock_exc:
                logger.exception("Mock fallback also failed for run=%s", run_id)
                try:
                    _run_async(update_run_status(run_id, "error"))
                    _run_async(publish_run_message(run_id, {
                        "type": "status", "status": "error", "error": str(exc),
                    }))
                except Exception:
                    pass
                self.retry(exc=mock_exc)

        # No fallback — mark as error and retry
        try:
            _run_async(update_run_status(run_id, "error"))
            _run_async(publish_run_message(run_id, {
                "type": "status", "status": "error", "error": str(exc),
            }))
        except Exception:
            pass
        self.retry(exc=exc)
