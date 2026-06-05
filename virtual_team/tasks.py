"""Celery tasks — LangGraph-powered single-agent execution."""

import asyncio
import contextlib
import logging

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from virtual_team.broker import celery_app, publish_run_message
from virtual_team.config import load_config
from virtual_team.mock_fallback import ENABLE as ENABLE_MOCK_FALLBACK
from virtual_team.mock_fallback import run_mock
from virtual_team.repository import (
    create_memory_entry,
    get_agent_config,
    get_run_messages,
    get_session_memories,
    get_session_messages,
    update_run_result,
    update_run_status,
)
from virtual_team.streaming import StreamEmitter

logger = logging.getLogger(__name__)


def _run_async(coro):
    return asyncio.run(coro)


def _build_session_context(memories) -> str:
    if not memories:
        return ""
    lines = ["\n\n【历史上下文】"]
    for m in memories:
        lines.append(f"- [{m.content_type}] {m.agent_role}: {m.summary}")
    return "\n".join(lines)


async def _get_rag_context(query: str, session_id: str) -> str:
    try:
        from virtual_team.rag import ensure_embedding_provider, retrieve_context
        from virtual_team.repository.keys import get_embedding_api_key
        api_key = await get_embedding_api_key()
        ensure_embedding_provider(api_key)
        return await retrieve_context(query=query, session_id=session_id, top_k=3)
    except Exception:
        return ""


async def _save_output_memories(session_id: str, run_id: str, response: str, metadata: dict, user_id: str = "default"):
    summary = response[:200].replace("\n", " ")
    content_type = "code"
    if "<pm_document>" in response or "需求分析" in response:
        content_type = "pm_document"
    elif "<review>" in response or "问题" in response or "bug" in response.lower():
        content_type = "review"
    try:
        await create_memory_entry(
            session_id=session_id, run_id=run_id, agent_role="agent",
            content_type=content_type, summary=summary, details=response[:2000],
            user_id=user_id,
        )
    except Exception:
        logger.exception("Failed to save memory for run %s", run_id)


async def _run_agent_pipeline(
    requirement: str, run_id: str, session_id: str | None, agent_id: str | None,
    api_key: str | None = None, api_base: str | None = None, model: str | None = None,
    user_id: str = "default",
) -> dict:
    await update_run_status(run_id, "running")
    cfg = load_config()
    effective_api_key = api_key or cfg.api_key
    effective_api_base = api_base or cfg.api_base
    effective_model = model or cfg.model

    system_prompt = "你是一个智能助手，负责理解用户需求并完成任务。"
    if agent_id:
        try:
            ac = await get_agent_config(agent_id)
            if ac:
                system_prompt = ac.system_prompt
                if ac.output_constraints:
                    system_prompt += f"\n\n输出约束：{ac.output_constraints}"
                if ac.model:
                    effective_model = ac.model
        except Exception:
            pass

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

    # ── Short-term memory: collect previous conversation messages ──
    chat_history: list[BaseMessage] = []
    if session_id:
        try:
            prev_msgs = await get_session_messages(session_id, exclude_run_id=run_id)
            for m in prev_msgs:
                if m.role == "user":
                    chat_history.append(HumanMessage(content=m.content))
                elif m.role == "agent":
                    chat_history.append(AIMessage(content=m.content))
        except Exception:
            logger.warning("Failed to load chat history for session %s", session_id)

    from virtual_team.agent_graph import SingleAgentGraph
    emitter = StreamEmitter(run_id)
    graph = SingleAgentGraph(
        model=effective_model,
        api_key=effective_api_key,
        base_url=effective_api_base,
    )
    result = await graph.run(
        system_prompt=system_prompt,
        user_input=requirement,
        thread_id=run_id,
        session_context=session_context,
        chat_history=chat_history,
        stream_callback=emitter,
    )

    response = result.get("response", "")
    tool_calls = result.get("tool_calls", [])
    review_summary = (
        f"Agent completed successfully with {result.get('message_count', 0)} messages "
        f"and {len(tool_calls)} tool call(s)."
    )

    await update_run_result(
        run_id=run_id, pm_document="", code=response, review=review_summary,
        approved=True, status="converged",
    )
    await publish_run_message(run_id, {
        "type": "result", "status": "completed", "approved": True,
        "pm_document": "", "code": response, "review": review_summary,
    })

    if session_id:
        try:
            await _save_output_memories(session_id, run_id, response, {"tool_calls": tool_calls}, user_id=user_id)
            from virtual_team.rag import ingest_session_messages
            messages = await get_run_messages(run_id)
            if messages:
                msg_dicts = [{"content": m.content, "role": m.role, "agent_name": m.agent_name} for m in messages]
                await ingest_session_messages(session_id, run_id, msg_dicts)
        except Exception:
            logger.exception("RAG/memory save failed for run %s", run_id)

    logger.info("Agent completed | run=%s | msgs=%d | tools=%d",
                run_id, result.get("message_count", 0), len(tool_calls))
    return {"run_id": run_id, "status": "completed"}


@celery_app.task(bind=True, max_retries=2, default_retry_delay=5)
def run_agent(
    self, requirement: str, run_id: str | None = None, session_id: str | None = None,
    agent_id: str | None = None, api_key: str | None = None,
    api_base: str | None = None, model: str | None = None,
    user_id: str = "default",
):
    logger.info("Agent task | run=%s | session=%s | agent=%s | user=%s", run_id, session_id, agent_id, user_id)
    assert run_id is not None, "run_id must be provided"

    try:
        return _run_async(_run_agent_pipeline(
            requirement, run_id, session_id, agent_id,
            api_key=api_key, api_base=api_base, model=model, user_id=user_id,
        ))
    except Exception as exc:
        logger.exception("Agent failed | run=%s", run_id)

        if ENABLE_MOCK_FALLBACK:
            logger.warning("Mock fallback for run=%s", run_id)
            try:
                output = _run_async(run_mock(requirement, run_id, session_id))
                _run_async(update_run_result(
                    run_id=run_id, pm_document="", code=output.response,
                    review="LangGraph fallback", approved=True, status="converged",
                ))
                _run_async(publish_run_message(run_id, {
                    "type": "result", "status": "completed", "approved": True,
                    "pm_document": "", "code": output.response, "review": "LangGraph fallback",
                }))
                if session_id:
                    with contextlib.suppress(Exception):
                        _run_async(_save_output_memories(session_id, run_id, output.response, {}, user_id=user_id))
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

        try:
            _run_async(update_run_status(run_id, "error"))
            _run_async(publish_run_message(run_id, {
                "type": "status", "status": "error", "error": str(exc),
            }))
        except Exception:
            pass
        self.retry(exc=exc)
