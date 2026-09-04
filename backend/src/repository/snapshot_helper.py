"""统一快照辅助——管理版本快照的会话生命周期。

替代此前散落在 6 个路由文件（agents、teams、mcps、skills、prompts、
tools）中重复的 ``_snapshot_*`` / ``_do_snapshot_*`` 模式。那些文件各自
都有相同的会话管理样板，且懒加载 ``from core.infra.database import
get_session_factory`` 违反了三层严格性规则。

用法::

    from repository.snapshot_helper import create_snapshot

    # 从路由调用（内部创建会话）
    await create_snapshot("agent", agent_id, snapshot_data, "system")

    # 从已有会话的仓库函数调用
    await create_snapshot("agent", agent_id, snapshot_data, "system", session=existing_session)
"""

from collections.abc import Callable
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from core.infra.logging_config import get_logger
from repository.versions import create_version

logger = get_logger(__name__)


async def with_session(
    fn: Callable[..., Any],
    *,
    resource_type: str,
    resource_id: str,
    session: AsyncSession | None = None,
    **kwargs: Any,
) -> None:
    """在会话内执行 *fn*，或复用现有会话。

    若提供了 ``session``，则直接用其调用 *fn*。
    否则从工厂获取新会话，在其中运行 *fn* 并提交会话。

    Args:
        fn: 接收 ``(session, resource_id)`` 的异步可调用。
        resource_type: 版本资源类型标签（如 ``"agent"``）。
        resource_id: 业务实体主键。
        session: 可选的待复用异步会话。
        **kwargs: 转发给 *fn*。
    """
    if session is not None:
        await fn(session, resource_type, resource_id, **kwargs)
        return

    from core.infra.database import get_session_factory

    factory = get_session_factory()
    async with factory() as s:
        await fn(s, resource_type, resource_id, **kwargs)
        await s.commit()


async def create_snapshot_from_dict(
    resource_type: str,
    resource_id: str,
    snapshot: dict[str, Any],
    created_by: str = "system",
    session: AsyncSession | None = None,
) -> None:
    """从预构建的字典创建版本快照。

    这是最简单的变体——调用方自行准备快照字典。

    Args:
        resource_type: ``"agent"``、``"team"``、``"prompt"`` 等。
        resource_id: 业务实体主键。
        snapshot: 要持久化的任意键值快照。
        created_by: 快照创建者（默认 ``"system"``）。
        session: 可选的现有异步会话。
    """

    async def _save(s: Any, rt: str, rid: str, **kw: Any) -> None:
        await create_version(s, rt, rid, kw["snapshot"], kw.get("created_by", "system"))

    await with_session(
        _save,
        resource_type=resource_type,
        resource_id=resource_id,
        session=session,
        snapshot=snapshot,
        created_by=created_by,
    )


def build_table_snapshot(item: Any, exclude: set[str] | None = None) -> dict[str, Any]:
    """通过遍历 SQLAlchemy 模型实例的表列来构建快照字典。

    Args:
        item: 带 ``__table__`` 的 SQLAlchemy 模型实例。
        exclude: 要排除的列名（默认 ``{"id", "created_at", "updated_at"}``）。

    Returns:
        适合 ``create_version`` 的 JSON 安全 ``dict``。
    """
    if exclude is None:
        exclude = {"id", "created_at", "updated_at"}
    snapshot: dict[str, Any] = {}
    for c in item.__table__.columns:
        name = c.name
        if name in exclude:
            continue
        val = getattr(item, name, None)
        if val is not None and hasattr(val, "isoformat"):
            val = val.isoformat()
        snapshot[name] = val
    return snapshot
