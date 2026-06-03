"""Attachment API routes."""

import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from virtual_team.logging_config import get_logger
from virtual_team.database import get_session_factory
from virtual_team.database import AttachmentDB as Attachment
from virtual_team.models import AttachmentResponse
from virtual_team.repository import get_session

logger = get_logger(__name__)
router = APIRouter(tags=["attachments"])

MAX_FILE_SIZE_MB = 10
ALLOWED_CONTENT_TYPES = {
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "application/pdf",
    "text/plain", "text/markdown", "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/json",
}
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _validate_upload(content_type: str, size: int) -> None:
    if size > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"文件超过 {MAX_FILE_SIZE_MB}MB 限制")
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail=f"不支持的文件类型: {content_type}")


async def _extract_text(file_path: Path, content_type: str) -> str:
    try:
        if content_type.startswith("text/") or content_type == "application/json":
            return file_path.read_text(encoding="utf-8", errors="ignore")[:50000]
        if content_type == "application/pdf":
            return "[PDF 文档 - 需要后端解析库支持, 当前为占位符]"
        if content_type.startswith("image/"):
            return f"[图片文件 - {file_path.stat().st_size} bytes]"
    except Exception as e:
        logger.warning("Text extraction failed: %s", e)
    return ""


@router.post("/api/attachments", response_model=AttachmentResponse)
async def upload_attachment(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    run_id: str | None = Form(None),
):
    sess = await get_session(session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="会话不存在")

    content_type = file.content_type or "application/octet-stream"
    content = await file.read()
    _validate_upload(content_type, len(content))

    attachment_id = str(uuid4())
    safe_filename = f"{attachment_id}_{file.filename or 'unnamed'}"
    storage_path = UPLOAD_DIR / session_id / safe_filename
    storage_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        storage_path.write_bytes(content)
    except Exception as e:
        logger.error("Failed to save attachment: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="文件保存失败")

    extracted = await _extract_text(storage_path, content_type)

    db_attachment = Attachment(
        id=attachment_id,
        session_id=session_id,
        run_id=run_id,
        filename=file.filename or "unnamed",
        content_type=content_type,
        size_bytes=len(content),
        storage_path=str(storage_path),
        extracted_text=extracted,
    )

    factory = get_session_factory()
    async with factory() as db:
        db.add(db_attachment)
        await db.commit()

    logger.info("Attachment uploaded | id=%s | session=%s | size=%d", attachment_id, session_id, len(content))

    return AttachmentResponse(
        id=attachment_id,
        filename=file.filename or "unnamed",
        content_type=content_type,
        size_bytes=len(content),
        session_id=session_id,
        run_id=run_id,
        has_extracted_text=bool(extracted),
        created_at=datetime.now(timezone.utc),
    )


@router.get("/api/attachments/{attachment_id}")
async def get_attachment(attachment_id: str):
    factory = get_session_factory()
    async with factory() as db:
        att = await db.get(Attachment, attachment_id)
        if att is None:
            raise HTTPException(status_code=404, detail="附件不存在")
        if not Path(att.storage_path).exists():
            raise HTTPException(status_code=410, detail="文件已丢失")
        return FileResponse(
            att.storage_path,
            media_type=att.content_type,
            filename=att.filename,
        )


@router.get("/api/sessions/{session_id}/attachments", response_model=list[AttachmentResponse])
async def list_session_attachments(session_id: str):
    sess = await get_session(session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="会话不存在")

    factory = get_session_factory()
    async with factory() as db:
        from sqlalchemy import select
        result = await db.execute(
            select(Attachment).where(Attachment.session_id == session_id).order_by(Attachment.created_at.desc())
        )
        attachments = result.scalars().all()

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
async def delete_attachment(attachment_id: str):
    factory = get_session_factory()
    async with factory() as db:
        att = await db.get(Attachment, attachment_id)
        if att is None:
            raise HTTPException(status_code=404, detail="附件不存在")
        storage_path = Path(att.storage_path)
        await db.delete(att)
        await db.commit()

    try:
        if storage_path.exists():
            storage_path.unlink()
    except Exception as e:
        logger.warning("Failed to delete file from disk: %s", e)

    return {"success": True, "id": attachment_id}
