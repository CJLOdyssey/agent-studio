# ruff: noqa: E402 — imports after tracemalloc setup are intentional
import asyncio
import contextlib
import gc
import json
import tracemalloc

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from virtual_team.agent_graph import SingleAgentGraph, ToolConfig
from virtual_team.broker import publish_run_message
from virtual_team.checkpoint import create_checkpointer_async
from virtual_team.config import load_config
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

from .helpers import (
    _build_session_context,
    _discover_mcp_tools,
    _get_rag_context,
    _parse_json_field,
    _save_output_memories,
    log_memory_diff,
)

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
) -> dict:
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
    all_skills: list = []
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
                match = next((t for t in all_tools if t["name"] == name), None)
                raw_params = match.get("parameters") if match else (item.get("parameters"))
                if isinstance(raw_params, str):
                    try:
                        raw_params = json.loads(raw_params)
                    except (json.JSONDecodeError, TypeError):
                        raw_params = None
                tool_configs.append(
                    ToolConfig(
                        name=name,
                        description=match["description"]
                        if match
                        else (item.get("description") or name),
                        parameters=raw_params,
                        endpoint=match.get("endpoint", "") if match else "",
                        method=match.get("method", "GET") if match else "GET",
                        headers=match.get("headers", "{}") if match else "{}",
                    )
                )
        all_mcps = await get_mcps()
        for item in _parse_json_field(ac.mcp):
            name = item.get("name", "")
            if name:
                match = next((m for m in all_mcps if m["name"] == name), None)
                mcp_config = match.get("config") if match else None
                if isinstance(mcp_config, str):
                    mcp_config = json.loads(mcp_config) if mcp_config else {}
                elif not mcp_config:
                    mcp_config = {}
                mcp_type = match.get("type", "") if match else ""
                mcp_endpoint = match.get("endpoint", "") if match else ""
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
                    params = mcp_config
                    tool_configs.append(
                        ToolConfig(
                            name=f"{mcp_prefix}{name}",
                            description=match.get("description", name) if match else name,
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
                match = next((s for s in all_skills if s["name"] == name), None)
                if match:
                    tool_configs.append(
                        ToolConfig(
                            name=f"skill_{name}",
                            description=match.get("description", name),
                            parameters=match.get("parameters") or {"type": "object"},
                            endpoint=match.get("endpoint", ""),
                            method=match.get("method", "GET") if match.get("method") else "GET",
                            headers=match.get("headers", "{}") if match.get("headers") else "{}",
                        )
                    )

    # Dynamically import MCP session modules only when needed
    if any(t.method == "MCP" for t in tool_configs):
        from mcp import StdioServerParameters
        from mcp.client.session import ClientSession
        from mcp.client.stdio import stdio_client

        async def _exec_stdio_mcp(tc: ToolConfig, args: str) -> str:
            params = StdioServerParameters(command=tc.endpoint)
            try:
                async with asyncio.timeout(60):
                    async with stdio_client(params) as (read, write):
                        async with ClientSession(read, write) as session:
                            await session.initialize()
                            result = await session.call_tool(tc.name, {"args": args})
                            if result.isError:
                                return f"[MCP Error] {result.content[0].text if result.content else 'unknown'}"
                            return result.content[0].text if result.content else ""
            except TimeoutError:
                return f"[MCP Timeout] {tc.name}"

        for tc in tool_configs:
            if tc.method == "MCP":
                # Replace the endpoint with the dynamic executor
                tc.endpoint = _exec_stdio_mcp.__name__

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
                from virtual_team.rag import ingest_session_messages

                await ingest_session_messages(session_id, requirement)
            except Exception:
                logger.warning("RAG ingest failed for session %s", session_id)

    # ── Log key usage ──
    input_tokens = result.get("input_tokens", 0) or 0
    output_tokens = result.get("output_tokens", 0) or 0
    model_used = result.get("model", effective_model)
    try:
        await log_key_usage(
            api_key=effective_api_key or "",
            model=model_used,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            run_id=run_id,
            user_id=user_id,
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
