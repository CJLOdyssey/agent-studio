"""附件 API 路由。"""

import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import FileResponse

from auth import get_user_id
from core.error_codes import ErrorCode, error_response
from core.infra.logging_config import get_logger
from core.models import AttachmentResponse
from extract import ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE_MB, extract_text, validate_magic, validate_upload
from repository import get_session
from repository.attachments import (
    AttachmentDB,
    create_attachment,
    get_attachment_by_id,
    list_attachments_by_session,
)
from repository.attachments import (
    delete_attachment as repo_delete_attachment,
)

logger = get_logger(__name__)
router = APIRouter(tags=["attachments"])

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "./uploads")).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _validate_session_id(session_id: str) -> str:
    """在会话 ID 触达文件系统前拒绝路径遍历形态的 ID。"""
    if not _SESSION_ID_RE.fullmatch(session_id):
        raise error_response(ErrorCode.INVALID_REQUEST, detail="非法的会话 ID")
    return session_id


async def _ensure_session_access(session_id: str, user_id: str) -> None:
    """会话必须存在；启用认证时，必须属于调用方。"""
    sess = await get_session(session_id)
    if sess is None:
        raise error_response(ErrorCode.SESSION_NOT_FOUND, detail="会话不存在")
    if os.environ.get("AUTH_ENABLED", "0") == "1" and sess.user_id != user_id:
        raise error_response(ErrorCode.SESSION_FORBIDDEN, detail="无权访问该会话")


async def _ensure_attachment_access(attachment_id: str, user_id: str) -> AttachmentDB:
    """附件必须存在；属主检查覆盖已绑定与待处理的文件。

    已绑定（session_id 已设）→ 会话属主。待处理（无会话）→ 上传者。
    """
    att = await get_attachment_by_id(attachment_id)
    if att is None:
        raise error_response(ErrorCode.ATTACHMENT_NOT_FOUND, detail="附件不存在")
    if os.environ.get("AUTH_ENABLED", "0") == "1":
        if att.session_id:
            await _ensure_session_access(att.session_id, user_id)
        elif att.user_id != user_id:
            raise error_response(ErrorCode.SESSION_FORBIDDEN, detail="无权访问该附件")
    return att


def _ensure_storage_inside_upload_dir(storage_path: str) -> Path:
    """纵深防御：持久化的路径必须保持在 UPLOAD_DIR 内。"""
    p = Path(storage_path)
    if not p.resolve().is_relative_to(UPLOAD_DIR):
        raise error_response(ErrorCode.ATTACHMENT_NOT_FOUND, detail="附件不存在")
    return p


@router.post("/api/attachments", response_model=AttachmentResponse, status_code=201)
async def upload_attachment(
    request: Request,
    file: UploadFile = File(...),  # noqa: B008
    session_id: str | None = Form(None),
    run_id: str | None = Form(None),
) -> Any:
    """上传文件附件，可选地绑定到会话。

    会话前上传（首条消息在会话存在前携带文件）归上传者所有，存储于用户作用域
    目录下；run 创建时将它们绑定到会话/run。
    """
    user_id = get_user_id(request)
    if session_id is not None:
        _validate_session_id(session_id)
        await _ensure_session_access(session_id, user_id)

    content_type = file.content_type or "application/octet-stream"
    content = await file.read()
    validate_upload(content_type, len(content))
    validate_magic(content, content_type)

    attachment_id = str(uuid4())
    from pathlib import Path as _Path
    raw_name = _Path(file.filename).name if file.filename else "unnamed"
    safe_filename = f"{attachment_id}_{raw_name}"
    storage_dir = UPLOAD_DIR / session_id if session_id else UPLOAD_DIR / f"_u_{user_id}"
    storage_path = storage_dir / safe_filename
    storage_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        storage_path.write_bytes(content)
    except Exception as e:
        logger.error("Failed to save attachment: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail="文件保存失败") from e

    extracted = extract_text(storage_path, content_type)

    await create_attachment(
        attachment_id=attachment_id,
        session_id=session_id,
        user_id=user_id,
        run_id=run_id,
        filename=file.filename or "unnamed",
        content_type=content_type,
        size_bytes=len(content),
        storage_path=str(storage_path),
        extracted_text=extracted,
    )

    logger.info(
        "Attachment uploaded | id=%s | session=%s | size=%d",
        attachment_id,
        session_id,
        len(content),
    )

    return AttachmentResponse(
        id=attachment_id,
        filename=file.filename or "unnamed",
        content_type=content_type,
        size_bytes=len(content),
        session_id=session_id,
        run_id=run_id,
        has_extracted_text=bool(extracted),
        created_at=datetime.now(UTC),
    )


@router.get("/api/attachments/upload-config")
async def upload_config() -> dict[str, Any]:
    """暴露上传约束，使前端保持单一数据源。

    前端获取白名单而非维护自己的副本；新增格式只需改动
    ``extract.registry``（若是新格式还需加解析器）。
    """
    return {
        "allowed_content_types": sorted(ALLOWED_CONTENT_TYPES),
        "max_file_size_mb": MAX_FILE_SIZE_MB,
    }


@router.get("/api/attachments/{attachment_id}")
async def get_attachment(attachment_id: str, request: Request) -> Any:
    """按 ID 下载附件文件。"""
    user_id = get_user_id(request)
    att = await _ensure_attachment_access(attachment_id, user_id)
    storage_path = _ensure_storage_inside_upload_dir(att.storage_path)
    if not storage_path.exists():
        raise error_response(ErrorCode.ATTACHMENT_FILE_MISSING, detail="文件已丢失")
    return FileResponse(
        str(storage_path),
        media_type=att.content_type,
        filename=att.filename,
    )


@router.get("/api/sessions/{session_id}/attachments", response_model=list[AttachmentResponse])
async def list_session_attachments(session_id: str, request: Request) -> Any:
    """列出属于某会话的所有附件。"""
    _validate_session_id(session_id)
    user_id = get_user_id(request)
    await _ensure_session_access(session_id, user_id)

    attachments = await list_attachments_by_session(session_id)

    return [
        AttachmentResponse(
            id=a.id,
            filename=a.filename,
            content_type=a.content_type,
            size_bytes=a.size_bytes,
            session_id=a.session_id,
            run_id=a.run_id,
            has_extracted_text=bool(a.extracted_text),
            created_at=a.created_at,
        )
        for a in attachments
    ]


@router.delete("/api/attachments/{attachment_id}")
async def delete_attachment(attachment_id: str, request: Request) -> Any:
    """从 DB 与磁盘删除附件。"""
    user_id = get_user_id(request)
    await _ensure_attachment_access(attachment_id, user_id)

    storage_path_str = await repo_delete_attachment(attachment_id)
    if storage_path_str is None:
        raise error_response(ErrorCode.ATTACHMENT_NOT_FOUND, detail="附件不存在")

    try:
        storage_path_disk = _ensure_storage_inside_upload_dir(storage_path_str)
        if storage_path_disk.exists():
            storage_path_disk.unlink()
    except Exception as e:
        logger.warning("Failed to delete file from disk: %s", e)

    return {"success": True, "id": attachment_id}
