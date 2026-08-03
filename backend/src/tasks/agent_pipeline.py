"""Single-agent pipeline — tool discovery, RAG context, and graph execution."""

# ruff: noqa: E402 — imports after tracemalloc setup are intentional
import asyncio
import contextlib
import gc
import json
import os
import tracemalloc
from typing import Any

from broker import publish_run_message
from checkpoint import create_checkpointer_async
from core.config import load_config
from core.infra.logging_config import get_logger
from graph.graph import SingleAgentGraph
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from repository import (
    get_agent_config,
    get_mcps,
    get_messages,
    get_session_memories,
    get_session_messages,
    get_skills,
    get_tools,
    list_attachments_by_run,
    update_message_content,
    update_run_result,
    update_run_status,
)
from repository.keys import log_key_usage
from services.tool_config import ToolConfig
from streaming.emitter import StreamEmitter

from .mcp_executor import exec_stdio_mcp
from .pipeline_utils import (
    _build_session_context,
    _discover_mcp_tools,
    _get_rag_context,
    _parse_json_field,
    _save_output_memories,
    log_memory_diff,
)

logger = get_logger(__name__)

_run_counter = 0
_AGENT_TIMEOUT = int(os.environ.get("AGENT_TIMEOUT", "600"))  # 10 minutes default


