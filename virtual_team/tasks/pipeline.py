"""LangGraph-powered single-agent execution pipelines."""
# ruff: noqa: E402 — imports after tracemalloc setup are intentional
import gc
import json
import os
import tracemalloc

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

# ── Memory leak diagnostics ──────────────────────────────────────────────
_run_counter = 0
_baseline_snapshot: tracemalloc.Snapshot | None = None


def _log_memory_diff() -> None:
    global _baseline_snapshot
    try:
        pid = os.getpid()
        with open(f"/proc/{pid}/status") as f:
            rss_kb = int(f.read().split("VmRSS:")[1].split()[0])
        logger.info("[MEM] run=#%s pid=%s rss=%dKB", _run_counter, pid, rss_kb)
    except Exception:
        pass
    if not tracemalloc.is_tracing():
        return
    current = tracemalloc.take_snapshot()
    if _baseline_snapshot is None:
        _baseline_snapshot = current
        return
    diff = current.compare_to(_baseline_snapshot, "lineno")
    top = [str(d) for d in diff[:10] if d.size_diff > 0]
    if top:
        logger.info("[MEM] top growth:\n%s", "\n".join(top))
    # Refresh baseline so diff is incremental
    _baseline_snapshot = current

from virtual_team.agent_graph import SingleAgentGraph, ToolConfig
from virtual_team.broker import publish_run_message
from virtual_team.checkpoint import create_checkpointer_async
from virtual_team.config import load_config
from virtual_team.logging_config import get_logger
from virtual_team.repository import (
    get_agent_config,
    get_mcps,
    get_prompts,
    get_run_messages,
    get_session_memories,
    get_session_messages,
    get_skills,
    get_tools,
    update_run_result,
    update_run_status,
)
from virtual_team.repository.keys import log_key_usage
from virtual_team.repository.workflows import get_workflow_config_by_team
from virtual_team.streaming import StreamEmitter
from virtual_team.workflow.dynamic_team_graph import DynamicTeamGraph

from .helpers import (
    _build_session_context,
    _discover_mcp_tools,
    _get_rag_context,
    _parse_json_field,
    _save_output_memories,
)

