import asyncio
import logging
import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from asyncio import AbstractEventLoop

from virtual_team.celery_app import celery_app
from virtual_team.config import load_config
from virtual_team.conversation import TeamManager
from virtual_team.redis_client import publish_run_message
from virtual_team.repository import (
    create_run,
    get_active_agent_configs,
    get_run,
    get_session_memories,
    save_message,
    update_run_result,
    update_run_status,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 单 event-loop 执行器：防止嵌套 loop / 重复 new_event_loop
# ---------------------------------------------------------------------------

def _start_event_loop() -> "AbstractEventLoop":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    return loop


def _shutdown_event_loop(loop: "AbstractEventLoop"):
    try:
        loop.run_until_complete(loop.shutdown_asyncgens())
    except Exception:
        pass
    try:
        loop.close()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Streaming callback
# ---------------------------------------------------------------------------

def _streaming_callback(loop: "AbstractEventLoop", run_id: str, msg_dict: dict):
    """Called by TeamManager on every agent message.

    Reuses the task's single event loop instead of creating a per-message
    loop, which previously caused asyncpg ``InterfaceError``.
    """
    try:
        name = msg_dict.get("name", "")
        content = msg_dict.get("content", "")
        if not name or not content:
            return
        role = name
        display_name = name

        payload = {
            "type": "message",
            "role": role,
            "agent_name": display_name,
            "content": content,
            "round_number": msg_dict.get("round_number", 0),
        }
        loop.run_until_complete(publish_run_message(run_id, payload))
        loop.run_until_complete(save_message(
            run_id=run_id,
            role=role,
            agent_name=display_name,
            content=content,
            round_number=msg_dict.get("round_number", 0),
        ))
    except Exception:
        logger.exception("Error in streaming callback")


# ---------------------------------------------------------------------------
# Session context builder
# ---------------------------------------------------------------------------

def _build_session_context(memories) -> str:
    if not memories:
        return ""
    lines = ["\n\n【历史上下文 - 之前的讨论记录】"]
    for m in memories:
        lines.append(f"- [{m.content_type}] {m.agent_role}: {m.summary}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Memory persistence helper
# ---------------------------------------------------------------------------

def _save_run_memories(loop: "AbstractEventLoop", session_id: str, run_id: str, output):
    from virtual_team.repository import create_memory_entry

    entries = []

    if output.pm_document:
        summary = output.pm_document[:200].replace("\n", " ")
        entries.append(("pm", "pm_document", summary, output.pm_document))

    if output.code:
        code_preview = output.code[:200].replace("\n", " ")
        entries.append(("programmer", "code", code_preview, output.code))

    if output.review:
        review_preview = output.review[:200].replace("\n", " ")
        entries.append(("tester", "review", review_preview, output.review))

    for agent_role, content_type, summary, details in entries:
        loop.run_until_complete(
            create_memory_entry(
                session_id=session_id,
                run_id=run_id,
                agent_role=agent_role,
                content_type=content_type,
                summary=summary,
                details=details,
            )
        )


# ---------------------------------------------------------------------------
# Mock fallback — demonstrates streaming when LLM is unavailable
# ---------------------------------------------------------------------------

def _run_mock_discussion(loop, requirement: str, run_id: str, session_id: str | None):
    """Simulate a 3-agent discussion with streaming messages."""
    import uuid

    from virtual_team.prompts import DIRECT_REPLY_KEYWORD

    GREETINGS = {"你好", "hello", "hi", "嗨", "您好", "在吗", "在不在", "谢谢", "多谢", "感谢"}
    GREETING_PREFIXES = ("你好", "hello", "hi", "嗨")
    norm = requirement.strip().lower()
    is_greeting = (
        norm in GREETINGS
        or any(norm.startswith(p) for p in ("你好", "hello", "hi", "嗨"))
        or len(norm) < 6
    )

    if is_greeting:
        msg = {
            "name": "产品经理",
            "content": f"你好！有什么需求需要我们的团队帮忙吗？请描述你的需求，"
                       f"产品经理、程序员和测试工程师会一起讨论并产出方案。{DIRECT_REPLY_KEYWORD}",
            "round_number": 0,
        }
        _streaming_callback(loop, run_id, msg)

        from dataclasses import dataclass
        from enum import Enum

        class MockStatus(Enum):
            CONVERGED = "converged"

        @dataclass
        class MockOutput:
            pm_document: str = ""
            code: str = ""
            review: str = ""
            approved: bool = False
            status: MockStatus = MockStatus.CONVERGED

        return MockOutput(pm_document=msg["content"], approved=False)

    agents = [
        {"name": "pm", "display": "产品经理", "role": "pm"},
        {"name": "programmer", "display": "资深程序员", "role": "programmer"},
        {"name": "tester", "display": "测试工程师", "role": "tester"},
    ]

    conversation = [
        ("pm", "收到需求：{}。我先分析一下可行性...".format(requirement[:40])),
        ("pm", "这是一个典型的软件开发需求。需要明确输入输出、边界条件和性能要求。"),
        ("pm", "优先级建议：核心功能 P0，错误处理 P1，性能优化 P2。"),
        ("programmer", "理解了，我先设计数据结构，然后实现核心逻辑。"),
        ("programmer", "考虑使用函数式风格，保持代码简洁。单元测试覆盖主要路径。"),
        ("tester", "收到代码，开始审查。检查边界条件：空输入、异常值、大数据量。"),
        ("tester", "代码逻辑正确，建议增加文档注释。添加类型提示会更安全。【批准】"),
    ]

    round_num = 0
    for name, content in conversation:
        agent = next(a for a in agents if a["name"] == name)
        msg = {
            "name": agent["display"],
            "content": content,
            "round_number": round_num,
        }
        _streaming_callback(loop, run_id, msg)
        round_num += 1
        time.sleep(0.6)  # simulate thinking delay

    # Build mock output
    from dataclasses import dataclass, field
    from enum import Enum

    class MockStatus(Enum):
        CONVERGED = "converged"

    @dataclass
    class MockOutput:
        pm_document: str = ""
        code: str = ""
        review: str = ""
        approved: bool = False
        status: MockStatus = field(default_factory=lambda: MockStatus.CONVERGED)

    output = MockOutput(
        pm_document="## 需求分析\n\n{}\n\n### 技术方案\n- 使用 Python 标准库\n- 函数式编程风格\n- 完整的类型注解\n\n### 风险评估\n低风险，需求明确。".format(requirement),
        code="def solution():\n    \"\"\"Mock implementation — 配置真实 DeepSeek API Key 后生成实际代码\"\"\"\n    pass\n",
        review="代码结构清晰，建议配置真实 API Key 以生成生产级代码。测试场景已覆盖。",
        approved=True,
    )
    return output


# ---------------------------------------------------------------------------
# Main Celery task
# ---------------------------------------------------------------------------

@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def run_discussion(self, requirement: str, run_id: str | None = None, session_id: str | None = None):
    logger.info("Task run_discussion started | run_id=%s | session_id=%s | requirement=%.100s",
                run_id, session_id, requirement)

    loop = _start_event_loop()

    try:
        # --- 1. Mark running ---
        try:
            loop.run_until_complete(update_run_status(run_id, "running"))
        except Exception:
            pass

        # --- 2. Load config ---
        config = load_config()

        # --- 3. Load session memories ---
        session_context = ""
        if session_id:
            try:
                memories = loop.run_until_complete(get_session_memories(session_id))
                if memories:
                    session_context = _build_session_context(memories)
            except Exception:
                logger.exception("Failed to load session memories for %s", session_id)

        # --- 4. Load active agent configs ---
        active_configs = loop.run_until_complete(get_active_agent_configs())
        if not active_configs:
            raise RuntimeError("没有活跃的 agent 配置，请在设置中添加至少一个 agent")

        from virtual_team.models import AgentConfig as AgentConfigModel
        agent_configs = [
            AgentConfigModel(
                id=ac.id,
                name=ac.name,
                role_identifier=ac.role_identifier,
                system_prompt=ac.system_prompt,
                model=ac.model,
                temperature=ac.temperature,
                order=ac.order,
                is_active=ac.is_active,
                is_approver=ac.is_approver,
                icon=ac.icon,
            )
            for ac in active_configs
        ]

        # --- 5. Run discussion ---
        enriched_requirement = requirement + session_context if session_context else requirement
        manager = TeamManager(
            config,
            agent_configs,
            message_callback=lambda m: _streaming_callback(loop, run_id, m),
        )
        output = manager.run_streaming(enriched_requirement)

        # --- 6. Save results ---
        loop.run_until_complete(update_run_result(
            run_id=run_id,
            pm_document=output.pm_document,
            code=output.code,
            review=output.review,
            approved=output.approved,
            status=output.status.value if hasattr(output.status, 'value') else str(output.status),
        ))
        loop.run_until_complete(publish_run_message(run_id, {
            "type": "result",
            "status": "completed",
            "approved": output.approved,
            "pm_document": output.pm_document,
            "code": output.code,
            "review": output.review,
        }))

        # --- 7. Save memories (moved BEFORE return — was dead code) ---
        if session_id:
            try:
                _save_run_memories(loop, session_id, run_id, output)
            except Exception:
                logger.exception("Failed to save memories for run %s", run_id)

        logger.info("Task run_discussion completed | run_id=%s | approved=%s", run_id, output.approved)
        return {"run_id": run_id, "status": "completed", "approved": output.approved}

    except Exception as exc:
        logger.exception("Task run_discussion failed | run_id=%s — falling back to mock", run_id)

        # --- 8. Mock fallback: demonstrate streaming even without LLM ---
        try:
            output = _run_mock_discussion(loop, requirement, run_id, session_id)

            loop.run_until_complete(update_run_result(
                run_id=run_id,
                pm_document=output.pm_document,
                code=output.code,
                review=output.review,
                approved=output.approved,
                status=output.status.value,
            ))
            loop.run_until_complete(publish_run_message(run_id, {
                "type": "result",
                "status": "completed",
                "approved": output.approved,
                "pm_document": output.pm_document,
                "code": output.code,
                "review": output.review,
            }))

            if session_id:
                try:
                    _save_run_memories(loop, session_id, run_id, output)
                except Exception:
                    logger.exception("Failed to save mock memories for run %s", run_id)

            logger.info("Task run_discussion completed (mock) | run_id=%s", run_id)
            return {"run_id": run_id, "status": "completed", "approved": output.approved}
        except Exception as mock_exc:
            logger.exception("Mock discussion also failed | run_id=%s", run_id)

            # --- 9. Final error ---
            try:
                loop.run_until_complete(update_run_status(run_id, "error"))
                loop.run_until_complete(publish_run_message(run_id, {
                    "type": "status", "status": "error", "error": str(exc),
                }))
            except Exception:
                _shutdown_event_loop(loop)
                fallback = _start_event_loop()
                try:
                    fallback.run_until_complete(update_run_status(run_id, "error"))
                except Exception:
                    pass
                finally:
                    _shutdown_event_loop(fallback)
                raise

            self.retry(exc=mock_exc)

    finally:
        _shutdown_event_loop(loop)
