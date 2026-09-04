"""会话与记忆 API 路由。"""

import time
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from starlette.responses import Response

from auth import get_user_id, require_run_owner
from auth.auth_rbac import AUTH_REQUIRE_LOGIN
from broker import publish_user_event
from core.error_codes import ErrorCode, error_response
from core.infra.logging_config import get_logger
from core.models import AttachmentResponse, SessionDetailResponse, SessionSummary
from repository import (
    create_session,
    delete_memory_entry,
    delete_session,
    get_agent_config,
    get_memory_entry,
    get_messages,
    get_runs_by_session_ids,
    get_session,
    get_session_memories,
    get_session_messages,
    get_session_runs,
    get_sessions,
    update_message_versions,
    update_session_pin,
    update_session_title,
)
from repository.attachments import list_attachments_by_session
from services.session_export import render_memories_json, render_memories_markdown
from services.session_service import with_requirement_message
from services.text_utils import parse_json_list

from .session_schemas import (
    AnswerVersionsRequest,
    SessionCreateRequest,
    SessionPinRequest,
    SessionUpdateRequest,
)

logger = get_logger(__name__)

router = APIRouter(tags=["sessions"])


async def _publish_session_event(user_id: str, event_type: str, session_id: str) -> None:
    """通知用户的其他客户端会话已变更（fail-open）。"""
    await publish_user_event(
        user_id,
        {"type": event_type, "session_id": session_id, "ts": int(time.time())},
    )