logger = get_logger(__name__)


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
    _log_memory_diff()
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
    emitter = StreamEmitter(run_id)
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
                                mcp_type=mcp_type,
                                mcp_endpoint=mcp_endpoint,
                                mcp_tool_name=st["name"],
                            ))
                        continue

                # Fallback: register the whole MCP as one tool (legacy)
                desc = mcp_config.get("description", name) or name
                tool_configs.append(
                    ToolConfig(
                        name=f"mcp_{name}",
                        description=f"{desc}",
                        mcp_type=mcp_type,
                        mcp_endpoint=mcp_endpoint,
                    )
                )
        all_skills = await get_skills()
        for item in _parse_json_field(ac.skills):
            name = item.get("name", "")
            if name:
                match = next((s for s in all_skills if s["name"] == name), None)
                if not match:
                    continue
                # Fetch linked prompt content
                skill_prompt = ""
                if match.get("prompt_id"):
                    all_prompts = await get_prompts()
                    pm = next((p for p in all_prompts if p["id"] == match["prompt_id"]), None)
                    if pm:
                        skill_prompt = pm.get("content", "")
                # Build composed instructions
                composed = match.get("instructions", "")
                if skill_prompt:
                    composed = f"## 角色设定\n\n{skill_prompt}\n\n---\n\n{composed}"
                if match.get("output_constraint"):
                    composed += f"\n\n## 输出约束\n\n{match['output_constraint']}"
                if match.get("tool_names"):
                    names = (
                        match["tool_names"]
                        if isinstance(match["tool_names"], list)
                        else json.loads(match["tool_names"])
                        if isinstance(match["tool_names"], str)
                        else []
                    )
                    if names:
                        composed += (
                            f"\n\n## 可用工具\n\n你可以使用以下工具完成任务：{', '.join(names)}"
                        )
                        # Bind referenced tools to the graph (lookup by name)
                        for tname in names:
                            tm = next((t for t in all_tools if t["name"] == tname), None)
                            if tm:
                                raw_params = tm.get("parameters")
                                if isinstance(raw_params, str):
                                    try:
                                        raw_params = json.loads(raw_params)
                                    except (json.JSONDecodeError, TypeError):
                                        raw_params = None
                                tool_configs.append(ToolConfig(
                                    name=tname,
                                    description=tm.get("description", tname),
                                    parameters=raw_params,
                                    endpoint=tm.get("endpoint", ""),
                                    method=tm.get("method", "GET"),
                                    headers=tm.get("headers", "{}"),
                                ))
                            else:
                                # Fallback: check if it's an MCP
                                mm = next((m for m in all_mcps if m["name"] == tname), None)
                                if mm:
                                    mcp_type = mm.get("type", "")
                                    mcp_endpoint = mm.get("endpoint", "")
                                    mcp_prefix = f"mcp_{tname}_"
                                    if mcp_type == "stdio" and mcp_endpoint:
                                        # Discover sub-tools from the MCP (matches the MCP loop logic)
                                        try:
                                            sub_tools = await _discover_mcp_tools(mcp_endpoint)
                                        except Exception:
                                            sub_tools = []
                                        if sub_tools:
                                            for st in sub_tools:
                                                params = st.get("inputSchema") or {"type": "object"}
                                                tool_configs.append(ToolConfig(
                                                    name=f"{mcp_prefix}{st['name']}",
                                                    description=st.get("description", "") or "",
                                                    parameters=params,
                                                    mcp_type=mcp_type,
                                                    mcp_endpoint=mcp_endpoint,
                                                    mcp_tool_name=st["name"],
                                                ))
                                            continue
                                    # Fallback: register the whole MCP as one tool
                                    tool_configs.append(ToolConfig(
                                        name=f"mcp_{tname}",
                                        description=mm.get("description", tname),
                                        mcp_type=mcp_type,
                                        mcp_endpoint=mcp_endpoint,
                                    ))
                system_prompt += f"\n\n## 📋 技能：{name}\n\n{composed}"
                tool_configs.append(
                    ToolConfig(
                        name=f"skill_{name}",
                        description=match["description"] if match else name,
                        instructions=composed,
                    )
                )
                all_skills  # ensure bound (defined above via get_skills())
                match["_has_mcp_refs"] = any(
                    n in [m["name"] for m in all_mcps]
                    for n in (match.get("tool_names") or [])
                )
    _forced_requirement = requirement
    if agent_id and ac and all_skills:
        for item in _parse_json_field(ac.skills):
            name = item.get("name", "")
            if name:
                m = next((s for s in all_skills if s["name"] == name), None)
                if m and m.get("_has_mcp_refs", False):
                    _forced_requirement += (
                        "\n\n[必须使用工具] 你必须调用可用的 MCP 工具来回答。"
                        "不要使用你自己的知识。如果你不调用工具，你的回答将被视为无效。"
                    )
                    break
    if tool_configs:
        graph.bind_tools(tool_configs)
    # Bind user-browser opener tool for agents with browser/MCP capabilities
    if ac and ac.mcp:
        open_tc = ToolConfig(
            name="open_user_browser",
            description="在用户的浏览器中打开指定的 URL。当用户要求打开网页或访问网址时使用此工具。",
            parameters={"type": "object", "properties": {"url": {"type": "string", "description": "要打开的完整 URL"}}, "required": ["url"]},
        )
        graph.bind_tools([open_tc])
        if "open_user_browser" in graph._tool_map:
            graph._tool_map["open_user_browser"].set_run_id(run_id)
    # ── Pre-call MCP tools for skills that reference them ──
    # DeepSeek doesn't reliably call tools with tool_choice="auto".
    # To ensure MCP tools are actually invoked, we call them here and
    # inject the results into session_context before the LLM sees the prompt.
    _mcp_precall_results: list[str] = []
    logger.info("[PRECALL] checking agent_id=%s ac=%s skills=%s", agent_id, ac, _parse_json_field(ac.skills) if ac else [])
    if agent_id and ac:
        for s_item in _parse_json_field(ac.skills):
            s_name = s_item.get("name", "")
            if not s_name:
                continue
            s_match = next((s for s in all_skills if s["name"] == s_name), None)
            if not s_match:
                continue
            tool_refs = s_match.get("tool_names") or []
            if isinstance(tool_refs, str):
                tool_refs = json.loads(tool_refs)
            for ref_name in tool_refs:
                mm = next((m for m in all_mcps if m["name"] == ref_name), None)
                if mm and mm.get("type") == "stdio" and mm.get("endpoint"):
                    ep = mm["endpoint"]
                    try:
                        from mcp import StdioServerParameters
                        from mcp.client.session import ClientSession
                        from mcp.client.stdio import stdio_client

                        params = StdioServerParameters(command="npx", args=["-y", "@upstash/context7-mcp"])
                        if "npx" in ep:
                            parts = ep.split()
                            if len(parts) >= 2:
                                params = StdioServerParameters(command=parts[0], args=parts[1:])
                        async with stdio_client(params) as (read, write):
                            async with ClientSession(read, write) as session:
                                await session.initialize()
                                # Step 1: resolve library ID
                                lib_result = await session.call_tool("resolve-library-id", {
                                    "query": requirement[:200],
                                    "libraryName": requirement[:100],
                                })
                                lib_content = str(lib_result.content or "")
                                _mcp_precall_results.append(f"## MCP {ref_name} resolve-library-id 结果\n\n{lib_content[:1000]}")
                                # Step 2: query docs with first library ID
                                try:
                                    lib_data = json.loads(lib_content)
                                    entries = lib_data if isinstance(lib_data, list) else lib_data.get("content", [])
                                    first_id = None
                                    if isinstance(entries, list) and entries:
                                        first_id = entries[0].get("libraryId") or entries[0].get("id")
                                    elif isinstance(lib_data, dict):
                                        first_id = lib_data.get("libraryId") or lib_data.get("id")
                                    if first_id:
                                        docs_result = await session.call_tool("query-docs", {"libraryId": first_id, "query": requirement[:200]})
                                        docs_content = str(docs_result.content or "")
                                        _mcp_precall_results.append(f"## MCP {ref_name} query-docs 结果\n\n{docs_content[:2000]}")
                                except Exception:
                                    pass
                    except Exception as e:
                        _mcp_precall_results.append(f"MCP pre-call error: {e}")
    if _mcp_precall_results:
        session_context += "\n\n" + "\n\n".join(_mcp_precall_results)

    graph.set_stream_callback(emitter)
    try:
        result = await graph._graph.ainvoke(
            {"messages": chat_history + [HumanMessage(content=_forced_requirement)], "system_prompt": system_prompt, "session_context": session_context},
            {"configurable": {"thread_id": run_id}, "recursion_limit": 25},
        )

        # ── Log usage immediately after graph.run() ──
        try:
            usage = getattr(graph, '_last_usage', {}) or {}
            logger.info("[USAGE] run=%s model=%s usage=%s", run_id, effective_model, usage)
            await log_key_usage(
                key_id=None,
                user_id=user_id,
                run_id=run_id,
                provider=effective_model.split('/')[0] if '/' in effective_model else effective_model,
                model=effective_model,
                tokens_prompt=usage.get('prompt_tokens', 0) or 0,
                tokens_completion=usage.get('completion_tokens', 0) or 0,
                duration_ms=0,
            )
        except Exception as e:
            logger.warning("[USAGE] logging failed for run %s: %s", run_id, e)

        all_msgs: list = result.get("messages", [])
        last_ai = next((m for m in reversed(all_msgs) if isinstance(m, AIMessage)), None)
        response = str(last_ai.content) if last_ai else ""
        # Count tool calls across ALL AI messages, not just the last one
        all_tool_calls: list[dict] = []
        for m in all_msgs:
            if isinstance(m, AIMessage):
                for tc in (getattr(m, "tool_calls", []) or []):
                    all_tool_calls.append({"name": tc.get("name", ""), "args": tc.get("args", {})})
        tool_calls = all_tool_calls
        message_count = len([m for m in all_msgs if getattr(m, "type", "") != "system"])
        review_summary = (
            f"Agent completed successfully with {message_count} messages "
            f"and {len(tool_calls)} tool call(s)."
        )

        await update_run_result(
            run_id=run_id,
            pm_document="",
            code=response,
            review=review_summary,
            approved=True,
            status="converged",
        )
        await publish_run_message(
            run_id,
            {
                "type": "result",
                "status": "completed",
                "approved": True,
                "pm_document": "",
                "code": response,
                "review": review_summary,
            },
        )

        if session_id:
            try:
                await _save_output_memories(session_id, run_id, response, {"tool_calls": tool_calls})
                from virtual_team.rag import ingest_session_messages

                messages = await get_run_messages(run_id)
                if messages:
                    msg_dicts = [
                        {"content": m.content, "role": m.role, "agent_name": m.agent_name}
                        for m in messages
                    ]
                    await ingest_session_messages(session_id, run_id, msg_dicts)
            except Exception:
                logger.exception("RAG/memory save failed for run %s", run_id)

        logger.info(
            "Agent completed | run=%s | msgs=%d | tools=%d",
            run_id,
            message_count,
            len(tool_calls),
        )
        return {"run_id": run_id, "status": "completed"}
    finally:
        gc.collect()
        _log_memory_diff()


