"""附件仓库——针对 AttachmentDB 的 CRUD。"""

from sqlalchemy import and_, or_, select, update

from core.infra.database import get_session_factory
from orm import AttachmentDB

__all__ = [
    "AttachmentDB",
    "create_attachment",
    "get_attachment_by_id",
    "list_attachments_by_session",
    "list_attachments_by_run",
    "bind_attachments_to_run",
    "delete_attachment",
]


async def create_attachment(
    attachment_id: str,
    session_id: str | None,
    filename: str,
    content_type: str,
    size_bytes: int,
    storage_path: str,
    user_id: str | None = None,
    run_id: str | None = None,
    extracted_text: str | None = None,
) -> AttachmentDB:
    """创建新的附件记录并返回。"""
    attachment = AttachmentDB(
        id=attachment_id,
        session_id=session_id,
        user_id=user_id,
        run_id=run_id,
        filename=filename,
        content_type=content_type,
        size_bytes=size_bytes,
        storage_path=storage_path,
        extracted_text=extracted_text,
    )
    factory = get_session_factory()
    async with factory() as session:
        session.add(attachment)
        await session.commit()
    return attachment


async def get_attachment_by_id(attachment_id: str) -> AttachmentDB | None:
    """按 ID 获取附件。"""
    factory = get_session_factory()
    async with factory() as session:
        return await session.get(AttachmentDB, attachment_id)


async def list_attachments_by_session(session_id: str) -> list[AttachmentDB]:
    """列出会话的所有附件，按创建时间降序。"""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(AttachmentDB)
            .where(AttachmentDB.session_id == session_id)
            .order_by(AttachmentDB.created_at.desc())
        )
        return list(result.scalars().all())


async def list_attachments_by_run(run_id: str) -> list[AttachmentDB]:
    """列出 run 的所有附件，按创建时间升序。"""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(AttachmentDB)
            .where(AttachmentDB.run_id == run_id)
            .order_by(AttachmentDB.created_at.asc())
        )
        return list(result.scalars().all())


async def delete_attachment(attachment_id: str) -> str | None:
    """按 ID 删除附件。找到返回 storage_path，否则返回 None。"""
    factory = get_session_factory()
    async with factory() as session:
        attachment = await session.get(AttachmentDB, attachment_id)
        if attachment is None:
            return None
        storage_path = attachment.storage_path
        await session.delete(attachment)
        await session.commit()
        return storage_path


async def bind_attachments_to_run(
    attachment_ids: list[str], run_id: str, session_id: str, user_id: str
) -> None:
    """将预上传的附件绑定到 run。

    限定条件：附件已属于该 run 的会话，或仍处于未绑定状态（会话前上传）
    且属于同一用户。静默跳过不满足条件的 id——陌生人的待处理文件绝不可能
    被绑定。
    """
    if not attachment_ids:
        return
    factory = get_session_factory()
    async with factory() as session:
        await session.execute(
            update(AttachmentDB)
            .where(
                AttachmentDB.id.in_(attachment_ids),
                or_(
                    AttachmentDB.session_id == session_id,
                    and_(AttachmentDB.session_id.is_(None), AttachmentDB.user_id == user_id),
                ),
            )
            .values(run_id=run_id, session_id=session_id)
        )
        await session.commit()
