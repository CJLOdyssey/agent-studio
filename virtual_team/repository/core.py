"""Shared repository helpers — owner filtering and pagination."""

from typing import TypeVar, Any

_T = TypeVar("_T")


def apply_owner_filter(stmt, model_class, owner_id: str | None = None) -> Any:  # type: ignore[no-untyped-def]
    """Append an ``owner_id`` filter to a select statement when RBAC is active.

    If ``owner_id`` is ``None`` or ``"*"``, no filtering is applied (admin view).
    """
    if owner_id and owner_id != "*" and hasattr(model_class, "owner_id"):
        return stmt.where(model_class.owner_id == owner_id)
    return stmt

