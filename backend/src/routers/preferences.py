"""User preferences endpoints — cross-device persistence (bug 2 fix)."""

from typing import Any

from fastapi import APIRouter, Request

from auth import get_user_id
from core.error_codes import ErrorCode, error_response
from core.infra.logging_config import get_logger
from repository.preference_repo import get_all_preferences, set_preference

logger = get_logger(__name__)

router = APIRouter(tags=["preferences"])


@router.get("/api/preferences")
async def list_preferences(request: Request) -> dict[str, Any]:
    """Return all preferences of the current user (guest id works too)."""
    user_id = get_user_id(request)
    try:
        return await get_all_preferences(user_id)
    except Exception as e:  # pragma: no cover - defensive
        logger.error("Error listing preferences: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.put("/api/preferences")
async def upsert_preference(request: Request, body: dict[str, Any]) -> dict[str, Any]:
    """Upsert a single preference {key, value} (last-write-wins)."""
    key = body.get("key")
    if not isinstance(key, str) or not key:
        raise error_response(ErrorCode.INVALID_REQUEST, detail="key 不能为空")
    value = body.get("value")
    user_id = get_user_id(request)
    try:
        await set_preference(user_id, key, value)
        return {"key": key, "value": value}
    except Exception as e:  # pragma: no cover - defensive
        logger.error("Error setting preference: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e