def _kill_stuck_child_processes() -> None:
    """Kill any OS-level child processes left behind by a timed-out task.

    ``asyncio.timeout`` cancels the coroutine but does **not** kill child
    OS processes spawned by libraries (e.g. multiprocessing forks inside
    LangGraph).  Those orphans continue burning CPU indefinitely.
    """
    try:
        ppid = os.getpid()
        with os.popen(f"ps --ppid {ppid} -o pid= --no-headers") as pipe:
            children = pipe.read().strip().split()
        for pid_str in children:
            if not pid_str.strip():
                continue
            pid = int(pid_str)
            try:
                with open(f"/proc/{pid}/cmdline") as f:
                    cmd = f.read().replace("\0", " ")
                if "multiprocessing.spawn" in cmd:
                    logger.warning("[TASKS] Killing stuck child PID %d (cmd=%s…)", pid, cmd[:80])
                    os.kill(pid, 9)
            except (ProcessLookupError, FileNotFoundError, PermissionError):
                pass
    except Exception:
        logger.exception("[TASKS] Failed to clean up child processes")


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
    emitter = StreamEmitter(run_id)
    graph = SingleAgentGraph(
        model=effective_model,
        api_key=effective_api_key or "",
        base_url=effective_api_base,
        checkpointer=checkpointer,
    )
    graph.set_stream_callback(emitter)

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
                # Plugin tool fallback: item.id = canonical tool_name, item.name = display label
                if not tool_match:
                    tid = item.get("id", "")
                    if tid and tid != name:
                        name = tid
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
                        sub_tools = await _discover_mcp_tools(
                            mcp_endpoint,
                            args=mcp_params.get("args") if isinstance(mcp_params, dict) else None,
                            env=mcp_params.get("env") if isinstance(mcp_params, dict) else None,
                        )
                    except Exception as e:
                        logger.warning("MCP discovery failed for %s: %s", name, e)
                        sub_tools = []

                    if sub_tools:
                        mcp_tool_config = {
                            **(mcp_params if isinstance(mcp_params, dict) else {}),
                            "command": mcp_endpoint,
                        }
                        for st in sub_tools:
                            sub_params = st.get("inputSchema") or {"type": "object"}
                            tool_configs.append(ToolConfig(
                                name=f"{mcp_prefix}{st['name']}",
                                description=st.get("description", "") or "",
                                parameters=sub_params,
                                endpoint="",
                                method="MCP",
                                mcp_type="stdio",
                                mcp_endpoint=mcp_endpoint,
                                mcp_tool_name=st["name"],
                                mcp_config=mcp_tool_config,
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
                            mcp_type=mcp_type,
                        )
                    )

        # ── Bind skills ──
        all_skills = await get_skills()
        for item in _parse_json_field(ac.skills):
            name = item.get("name", "")
            if name:
                skill_match = next((s for s in all_skills if s.name == name), None)
                if skill_match:
                    script_files = getattr(skill_match, "script_files", None) or {}
                    parts: list[str] = []
                    if skill_match.instructions:
                        parts.append(str(skill_match.instructions))
                    if skill_match.output_constraint:
                        parts.append(f"输出约束：\n{skill_match.output_constraint}")
                    if skill_match.tool_names:
                        parts.append(f"可用的工具：{', '.join(skill_match.tool_names)}")
                    if script_files:
                        ref_blocks = [
                            f"### {path}\n```\n{content}\n```"
                            for path, content in script_files.items()
                        ]
                        parts.append("## 参考脚本（按需复现其逻辑）\n" + "\n".join(ref_blocks))
                    skill_instructions = "\n\n".join(filter(None, parts))

                    # 子工具真实注册：tool_names 中已存在的工具生成 ToolConfig
                    for tname in (skill_match.tool_names or []):
                        tmatch = next((t for t in all_tools if t.name == tname), None)
                        if tmatch:
                            skill_params: dict[str, Any] = {}
                            if getattr(tmatch, "parameters", None):
                                try:
                                    if isinstance(tmatch.parameters, str):
                                        skill_params = json.loads(tmatch.parameters)
                                    else:
                                        skill_params = tmatch.parameters or {}
                                except (json.JSONDecodeError, TypeError):
                                    skill_params = {}
                            tool_configs.append(ToolConfig(
                                name=tname,
                                description=tmatch.description or tname,
                                parameters=skill_params or {"type": "object"},
                                endpoint=tmatch.endpoint or "",
                                method=tmatch.method or "GET",
                                headers=tmatch.headers or "{}",
                            ))

                    tool_configs.append(
                        ToolConfig(
                            name=f"skill_{name}",
                            description=(
                                f"{skill_match.content or skill_match.name}。"
                                "当用户请求与该能力相关时调用此技能。"
                            ),
                            instructions=skill_instructions,
                            parameters={"type": "object"},
                            endpoint="",
                            method="GET",
                            headers="{}",
                        )
                    )

    # Dedupe by tool name: agent tools, MCP sub-tools, and skill sub-tools can
    # overlap (e.g. agent binds the same tool AND a skill lists it in
    # allowed-tools). LLM APIs reject duplicate tool names — keep first config.
    seen: set[str] = set()
    unique_configs: list[ToolConfig] = []
    for tc in tool_configs:
        if tc.method == "MCP":
            tc.endpoint = exec_stdio_mcp.__name__
        if tc.name in seen:
            continue
        seen.add(tc.name)
        unique_configs.append(tc)

    graph.bind_tools(unique_configs)

    # ── Intent detection: direct URL open for "打开XX" patterns ──
    # ponytail: manual mapping for common Chinese site names; expand as needed
    _site_map = {
        "百度": "https://www.baidu.com",
        "谷歌": "https://www.google.com",
        "google": "https://www.google.com",
        "bing": "https://www.bing.com",
        "必应": "https://www.bing.com",
        "抖音": "https://www.douyin.com",
        "github": "https://github.com",
        "知乎": "https://www.zhihu.com",
        "微博": "https://weibo.com",
    }
    _open_url = None
    _clean = requirement.strip().lower()
    for _keyword, _site_url in _site_map.items():
        if _keyword in _clean and ("打开" in _clean or "访问" in _clean or "去" in _clean):
            _open_url = _site_url
            break
    # Also try regex for full URLs / domains with dots
    if not _open_url:
        import re
        _m = re.search(r'(?:https?://)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z0-9][-a-zA-Z0-9]*)+', requirement.strip())
        if _m and ("打开" in _clean or "访问" in _clean or "去" in _clean):
            _domain = _m.group(0)
            _open_url = f"https://{_domain}" if not _domain.startswith("http") else _domain
    if _open_url:
        logger.info("Intent detection: open_url -> %s", _open_url)
        await publish_run_message(run_id, {"type": "open_url", "url": _open_url})

    try:
        async with asyncio.timeout(_AGENT_TIMEOUT):
            result = await graph.run(
                requirement=requirement,
                system_prompt=system_prompt,
                session_context=session_context,
                chat_history=chat_history,
                thread_id=run_id,
                run_id=run_id,
            )
    except TimeoutError:
        logger.error("[TASKS] Agent pipeline timed out after %ds (run=%s)", _AGENT_TIMEOUT, run_id)
        await publish_run_message(run_id, {"type": "error", "message": "任务执行超时"})
        await update_run_status(run_id, "timeout")
        # Kill any OS child processes spawned by the timed-out task
        _kill_stuck_child_processes()
        return {"run_id": run_id, "status": "timeout"}

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

    # ── Attach download links to the final message ──
    # The model often references generated files by filename without a URL;
    # inject the /api/attachments links deterministically so the frontend can
    # offer a working download.
    try:
        atts = await list_attachments_by_run(run_id)
        if atts:
            links = [
                f"[📥 {a.filename}](/api/attachments/{a.id})"
                for a in atts
            ]
            block = "\n\n" + "\n".join(f"- {lnk}" for lnk in links)
            msg = await get_messages(run_id)
            if msg:
                last = msg[-1]
                if not any(a.id in (last.content or "") for a in atts):
                    await update_message_content(last.id, (last.content or "") + block)
    except Exception:
        logger.warning("Failed to attach download links for run %s", run_id, exc_info=True)

    # ── Save messages ── (now handled by save_response_action in agent_graph.py)

    # ── Long-term memory ──
    if session_id:
        await _save_output_memories(session_id, run_id, last_content, {})
        prev_msgs = await get_session_messages(session_id, exclude_run_id=run_id)
        if not prev_msgs:
            # First run for this session → ingest into RAG
            try:
                from rag.rag_pipeline import ingest_session_messages

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
