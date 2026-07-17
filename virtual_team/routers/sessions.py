"""Session and Memory API routes."""

import json

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.responses import Response

from virtual_team.auth import get_user_id
from virtual_team.error_codes import ErrorCode, error_response
from virtual_team.logging_config import get_logger
from typing import Any
from virtual_team.models import SessionDetailResponse, SessionSummary
from virtual_team.repository import (

    create_session,
    delete_memory_entry,
    delete_session,
    get_agent_config,
    get_runs_by_session_ids,
    get_session,
    get_session_memories,
    get_session_runs,
    get_sessions,
    update_session_title,
)

logger = get_logger(__name__)
router = APIRouter(tags=["sessions"])


class SessionCreateRequest(BaseModel):
    title: str = "新对话"
    agent_id: str | None = None


class SessionUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=256)


@router.get("/api/sessions", response_model=list[SessionSummary])
async def list_sessions(limit: int = 50, agent_id: str | None = None, request: Request = None):  # type: ignore
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
                    "run_count": len(runs),
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                    "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                }
            )
        return result
    except Exception as e:
        logger.error("Error listing sessions: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.post("/api/sessions", status_code=201)
async def add_session(req: SessionCreateRequest, request: Request = None):  # type: ignore
    try:
        user_id = get_user_id(request)
        if req.agent_id:
            agent = await get_agent_config(req.agent_id)
            if not agent:
                raise error_response(ErrorCode.INVALID_REQUEST, detail="Agent 不存在")
        sess = await create_session(title=req.title, user_id=user_id, agent_id=req.agent_id)
        return {
            "id": sess.id,
            "title": sess.title,
            "created_at": sess.created_at.isoformat() if sess.created_at else None,
            "updated_at": sess.updated_at.isoformat() if sess.updated_at else None,
        }
    except Exception as e:
        logger.error("Error creating session: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.get("/api/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session_detail(session_id: str, request: Request = None):  # type: ignore
    try:
        user_id = get_user_id(request)
        sess = await get_session(session_id)
        if not sess:
            raise error_response(ErrorCode.SESSION_NOT_FOUND, detail="未找到该对话")
        if sess.user_id != user_id:
            raise error_response(ErrorCode.SESSION_FORBIDDEN, detail="无权访问该对话")

        runs = await get_session_runs(session_id)
        memories = await get_session_memories(session_id)

        return {
            "id": sess.id,
            "title": sess.title,
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
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                }
                for r in runs
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
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.put("/api/sessions/{session_id}")
async def rename_session(session_id: str, req: SessionUpdateRequest, request: Request = None):  # type: ignore
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
        return {"id": sess.id, "title": sess.title, "status": "updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error renaming session %s: %s", session_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.delete("/api/sessions/{session_id}")
async def remove_session(session_id: str, request: Request = None):  # type: ignore
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
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting session %s: %s", session_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.get("/api/sessions/{session_id}/memories")
async def list_session_memories(session_id: str, request: Request = None):  # type: ignore
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
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.delete("/api/memories/{memory_id}")
async def delete_session_memory(memory_id: str) -> Any:
    try:
        deleted = await delete_memory_entry(memory_id)
        if not deleted:
            raise error_response(ErrorCode.MEMORY_NOT_FOUND, detail="未找到该记忆")
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting memory %s: %s", memory_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e


@router.get("/api/sessions/{session_id}/memories/export")
async def export_session_memories(session_id: str, format: str = "json", request: Request = None):  # type: ignore
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
        items = [
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

        if format == "json":
            content = json.dumps(items, ensure_ascii=False, default=str, indent=2)
            return Response(
                content=content,
                media_type="application/json",
                headers={"Content-Disposition": f"attachment; filename=memories_{session_id}.json"},
            )

        md_lines = [f"# Session Memories ({session_id})\n"]
        for m in memories:
            md_lines.append(f"## Memory: {m.content_type}")
            md_lines.append(

                    f"**Agent**: {m.agent_role} | "
                    f"**Created**: {m.created_at.isoformat() if m.created_at else 'N/A'}"

            )
            md_lines.append("")
            md_lines.append(f"**Summary**: {m.summary}")
            md_lines.append("")
            md_lines.append("**Details**:")
            md_lines.append(m.details or "(无详情)")
            md_lines.append("")
            md_lines.append("---")
            md_lines.append("")
        return Response(
            content="\n".join(md_lines),
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename=memories_{session_id}.md"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error exporting memories for %s: %s", session_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=str(e)) from e
