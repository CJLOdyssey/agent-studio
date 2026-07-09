"""Celery tasks — LangGraph-powered single-agent execution."""

import asyncio
import contextlib
import json
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


async def _save_output_memories(session_id: str, run_id: str, response: str, metadata: dict):
    summary = response[:200].replace("\n", " ")
    content_type = "code"
    if "<pm_document>" in response or "需求分析" in response:
        content_type = "pm_document"
    elif "<review>" in response or "问题" in response or "bug" in response.lower():
        content_type = "review"
    try:
        await create_memory_entry(
            session_id=session_id,
            run_id=run_id,
            agent_role="agent",
            content_type=content_type,
            summary=summary,
            details=response[:2000],
        )
    except Exception:
        logger.exception("Failed to save memory for run %s", run_id)


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
    await update_run_status(run_id, "running")
    cfg = load_config()
    effective_api_key = api_key
    effective_api_base = api_base
    effective_model = model or cfg.model

    system_prompt = ""
    ac = None
    if not agent_id:
        from virtual_team.repository.agents import get_agent_configs
        configs = await get_agent_configs()
        active = [c for c in configs if c.is_active]
        if active:
            agent_id = active[0].id
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

    from virtual_team.agent_graph import DEFAULT_TOOLS, SingleAgentGraph, ToolConfig
    from virtual_team.checkpoint import create_checkpointer_async
    from virtual_team.repository import get_mcps, get_prompts, get_skills, get_tools

    if not system_prompt:
        [t.name for t in DEFAULT_TOOLS]
        system_prompt = (
            "你是一个 AI 助手。可以调用以下工具:\n"
            + "\n".join(f"- {t.name}: {t.description}" for t in DEFAULT_TOOLS)
            + "\n\n当用户请求搜索或获取最新信息时，必须使用 web_search 工具。\n"
            "当需要计算时，使用 calculator 工具。\n\n"
            "【重要】你的思考过程会以思考树形式展示给用户。\n"
            "你的思考内容和你最终给出的回答有严格区分，请遵循以下规则：\n"
            "\n"
            "## 思考区规则（只出现在思考树中）\n"
            "1. 思考内容保持简洁和抽象。只描述你要做什么以及为什么。\n"
            "2. **不要在思考中复述搜索结果的全部内容、完整列表或详细数据。**\n"
            "   简要提及「发现了X条相关结果」即可，具体内容留给最终回答。\n"
            "3. 分析结果时，只说你打算怎么做，不需要在思考里构建回答的完整结构。\n"
            "4. 每次调用工具前，简要说明目的。每次工具返回后，简要评估结果。\n"
            "\n"
            "## 最终回答区规则（只出现在对话中）\n"
            "5. 所有详细内容、完整列表、具体数据只放在最终回答中。\n"
            "6. **在给出最终回答之前，务必先以一段简短的总结性思考结束推理过程。**\n"
            "   最后一段思考只需一句话总结（如「根据搜索结果，可以整理出以下要点」），\n"
            "   不要列出具体内容。不要以工具调用作为最后一步。\n"
            "7. 如果已经收集到足够的信息来回答用户，就不需要再调用更多工具。\n"
            "   只有在真正需要时才调用工具。"
        )

    checkpointer = await create_checkpointer_async()
    emitter = StreamEmitter(run_id)
    graph = SingleAgentGraph(
        model=effective_model,
        api_key=effective_api_key or "",
        base_url=effective_api_base,
        checkpointer=checkpointer,
    )

    # Start with default tools, merge agent-specific tools on top
    tool_configs: list[ToolConfig] = list(DEFAULT_TOOLS)

    # ── Bind agent tools / MCP / skills to the graph ──
    if agent_id and ac:
        for item in json.loads(ac.tools) if isinstance(ac.tools, str) else (ac.tools or []):
            if not item.get("enabled", True):
                continue
            name = item.get("name", "")
            if name:
                all_tools = await get_tools()
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
        for item in json.loads(ac.mcp) if isinstance(ac.mcp, str) else (ac.mcp or []):
            name = item.get("name", "")
            if name:
                all_mcps = await get_mcps()
                match = next((m for m in all_mcps if m["name"] == name), None)
                mcp_config = match.get("config") if match else None
                if isinstance(mcp_config, str):
                    mcp_config = json.loads(mcp_config) if mcp_config else {}
                elif not mcp_config:
                    mcp_config = {}
                tool_configs.append(
                    ToolConfig(
                        name=f"mcp_{name}",
                        description=mcp_config.get("description", name),
                        mcp_type=match.get("type", "") if match else "",
                        mcp_endpoint=match.get("endpoint", "") if match else "",
                    )
                )
        for item in json.loads(ac.skills) if isinstance(ac.skills, str) else (ac.skills or []):
            name = item.get("name", "")
            if name:
                all_skills = await get_skills()
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
                tool_configs.append(
                    ToolConfig(
                        name=f"skill_{name}",
                        description=match["description"] if match else name,
                        instructions=composed,
                    )
                )
    if tool_configs:
        graph.bind_tools(tool_configs)
    try:
        result = await graph.run(
            system_prompt=system_prompt,
            user_input=requirement,
            thread_id=run_id,
            session_context=session_context,
            chat_history=chat_history if chat_history else None,
            stream_callback=emitter,
        )

        # ── Log usage immediately after graph.run() ──
        try:
            usage = getattr(graph, '_last_usage', {}) or {}
            print(f"[USAGE] run={run_id} model={effective_model} usage={usage}", flush=True)
            from virtual_team.repository.keys import log_key_usage as _log_usage
            await _log_usage(
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

        response = result.get("response", "")
        tool_calls = result.get("tool_calls", [])
        review_summary = (
            f"Agent completed successfully with {result.get('message_count', 0)} messages "
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
            result.get("message_count", 0),
            len(tool_calls),
        )
        return {"run_id": run_id, "status": "completed"}
    finally:
        import gc
        del graph
        del checkpointer
        del emitter
        gc.collect()


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
    logger.info("Agent task | run=%s | session=%s | agent=%s", run_id, session_id, agent_id)
    assert run_id is not None, "run_id must be provided"

    try:
        return _run_async(
            _run_agent_pipeline(
                requirement,
                run_id,
                session_id,
                agent_id,
                api_key=api_key,
                api_base=api_base,
                model=model,
            )
        )
    except Exception as exc:
        logger.exception("Agent failed | run=%s", run_id)

        if ENABLE_MOCK_FALLBACK:
            logger.warning("Mock fallback for run=%s", run_id)
            try:
                output = _run_async(run_mock(requirement, run_id, session_id))
                _run_async(
                    update_run_result(
                        run_id=run_id,
                        pm_document="",
                        code=output.response,
                        review="LangGraph fallback",
                        approved=True,
                        status="converged",
                    )
                )
                _run_async(
                    publish_run_message(
                        run_id,
                        {
                            "type": "result",
                            "status": "completed",
                            "approved": True,
                            "pm_document": "",
                            "code": output.response,
                            "review": "LangGraph fallback",
                        },
                    )
                )
                if session_id:
                    with contextlib.suppress(Exception):
                        _run_async(_save_output_memories(session_id, run_id, output.response, {}))
                return {"run_id": run_id, "status": "completed", "fallback": True}
            except Exception as mock_exc:
                logger.exception("Mock fallback also failed for run=%s", run_id)
                try:
                    _run_async(update_run_status(run_id, "error"))
                    _run_async(
                        publish_run_message(
                            run_id,
                            {
                                "type": "status",
                                "status": "error",
                                "error": str(exc),
                            },
                        )
                    )
                except Exception:
                    logger.exception("Status update failed for mock fallback run %s", run_id)
                self.retry(exc=mock_exc)

        try:
            _run_async(update_run_status(run_id, "error"))
            _run_async(
                publish_run_message(
                    run_id,
                    {
                        "type": "status",
                        "status": "error",
                        "error": str(exc),
                    },
                )
            )
        except Exception:
            logger.exception("Failed to update error status for run %s", run_id)
        self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Completion task — raw LLM streaming without LangGraph / thinking / tools
# Used by the "继续生成" flow on the frontend.
# ---------------------------------------------------------------------------

@celery_app.task(bind=True, max_retries=2, default_retry_delay=5)
def complete_agent(
    self,
    content: str,
    run_id: str,
    api_key: str,
    api_base: str | None = None,
    model: str | None = None,
    thinking: str | None = None,
):
    return _run_async(_complete_pipeline(content, run_id, api_key, api_base, model, thinking))


async def _complete_pipeline(
    content: str,
    run_id: str,
    api_key: str,
    api_base: str | None = None,
    model: str | None = None,
    thinking: str | None = None,
):

    import httpx

    cfg = load_config()
    effective_model = model or cfg.model

    await update_run_status(run_id, "running")

    base_url = (api_base or "https://api.deepseek.com").rstrip("/")

    if thinking:
        # Prefix completion (reasoning_content + prefix) requires /beta endpoint.
        clean_base = base_url.rstrip("/beta")
        url = f"{clean_base}/beta/chat/completions"
    else:
        url = f"{base_url}/chat/completions"

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    if thinking:
        # Prefix continuation mode: send the user's original question + partial
        # assistant reasoning_content so the model naturally continues its
        # interrupted thought process (DeepSeek prefix completion).
        body = {
            "model": effective_model,
            "messages": [
                {"role": "user", "content": content},
                {"role": "assistant", "content": "", "reasoning_content": thinking, "prefix": True},
            ],
            "stream": True,
            "max_tokens": 65536,
        }
        base_lower = (api_base or "").lower()
        model_lower = (effective_model or "").lower()
        is_deepseek = "deepseek" in base_lower or "deepseek" in model_lower
        if is_deepseek:
            body["thinking"] = {"type": "enabled"}
    else:
        system_prompt = (
            "Continue the following text naturally. "
            "Output ONLY the continuation — no prefix, no analysis, no commentary, no meta-text. "
            "Do not repeat the input text."
        )
        prompt = f"{system_prompt}\n\n{content}"
        body = {
            "model": effective_model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
            "max_tokens": 65536,
        }

    full_content = ""
    thinking_chunks: list[str] = []
    logger.info("[complete] Starting completion for run %s | model=%s", run_id, effective_model)

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=15.0)) as client, \
                client.stream("POST", url, headers=headers, json=body) as resp:
                if resp.status_code != 200:
                    body_text = await resp.aread()
                    logger.error(
                        "[complete] LLM %s -> %s: %s",
                        url,
                        resp.status_code,
                        body_text.decode(errors="replace")[:300],
                    )
                resp.raise_for_status()

                async for line in resp.aiter_lines():
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

                    reasoning = delta.get("reasoning_content")
                    if reasoning:
                        thinking_chunks.append(reasoning)
                        await publish_run_message(run_id, {
                            "type": "thinking_stream",
                            "agent_name": "Agent",
                            "content": reasoning,
                        })

                    token = delta.get("content", "")
                    if token:
                        full_content += token
                        await publish_run_message(run_id, {
                            "type": "stream",
                            "agent_name": "Agent",
                            "content": token,
                        })
    except httpx.HTTPStatusError as e:
        logger.error("[complete] HTTP error for run %s: %s", run_id, e, exc_info=True)
        await update_run_status(run_id, "error")
        await publish_run_message(run_id, {"type": "error", "detail": f"LLM API 错误: {e}"})
        return
    except Exception as e:
        logger.error("[complete] Stream failed for run %s: %s", run_id, e, exc_info=True)
        await update_run_status(run_id, "error")
        await publish_run_message(run_id, {"type": "error", "detail": f"续写失败: {e}"})
        return

    if thinking_chunks:
        await publish_run_message(run_id, {
            "type": "thinking_done",
            "agent_name": "Agent",
            "thinking": "".join(thinking_chunks),
        })

    try:
        await update_run_result(
            run_id,
            pm_document="",
            code=content + full_content,
            review="",
            approved=False,
            status="completed",
        )
        await publish_run_message(run_id, {
            "type": "result",
            "status": "completed",
            "code": content + full_content,
            "pm_document": "",
            "review": "",
            "approved": False,
        })
        logger.info("[complete] Done for run %s (%d chars)", run_id, len(full_content))
    except Exception as e:
        logger.error("[complete] Save failed for run %s: %s", run_id, e, exc_info=True)
        await update_run_status(run_id, "error")
        await publish_run_message(run_id, {"type": "error", "detail": f"保存失败: {e}"})
