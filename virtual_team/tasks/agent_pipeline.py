"""Single-agent pipeline — tool discovery, RAG context, and graph execution."""

# ruff: noqa: E402 — imports after tracemalloc setup are intentional
import contextlib
import gc
import json
import tracemalloc
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from virtual_team.broker import publish_run_message
from virtual_team.checkpoint import create_checkpointer_async
from virtual_team.config import load_config
from virtual_team.graph import SingleAgentGraph
from virtual_team.logging_config import get_logger
from virtual_team.repository import (
    get_agent_config,
    get_mcps,
    get_session_memories,
    get_session_messages,
    get_skills,
    get_tools,
    update_run_result,
    update_run_status,
)
from virtual_team.repository.keys import log_key_usage
from virtual_team.streaming import StreamEmitter
from virtual_team.tool_config import ToolConfig

from .helpers import (
    _build_session_context,
    _discover_mcp_tools,
    _get_rag_context,
    _parse_json_field,
    _save_output_memories,
    log_memory_diff,
)
from .mcp_executor import exec_stdio_mcp

logger = get_logger(__name__)

_run_counter = 0


async def _run_agent_pipeline(
    requirement: str,
    run_id: str,
    session_id: str | None,
    agent_id: str | None,
    api_key: str | None = None,
    api_base: str | None = None,
    model: str | None = None,
    user_id: str = 'system',
) -> dict[str, Any]:
    global _run_counter
    _run_counter += 1
    if not tracemalloc.is_tracing():
        tracemalloc.start(25)
        logger.info("[MEM] tracemalloc started")
    log_memory_diff()
    logger.info("=== ENTER _run_agent_pipeline run=#%s | run=%s agent=%s ===", _run_counter, run_id, agent_id)
    await update_run_status(run_id, "running")
    cfg = load_config()
    effective_api_key = api_key
    effective_api_base = api_base
    effective_model = model or cfg.model

    system_prompt = ""
    ac = None
    all_skills: list[Any] = []
    if agent_id:
        try:
            ac = await get_agent_config(agent_id)
            if ac:
                system_prompt = ac.system_prompt
                if ac.output_constraints:
                    system_prompt += f"\n\n输出约束：{ac.output_constraints}"
                if ac.model:
                    effective_model = ac.model
            else:
                logger.warning("[TASKS] agent_id=%s NOT FOUND in agent_configs", agent_id)
        except Exception as e:
            logger.warning("[TASKS] Failed to load agent config for %s: %s", agent_id, e)

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
            logger.warning("Failed to load RAG context for session %s", session_id)

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

    checkpointer = await create_checkpointer_async()
    StreamEmitter(run_id)
    graph = SingleAgentGraph(
        model=effective_model,
        api_key=effective_api_key or "",
        base_url=effective_api_base,
        checkpointer=checkpointer,
    )

    # Tools are created via frontend API — no hardcoded default tools
    tool_configs: list[ToolConfig] = []

    # ── Bind agent tools / MCP / skills to the graph ──

    if agent_id and ac:
        all_tools = await get_tools()
        for item in _parse_json_field(ac.tools):
            if not item.get("enabled", True):
                continue
            name = item.get("name", "")
            if name:
                tool_match = next((t for t in all_tools if t.name == name), None)
                raw_params = tool_match.parameters if tool_match else (item.get("parameters"))
                if isinstance(raw_params, str):
                    try:
                        raw_params = json.loads(raw_params)
                    except (json.JSONDecodeError, TypeError):
                        raw_params = None
                tool_configs.append(
                    ToolConfig(
                        name=name,
                        description=tool_match.description
                        if tool_match
                        else (item.get("description") or name),
                        parameters=raw_params,
                        endpoint=tool_match.endpoint or "" if tool_match else "",
                        method=tool_match.method or "GET" if tool_match else "GET",
                        headers=tool_match.headers or "{}" if tool_match else "{}",
                    )
                )
        all_mcps = await get_mcps()
        for item in _parse_json_field(ac.mcp):
            name = item.get("name", "")
            if name:
                mcp_match = next((m for m in all_mcps if m.name == name), None)
                mcp_config = mcp_match.config if mcp_match else None
                mcp_params: dict[str, Any] = {}
                if isinstance(mcp_config, str):
                    mcp_params = json.loads(mcp_config) if mcp_config else {}
                elif mcp_config:
                    mcp_params = mcp_config
                mcp_type = mcp_match.type or "" if mcp_match else ""
                mcp_endpoint = mcp_match.endpoint or "" if mcp_match else ""
                mcp_prefix = f"mcp_{name}_"

                if mcp_type == "stdio" and mcp_endpoint:
                    try:
                        sub_tools = await _discover_mcp_tools(mcp_endpoint)
                    except Exception as e:
                        logger.warning("MCP discovery failed for %s: %s", name, e)
                        sub_tools = []

                    if sub_tools:
                        for st in sub_tools:
                            params = st.get("inputSchema") or {"type": "object"}
                            tool_configs.append(ToolConfig(
                                name=f"{mcp_prefix}{st['name']}",
                                description=st.get("description", "") or "",
                                parameters=params,
                                endpoint="",
                                method="MCP",
                            ))
                elif mcp_endpoint:
                    # Non-stdio MCP (like REST-based) → single tool
                    params = mcp_params
                    tool_configs.append(
                        ToolConfig(
                            name=f"{mcp_prefix}{name}",
                            description=mcp_match.name or name if mcp_match else name,
                            parameters=params,
                            endpoint=mcp_endpoint,
                            method=mcp_type.upper() if mcp_type else "GET",
                        )
                    )

        # ── Bind skills ──
        all_skills = await get_skills()
        for item in _parse_json_field(ac.skills):
            name = item.get("name", "")
            if name:
                skill_match = next((s for s in all_skills if s.name == name), None)
                if skill_match:
                    tool_configs.append(
                        ToolConfig(
                            name=f"skill_{name}",
                            description=skill_match.name or name,
                            parameters={"type": "object"},
                            endpoint="",
                            method="GET",
                            headers="{}",
                        )
                    )

    for tc in tool_configs:
        if tc.method == "MCP":
            tc.endpoint = exec_stdio_mcp.__name__

    graph.bind_tools(tool_configs)

    result = await graph.run(
        requirement=requirement,
        system_prompt=system_prompt,
        session_context=session_context,
        chat_history=chat_history,
        thread_id=run_id,
        run_id=run_id,
    )

    # ── Extract artifacts ──
    messages = result.get("messages", [])
    last_content = ""
    for m in reversed(messages):
        if hasattr(m, "content") and m.content:
            last_content = str(m.content)
            break

    pm_document = ""
    code = last_content
    review = ""
    for m in messages:
        if hasattr(m, "content") and isinstance(m.content, str):
            if "<pm_document>" in m.content:
                pm_document = m.content
            if "<review>" in m.content:
                review = m.content

    await update_run_result(
        run_id=run_id,
        pm_document=pm_document,
        code=code,
        review=review,
        approved=True,
        status="converged",
    )

    # ── Save messages ── (now handled by save_response_action in agent_graph.py)

    # ── Long-term memory ──
    if session_id:
        await _save_output_memories(session_id, run_id, last_content, {})
        prev_msgs = await get_session_messages(session_id, exclude_run_id=run_id)
        if not prev_msgs:
            # First run for this session → ingest into RAG
            try:
                from virtual_team.rag import ingest_session_messages  # type: ignore[attr-defined]

                await ingest_session_messages(session_id, run_id, [{"content": requirement}])
            except Exception:
                logger.warning("RAG ingest failed for session %s", session_id)

    # ── Log key usage ──
    input_tokens = result.get("input_tokens", 0) or 0
    output_tokens = result.get("output_tokens", 0) or 0
    model_used = result.get("model", effective_model)
    try:
        provider = model_used.split("/")[0] if "/" in model_used else "deepseek"
        await log_key_usage(
            key_id=effective_api_key,
            user_id=user_id,
            run_id=run_id,
            provider=provider,
            model=model_used,
            tokens_prompt=input_tokens,
            tokens_completion=output_tokens,
        )
    except Exception:
        logger.warning("Failed to log key usage for run %s", run_id)

    await publish_run_message(
        run_id,
        {
            "type": "result",
            "status": "completed",
            "approved": True,
            "pm_document": pm_document,
            "code": code,
            "review": review,
        },
    )

    with contextlib.suppress(Exception):
        gc.collect()
    log_memory_diff()
    logger.info("=== EXIT _run_agent_pipeline run=#%s | run=%s agent=%s ===", _run_counter, run_id, agent_id)
    return {"run_id": run_id, "status": "completed"}
