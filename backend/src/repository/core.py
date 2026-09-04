"""共享仓库辅助——属主过滤与分页。"""

from typing import Any, TypeVar

_T = TypeVar("_T")


def apply_owner_filter(
    stmt: Any,
    model_class: Any,
    owner_id: str | None = None,
) -> Any:
    """当 RBAC 激活时，向 select 语句追加 ``owner_id`` 过滤。

    若 ``owner_id`` 为 ``None`` 或 ``"*"``，则不应用过滤（管理员视图）。
    """
    if owner_id and owner_id != "*" and hasattr(model_class, "owner_id"):
        return stmt.where(model_class.owner_id == owner_id)
    return stmt

