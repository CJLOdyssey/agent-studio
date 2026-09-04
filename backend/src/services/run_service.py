"""RunService——编排 run 的创建、续写与生命周期。"""

from __future__ import annotations

import asyncio
import contextlib
import os
import time
from typing import Any, cast

from broker import buffer_run_messages, publish_user_event
from core.config import load_config
from core.infra.logging_config import get_logger
from repository import (
    create_run as db_create_run,
)
from repository import (
    create_session,
    get_messages,
    get_run,
    get_runs,
    get_session,
    save_message,
    update_run_status,
    update_session_title,
)
from services.text_utils import parse_json_list

logger = get_logger(__name__)

# "thread"（默认，进程内 asyncio.create_task，适合 dev）| "celery"（走 worker）
RUN_DISPATCH = os.environ.get("RUN_DISPATCH", "thread")


def _format_run_detail(run: Any, messages: list[Any]) -> dict[str, Any]:
    return {
        "id": run.id,
        "session_id": run.session_id,
        "requirement": run.requirement,
        "pm_document": run.pm_document,
        "code": run.code,
        "review": run.review,
        "approved": run.approved,
        "status": run.status,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "updated_at": run.updated_at.isoformat() if run.updated_at else None,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "agent_name": m.agent_name,
                "content": m.content,
                "thinking": m.thinking,
                "round_number": m.round_number,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


def _format_run_summary(run: Any, cost_map: dict[str, float]) -> dict[str, Any]:
    return {
        "id": run.id,
        "session_id": run.session_id,
        "requirement": run.requirement,
        "pm_document": run.pm_document,
        "code": run.code,
        "review": run.review,
        "approved": run.approved,
        "status": run.status,
        "cost_usd": cost_map.get(run.id, 0.0),
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "updated_at": run.updated_at.isoformat() if run.updated_at else None,
    }


class RunService:
    """run 创建与生命周期的业务逻辑门面。

    调用方（HTTP 路由）负责：
      - HTTP 请求/响应编组
      - 认证（user_id 提取）
      - WebSocket 生命周期

    RunService 处理其余一切：
      - 会话管理（创建 / 查找）
      - 从 vault 解析 API key
      - run 持久化
      - Redis buffer 订阅
      - 后台任务分发
    """

    def __init__(self) -> None:
        # 进程内任务注册表（线程模式）—— run_id → asyncio.Task。
        self._tasks: dict[str, asyncio.Task[Any]] = {}

    def _register_task(self, run_id: str, task: asyncio.Task[Any]) -> None:
        self._tasks[run_id] = task
        task.add_done_callback(lambda _t: self._tasks.pop(run_id, None))

    async def create_run(
        self,
        requirement: str,
        session_id: str | None,
        user_id: str,
        key_id: str | None = None,
        agent_id: str | None = None,
        team_id: str | None = None,
        model: str | None = None,
        parent_run_id: str | None = None,
        is_edit: bool = False,
        attachment_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        """创建 run、解析凭据、订阅 buffer、分发流水线。

        返回含 ``run_id``、``session_id``、``status`` 的字典。
        """
        from services.run_helpers import resolve_api_key, resolve_session

        requirement = requirement.strip()
        config = load_config()

        # ── 会话 ─────────────────────────────────────────────────
        session_id, agent_id, team_id = await resolve_session(
            session_id=session_id,
            user_id=user_id,
            requirement=requirement,
            agent_id=agent_id,
            team_id=team_id,
        )

        # ── Key 解析 ──────────────────────────────────────────
        effective_model = model or config.model
        api_key, api_base, image_model, resolved_key_id = await resolve_api_key(
            user_id=user_id,
            key_id=key_id,
            effective_model=effective_model,
        )
        assert api_key is not None  # resolve_api_key raises if None

        # ── 持久化 run ─────────────────────────────────────────────
        try:
            req_versions: list[str] | None = None
            # 仅编辑/重新生成（is_edit）继承被替换 run 的编辑链；普通续聊
            # 是新问题，不写 requirement_versions（前端版本器由 run 树推导）。
            if is_edit and parent_run_id:
                parent = await get_run(parent_run_id)
                if parent:
                    parent_versions = parse_json_list(parent.requirement_versions)
                    base = parent_versions if parent_versions else [parent.requirement]
                    req_versions = base + [requirement]
            run_id = await db_create_run(
                requirement,
                session_id=session_id,
                parent_run_id=parent_run_id,
                requirement_versions=req_versions,
            )
        except Exception as e:
            logger.error("Failed to create run: %s", e, exc_info=True)
            raise

        # ── 跨客户端同步 ─────────────────────────────────────────
        # 发消息（新 run）后广播会话更新：其他浏览器/端收到事件即失效并
        # 重拉会话列表（创建时的会话 updated/run 数变化）。fail-open。
        await publish_user_event(
            user_id,
            {
                "type": "session.updated",
                "session_id": session_id,
                "ts": int(time.time()),
            },
        )

        # ── 绑定预上传的附件 ─────────────────────────────
        # 预上传的文件（POST /api/attachments）携带 session_id 但没有
        # run_id；在此处绑定，使流水线能注入它们的链接。
        if attachment_ids and session_id is not None:
            try:
                from repository.attachments import bind_attachments_to_run

                await bind_attachments_to_run(attachment_ids, run_id, session_id, user_id)
                logger.info(
                    "Attachments bound | run=%s | requested=%d",
                    run_id,
                    len(attachment_ids),
                )
            except Exception:
                logger.exception("Failed to bind attachments for run=%s", run_id)

        # ── 持久化用户消息 ─────────────────────────────────────
        # 只要有消息就入库：用户问题也落库 chat_messages（此前仅存 runs.
        # requirement，加载时由 with_requirement_message 运行时合成）。
        # 注：create_run 每次调用都会插入一条；调用方需保证不重复创建 run。
        try:
            await save_message(
                run_id=run_id,
                role="user",
                agent_name="我",
                content=requirement,
                round_number=1,
            )
        except Exception:
            logger.warning("Failed to persist user message for run %s", run_id)

        # ── 更新会话时间戳 ────────────────────────────────
        try:
            if session_id is not None:
                existing_sess = await get_session(session_id)
                if existing_sess:
                    await update_session_title(session_id, existing_sess.title)
        except Exception:
            pass

        # ── Redis buffer（在任务启动*之前*订阅） ───────────
        await buffer_run_messages(run_id)

        # ── 分发流水线 ───────────────────────────────────────
        return await self._dispatch_pipeline(
            requirement=requirement,
            run_id=run_id,
            session_id=session_id,
            user_id=user_id,
            team_id=team_id,
            agent_id=agent_id,
            api_key=api_key,
            api_base=api_base,
            effective_model=effective_model,
            resolved_key_id=resolved_key_id,
            image_model=image_model,
        )

    async def _dispatch_pipeline(
        self,
        *,
        requirement: str,
        run_id: str,
        session_id: str | None,
        user_id: str,
        team_id: str | None,
        agent_id: str | None,
        api_key: str,
        api_base: str | None,
        effective_model: str,
        resolved_key_id: str | None,
        image_model: bool,
    ) -> dict[str, Any]:
        """分发流水线。委托给 services.run_dispatch 模块。"""
        from services.run_dispatch import dispatch_pipeline as _impl

        return await _impl(
            requirement=requirement,
            run_id=run_id,
            session_id=session_id,
            user_id=user_id,
            team_id=team_id,
            agent_id=agent_id,
            api_key=api_key,
            api_base=api_base,
            effective_model=effective_model,
            resolved_key_id=resolved_key_id,
            image_model=image_model,
            register_task=self._register_task,
        )

    async def continue_run(
        self,
        content: str,
        session_id: str | None,
        user_id: str,
        thinking: str | None = None,
        model: str | None = None,
        question: str | None = None,
    ) -> dict[str, Any]:
        """创建续写 run（「继续生成」）——流式输出原始 LLM 结果。

        与 ``create_run`` 不同，它绕过 LangGraph 流水线，直接通过
        ``_complete_pipeline`` 在 uvicorn 进程中执行补全。``model`` 是用户在
        对话中选定的模型（回退到配置的默认模型）；``question`` 是被中断草稿
        所回答的原始用户消息——prefix/partial 机制需要它来实现无缝原位续写。
        """
        from services.run_helpers import resolve_api_key

        config = load_config()

        # ── 会话 ─────────────────────────────────────────────────
        if session_id is None:
            title = (content or "续写")[:64]
            sess = await create_session(title=title, user_id=user_id)
            session_id = sess.id

        # ── Key 解析 ──────────────────────────────────────────
        effective_model = model or config.model
        api_key, api_base, image_model, resolved_key_id = await resolve_api_key(
            user_id=user_id,
            key_id=None,
            effective_model=effective_model,
        )
        assert api_key is not None

        if image_model:
            raise ValueError("图片生成模型不支持继续生成")

        # ── 持久化 run ─────────────────────────────────────────────
        run_id = await db_create_run(content, session_id=session_id)

        # ── 持久化用户消息 ─────────────────────────────────────
        # 只要有消息就入库：续写 run 的用户消息 = 原问题（question）——
        # 视图显示「原问题 + 续写回答」，而非半截文本当问题。
        try:
            await save_message(
                run_id=run_id,
                role="user",
                agent_name="我",
                content=(question or content).strip() or content,
                round_number=1,
            )
        except Exception:
            logger.warning("Failed to persist user message for continuation run %s", run_id)

        # ── Redis buffer ────────────────────────────────────────────
        await buffer_run_messages(run_id)

        # ── 分发后台流水线 ────────────────────────────
        from services.run_dispatch import dispatch_complete

        result = await dispatch_complete(
            content=content,
            run_id=run_id,
            api_key=api_key,
            api_base=api_base,
            effective_model=effective_model,
            thinking=thinking,
            question=question,
            register_task=self._register_task,
        )
        result["session_id"] = session_id
        return result

    async def cancel_run(self, run_id: str) -> dict[str, Any]:
        """取消进行中的 run——将取消传播到 LLM 流。

        Thread mode: ``task.cancel()`` unwinds the await chain and aborts the
        upstream httpx request; the pipeline marks the run ``cancelled``.
        Celery mode: best-effort revoke (no hard kill).
        """
        if RUN_DISPATCH == "celery":
            try:
                from broker import celery_app

                cast(Any, celery_app).control.revoke(run_id, terminate=False)
                await update_run_status(run_id, "cancelled")
                return {"run_id": run_id, "status": "cancelled", "cancelled": True}
            except Exception:
                logger.exception("Failed to revoke celery task run=%s", run_id)
                return {"run_id": run_id, "status": "pending", "cancelled": False}

        task = self._tasks.get(run_id)
        if task is None or task.done():
            run = await get_run(run_id)
            return {
                "run_id": run_id,
                "status": run.status if run else "not_found",
                "cancelled": False,
            }
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await task
        await update_run_status(run_id, "cancelled")
        return {"run_id": run_id, "status": "cancelled", "cancelled": True}

    async def get_run(self, run_id: str) -> dict[str, Any] | None:
        """按 id 获取单个 run。"""
        run = await get_run(run_id)
        if run is None:
            return None
        messages = await get_messages(run_id)
        return _format_run_detail(run, messages)

    async def list_runs(self, limit: int = 20, user_id: str | None = None) -> list[dict[str, Any]]:
        """列出最近的 run，可选限定到某用户的会话。"""
        runs = await get_runs(limit=min(limit, 100), user_id=user_id)
        run_ids = [r.id for r in runs]
        cost_map: dict[str, float] = {}
        if run_ids:
            try:
                from cost.token_tracker import get_token_tracker
                tracker = get_token_tracker()
                cost_map = await tracker.get_cost_by_runs(run_ids)
            except Exception:
                logger.debug("Cost lookup skipped for list_runs")
        return [_format_run_summary(r, cost_map) for r in runs]


# 便捷单例（无状态服务）
run_service = RunService()

__all__ = ["RunService", "run_service"]
