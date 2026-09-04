"""聊天消息仓库——会话消息的持久化。"""

import json
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select

from core.infra.database import get_session_factory
from orm import ChatMessage, ProjectRun


async def save_message(run_id: str, role: str, agent_name: str, content: str, round_number: int, thinking: str | None = None) -> None:  # noqa: E501
    """将聊天消息持久化到数据库。"""
    msg = ChatMessage(
        id=str(uuid4()),
        run_id=run_id,
        role=role,
        agent_name=agent_name,
        content=content,
        thinking=thinking,
        round_number=round_number,
        created_at=datetime.now(UTC),
    )
    factory = get_session_factory()
    async with factory() as session:
        session.add(msg)
        await session.commit()


async def update_message_content(message_id: str, content: str) -> None:
    """原地替换聊天消息的内容。"""
    factory = get_session_factory()
    async with factory() as session:
        msg = await session.get(ChatMessage, message_id)
        if msg is not None:
            msg.content = content
            await session.commit()


async def update_message_versions(
    message_id: str,
    versions: list[str] | None = None,
    thinking_versions: list[str] | None = None,
) -> None:
    """持久化 agent 消息的回答版本历史（JSON 编码）。"""
    factory = get_session_factory()
    async with factory() as session:
        msg = await session.get(ChatMessage, message_id)
        if msg is None:
            return
        if versions is not None:
            msg.versions = json.dumps(versions, ensure_ascii=False)
        if thinking_versions is not None:
            msg.thinking_versions = json.dumps(thinking_versions, ensure_ascii=False)
        await session.commit()


async def get_messages(run_id: str) -> list[ChatMessage]:
    """返回 run 的所有聊天消息，按时间顺序排序。"""
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(ChatMessage).where(ChatMessage.run_id == run_id).order_by(ChatMessage.created_at)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def get_run_messages(run_id: str) -> list[ChatMessage]:
    """返回 run 的所有聊天消息，按时间顺序排序（别名）。"""
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(ChatMessage).where(ChatMessage.run_id == run_id).order_by(ChatMessage.created_at)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def get_session_messages(
    session_id: str, exclude_run_id: str | None = None
) -> list[ChatMessage]:
    """返回会话内所有 run 的所有聊天消息，按时间顺序排序。

    Args:
        session_id: 父会话 UUID。
        exclude_run_id: 若提供，跳过该 run 的消息。

    Returns:
        按创建时间排序的 ChatMessage 行列表。

    """
    factory = get_session_factory()
    async with factory() as session:
        # 获取该会话的所有 run ID
        runs_stmt = select(ProjectRun.id).where(ProjectRun.session_id == session_id)
        if exclude_run_id:
            runs_stmt = runs_stmt.where(ProjectRun.id != exclude_run_id)
        runs_result = await session.execute(runs_stmt)
        run_ids = [r[0] for r in runs_result.all()]

        if not run_ids:
            return []

        # 获取这些 run 的所有消息
        msgs_stmt = (
            select(ChatMessage)
            .where(ChatMessage.run_id.in_(run_ids))
            .order_by(ChatMessage.created_at)
        )
        msgs_result = await session.execute(msgs_stmt)
        return list(msgs_result.scalars().all())