async def _run_team_pipeline(
    requirement: str,
    run_id: str,
    session_id: str | None,
    team_id: str,
    key_id: str | None = None,
    model: str = "",
    api_key: str = "",
    api_base: str | None = None,
) -> None:
    cfg = load_config()
    workflow_config = await get_workflow_config_by_team(team_id)
    if workflow_config is None:
        logger.warning("[TEAM] no workflow config for team %s", team_id)
        return

    logger.info("[TEAM] starting run=%s team=%s nodes=%d", run_id, team_id, len(workflow_config.nodes))
    try:
        await update_run_status(run_id, "in_progress")
        graph = DynamicTeamGraph(
            model=model or cfg.model,
            api_key=api_key or cfg.api_key,
            base_url=api_base or cfg.api_base,
            checkpointer=await create_checkpointer_async(),
        )
        await graph.set_workflow(workflow_config)
        result = await graph.run(
            requirement=requirement,
            thread_id=f"team-{team_id}-{run_id}",
            run_id=run_id,
        )
        artifacts = result.get("artifacts", {}) if isinstance(result, dict) else {}
        msgs = result.get("messages", []) if isinstance(result, dict) else []
        last_content = ""
        for m in reversed(msgs):
            if hasattr(m, "content") and m.content:
                last_content = str(m.content)
                break
        final = artifacts.get("_final_report", last_content)

        await update_run_result(
            run_id=run_id, pm_document="", code=final,
            review=f"Team done: {len(artifacts)} outputs",
            approved=True, status="converged",
        )
        await publish_run_message(run_id, {"type": "team_result", "status": "completed", "artifacts": artifacts})
        logger.info("[TEAM] completed run=%s artifacts=%d", run_id, len(artifacts))
    except Exception as e:
        logger.error("[TEAM] fatal run=%s error=%s", run_id, str(e), exc_info=True)
        await update_run_status(run_id, "error")
    finally:
        gc.collect()
        _log_memory_diff()