@router.get("/api/sessions", response_model=list[SessionSummary])
async def list_sessions(request: Request, limit: int = 50, agent_id: str | None = None) -> Any:
    """列出当前用户的会话。"""
    user_id = get_user_id(request)
    # 登录墙（AUTH_REQUIRE_LOGIN=1）时未登录（anonymous）→ 401 而非 200 []：
    # 否则 events/发送触发的 refetch 在认证瞬时失效窗口会以 anonymous 返回空
    # 列表，前端覆盖缓存清空会话列表（"最近对话消失，需刷新才恢复"）。401 →
    # 前端拦截器自动 refresh 恢复后重试。注意用 AUTH_REQUIRE_LOGIN 而非
    # AUTH_ENABLED：guest 模式（AUTH_ENABLED=1 + AUTH_REQUIRE_LOGIN=0）下
    # anonymous 仍应看到自己的会话（200 []），不能被登录墙逻辑误伤。
    if AUTH_REQUIRE_LOGIN and user_id == "anonymous":
        raise error_response(ErrorCode.AUTH_UNAUTHORIZED, detail="请先登录")
    try:
        user_id = get_user_id(request)
        sessions = await get_sessions(limit=min(limit, 100), user_id=user_id, agent_id=agent_id)
        session_ids = [s.id for s in sessions]
        runs_by_session = await get_runs_by_session_ids(session_ids)
        result = []
        for s in sessions:
            runs = runs_by_session.get(s.id, [])
            result.append(
                {
                    "id": s.id,
                    "title": s.title,
                    "kind": s.kind,
                    "agent_id": s.agent_id,
                    "team_id": s.team_id,
                    "is_pinned": s.is_pinned,
                    "run_count": len(runs),
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                    "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                }
            )
        return result
    except Exception as e:
        logger.error("Error listing sessions: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.post("/api/sessions", status_code=201)
async def add_session(request: Request, req: SessionCreateRequest) -> Any:
    """创建新的聊天会话。"""
    try:
        user_id = get_user_id(request)
        if req.agent_id:
            agent = await get_agent_config(req.agent_id)
            if not agent:
                raise error_response(ErrorCode.INVALID_REQUEST, detail="Agent 不存在")
        sess = await create_session(title=req.title, user_id=user_id, agent_id=req.agent_id, team_id=req.team_id)
        await _publish_session_event(user_id, "session.created", sess.id)
        return {
            "id": sess.id,
            "title": sess.title,
            "created_at": sess.created_at.isoformat() if sess.created_at else None,
            "updated_at": sess.updated_at.isoformat() if sess.updated_at else None,
        }
    except Exception as e:
        logger.error("Error creating session: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.get("/api/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session_detail(request: Request, session_id: str) -> Any:
    """获取含 run 与记忆的完整会话详情。"""
    try:
        user_id = get_user_id(request)
        sess = await get_session(session_id)
        if not sess:
            raise error_response(ErrorCode.SESSION_NOT_FOUND, detail="未找到该对话")
        if sess.user_id != user_id:
            raise error_response(ErrorCode.SESSION_FORBIDDEN, detail="无权访问该对话")

        runs = await get_session_runs(session_id)
        memories = await get_session_memories(session_id)

        # 按 run 的附件：让前端在用户消息里展示文件（下载链接）。
        # 附件经 POST /runs 绑定 run_id（选中即传仅带 session_id）。
        attachments_by_run: dict[str, list[AttachmentResponse]] = {}
        try:
            atts = await list_attachments_by_session(session_id)
            for a in atts:
                if not a.run_id:
                    continue
                attachments_by_run.setdefault(a.run_id, []).append(
                    AttachmentResponse(
                        id=a.id,
                        session_id=a.session_id,
                        run_id=a.run_id,
                        filename=a.filename,
                        content_type=a.content_type,
                        size_bytes=a.size_bytes,
                        has_extracted_text=bool(a.extracted_text),
                        created_at=a.created_at,
                    )
                )
        except Exception:
            logger.warning("Failed to load attachments for session %s", session_id)

        # 批量加载所有 run 的带思考消息
        all_messages = await get_session_messages(session_id)
        messages_by_run: dict[str, list[dict[str, Any]]] = {}
        for m in all_messages:
            if m.run_id not in messages_by_run:
                messages_by_run[m.run_id] = []
            messages_by_run[m.run_id].append({
                "id": m.id,
                "role": m.role,
                "agent_name": m.agent_name,
                "content": m.content,
                "thinking": m.thinking,
                "round_number": m.round_number,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "versions": parse_json_list(m.versions),
                "thinking_versions": parse_json_list(m.thinking_versions),
            })

        # 分支树模型：不折叠。每个 run 独立返回（parent_run_id 为树指针），
        # 前端 buildPathTurns 按分支树挂载版本器（对齐 ragbase 语义）。
        merged = [
            (r, with_requirement_message(r, messages_by_run.get(r.id, [])))
            for r in runs
        ]

        return {
            "id": sess.id,
            "title": sess.title,
            "kind": sess.kind,
            "agent_id": sess.agent_id,
            "team_id": sess.team_id,
            "created_at": sess.created_at.isoformat() if sess.created_at else None,
            "updated_at": sess.updated_at.isoformat() if sess.updated_at else None,
            "runs": [
                {
                    "id": r.id,
                    "requirement": r.requirement,
                    "pm_document": r.pm_document,
                    "code": r.code,
                    "review": r.review,
                    "approved": r.approved,
                    "status": r.status,
                    "parent_run_id": r.parent_run_id,
                    "requirement_versions": parse_json_list(r.requirement_versions),
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                    "messages": with_requirement_message(r, msgs),
                    "attachments": attachments_by_run.get(r.id, []),
                }
                for r, msgs in merged
            ],
            "memories": [
                {
                    "id": m.id,
                    "agent_role": m.agent_role,
                    "content_type": m.content_type,
                    "summary": m.summary,
                    "details": m.details,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in memories
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting session %s: %s", session_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.put("/api/sessions/{session_id}")
async def rename_session(request: Request, session_id: str, req: SessionUpdateRequest) -> Any:
    """重命名会话标题。"""
    try:
        user_id = get_user_id(request)
        sess = await get_session(session_id)
        if not sess:
            raise error_response(ErrorCode.SESSION_NOT_FOUND, detail="未找到该对话")
        if sess.user_id != user_id:
            raise error_response(ErrorCode.SESSION_FORBIDDEN, detail="无权修改该对话")
        sess = await update_session_title(session_id, req.title)
        if not sess:
            raise error_response(ErrorCode.SESSION_NOT_FOUND, detail="未找到该对话")
        await _publish_session_event(user_id, "session.updated", session_id)
        return {"id": sess.id, "title": sess.title, "status": "updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error renaming session %s: %s", session_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.put("/api/sessions/{session_id}/pin")
async def pin_session(request: Request, session_id: str, req: SessionPinRequest) -> Any:
    """置顶/取消置顶会话，用于侧边栏置顶。"""
    try:
        user_id = get_user_id(request)
        sess = await get_session(session_id)
        if not sess:
            raise error_response(ErrorCode.SESSION_NOT_FOUND, detail="未找到该对话")
        if sess.user_id != user_id:
            raise error_response(ErrorCode.SESSION_FORBIDDEN, detail="无权修改该对话")
        sess = await update_session_pin(session_id, req.is_pinned)
        if not sess:
            raise error_response(ErrorCode.SESSION_NOT_FOUND, detail="未找到该对话")
        await _publish_session_event(user_id, "session.updated", session_id)
        return {"id": sess.id, "is_pinned": sess.is_pinned, "status": "updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error pinning session %s: %s", session_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.delete("/api/sessions/{session_id}")
async def remove_session(request: Request, session_id: str) -> Any:
    """删除会话及其关联数据。"""
    try:
        user_id = get_user_id(request)
        sess = await get_session(session_id)
        if not sess:
            raise error_response(ErrorCode.SESSION_NOT_FOUND, detail="未找到该对话")
        if sess.user_id != user_id:
            raise error_response(ErrorCode.SESSION_FORBIDDEN, detail="无权删除该对话")
        deleted = await delete_session(session_id)
        if not deleted:
            raise error_response(ErrorCode.SESSION_NOT_FOUND, detail="未找到该对话")
        await _publish_session_event(user_id, "session.deleted", session_id)
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting session %s: %s", session_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.get("/api/sessions/{session_id}/memories")
async def list_session_memories(request: Request, session_id: str) -> Any:
    """列出会话的所有记忆条目。"""
    try:
        user_id = get_user_id(request)
        sess = await get_session(session_id)
        if not sess:
            raise error_response(ErrorCode.SESSION_NOT_FOUND, detail="未找到该对话")
        if sess.user_id != user_id:
            raise error_response(ErrorCode.SESSION_FORBIDDEN, detail="无权访问该对话")
        memories = await get_session_memories(session_id)
        return [
            {
                "id": m.id,
                "agent_role": m.agent_role,
                "content_type": m.content_type,
                "summary": m.summary,
                "details": m.details,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in memories
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error listing memories for %s: %s", session_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.delete("/api/memories/{memory_id}")
async def delete_session_memory(memory_id: str, request: Request) -> Any:
    """删除单条记忆条目（经其会话限定属主）。"""
    try:
        user_id = get_user_id(request)
        memory = await get_memory_entry(memory_id)
        if memory is None:
            raise error_response(ErrorCode.MEMORY_NOT_FOUND, detail="未找到该记忆")
        sess = await get_session(memory.session_id)
        if sess is None or sess.user_id != user_id:
            raise error_response(ErrorCode.SESSION_FORBIDDEN, detail="无权访问该记忆")
        deleted = await delete_memory_entry(memory_id)
        if not deleted:
            raise error_response(ErrorCode.MEMORY_NOT_FOUND, detail="未找到该记忆")
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting memory %s: %s", memory_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.get("/api/sessions/{session_id}/memories/export")
async def export_session_memories(request: Request, session_id: str, format: str = "json") -> Any:
    """将会话记忆导出为 JSON 或 Markdown。"""
    try:
        user_id = get_user_id(request)
        if format not in ("json", "md"):
            raise error_response(ErrorCode.INVALID_REQUEST, detail="format 参数必须为 json 或 md")

        sess = await get_session(session_id)
        if not sess:
            raise error_response(ErrorCode.SESSION_NOT_FOUND, detail="未找到该对话")
        if sess.user_id != user_id:
            raise error_response(ErrorCode.SESSION_FORBIDDEN, detail="无权访问该对话")

        memories = await get_session_memories(session_id)
        if format == "json":
            content = render_memories_json(memories)
            media_type = "application/json"
            ext = "json"
        else:
            content = render_memories_markdown(session_id, memories)
            media_type = "text/markdown"
            ext = "md"
        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename=memories_{session_id}.{ext}"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error exporting memories for %s: %s", session_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.put("/api/runs/{run_id}/answer-versions")
async def update_run_answer_versions(run_id: str, req: AnswerVersionsRequest, request: Request) -> Any:
    """将编辑-重新生成的回答版本历史持久化到 run 的最终回答上。"""
    user_id = get_user_id(request)
    await require_run_owner(request, run_id)
    msgs = await get_messages(run_id)
    agent_msgs = [m for m in msgs if m.role != "user"]
    if not agent_msgs:
        raise HTTPException(status_code=404, detail="Run has no answer messages yet")
    target = agent_msgs[-1]
    await update_message_versions(target.id, req.versions, req.thinking_versions)
    logger.info(
        "Answer versions persisted | run=%s | message=%s | versions=%d | user=%s",
        run_id, target.id, len(req.versions), user_id,
    )
    return {"ok": True, "versions": len(req.versions)}
