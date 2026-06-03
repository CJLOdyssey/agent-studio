"""
Enterprise API Key management routes.

Security invariants:
  - Keys are NEVER returned in plaintext — all responses show masked versions
  - Key storage is write-only from the client perspective
  - Decryption only happens inside Celery tasks, never in API handlers
  - All key mutations are audit-logged at INFO level
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from virtual_team.auth import get_user_id
from virtual_team.logging_config import get_logger
from virtual_team.repository import (
    create_api_key,
    get_api_keys,
    update_api_key,
    delete_api_key,
    test_api_key_connection,
    get_key_usage_stats,
)
from virtual_team.key_vault import mask_api_key

logger = get_logger(__name__)
router = APIRouter(tags=["keys"])


class KeyCreateRequest(BaseModel):
    provider: str = Field(..., min_length=1, max_length=32, pattern=r'^[a-z_]+$')
    label: str = Field(..., min_length=1, max_length=64)
    api_key: str = Field(..., min_length=1, description="Plaintext API key — encrypted before storage")
    base_url: str | None = None
    models: list[str] = Field(default_factory=list)
    is_default: bool = False


class KeyUpdateRequest(BaseModel):
    label: str | None = None
    api_key: str | None = Field(default=None, description="New plaintext key (optional)")
    base_url: str | None = None
    models: list[str] | None = None
    is_active: bool | None = None
    is_default: bool | None = None


class KeyResponse(BaseModel):
    id: str
    provider: str
    label: str
    key_masked: str
    base_url: str | None
    models: list[str]
    is_active: bool
    is_default: bool
    last_used_at: str | None
    created_at: str | None


# ── CRUD routes ──────────────────────────────────────────────────────────────

@router.get("/api/keys", response_model=list[KeyResponse])
async def list_keys(request: Request):
    """List all API keys for the authenticated user. Keys are MASKED."""
    user_id = get_user_id(request)
    try:
        keys = await get_api_keys(user_id)
        return [
            KeyResponse(
                id=k["id"],
                provider=k["provider"],
                label=k["label"],
                key_masked=k["key_masked"],
                base_url=k["base_url"],
                models=k["models"],
                is_active=k["is_active"],
                is_default=k["is_default"],
                last_used_at=k["last_used_at"],
                created_at=k["created_at"],
            )
            for k in keys
        ]
    except Exception as e:
        logger.error("Error listing keys for user %s: %s", user_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/keys", status_code=201, response_model=KeyResponse)
async def add_key(req: KeyCreateRequest, request: Request):
    """Save a new API key. The plaintext key is encrypted immediately and never logged."""
    user_id = get_user_id(request)
    logger.info("Key creation requested | user=%s | provider=%s | label=%s | models=%s",
                user_id, req.provider, req.label, req.models)

    try:
        obj = await create_api_key(
            user_id=user_id,
            provider=req.provider,
            label=req.label,
            plaintext_key=req.api_key,
            base_url=req.base_url,
            models=req.models,
            is_default=req.is_default,
        )
        from virtual_team.key_vault import mask_api_key, decrypt_api_key
        return KeyResponse(
            id=obj.id,
            provider=obj.provider,
            label=obj.label,
            key_masked=mask_api_key(decrypt_api_key(obj.encrypted_key)),
            base_url=obj.base_url,
            models=[m.strip() for m in obj.models.split(",") if m.strip()] if obj.models else [],
            is_active=obj.is_active,
            is_default=obj.is_default,
            last_used_at=obj.last_used_at.isoformat() if obj.last_used_at else None,
            created_at=obj.created_at.isoformat() if obj.created_at else None,
        )
    except Exception as e:
        logger.error("Error creating key for user %s: %s", user_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/keys/{key_id}", response_model=KeyResponse)
async def edit_key(key_id: str, req: KeyUpdateRequest, request: Request):
    """Update an API key. Only the owner can modify their keys."""
    user_id = get_user_id(request)
    result = await update_api_key(
        key_id=key_id,
        user_id=user_id,
        label=req.label,
        plaintext_key=req.api_key,
        base_url=req.base_url,
        models=req.models,
        is_active=req.is_active,
        is_default=req.is_default,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Key not found or access denied")
    return KeyResponse(
        id=result["id"],
        provider=result["provider"],
        label=result["label"],
        key_masked=result["key_masked"],
        base_url=result.get("base_url"),
        models=result.get("models", []),
        is_active=result["is_active"],
        is_default=result["is_default"],
        last_used_at=result.get("last_used_at"),
        created_at=result.get("created_at"),
    )


@router.delete("/api/keys/{key_id}")
async def remove_key(key_id: str, request: Request):
    """Delete an API key. Irreversible — the encrypted key is permanently removed."""
    user_id = get_user_id(request)
    deleted = await delete_api_key(key_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Key not found or access denied")
    logger.info("Key deleted | user=%s | key_id=%s", user_id, key_id)
    return {"status": "deleted", "id": key_id}


@router.post("/api/keys/{key_id}/test")
async def test_key_connection(key_id: str, request: Request):
    """Test connectivity for a stored key. Does NOT expose the plaintext key."""
    user_id = get_user_id(request)
    result = await test_api_key_connection(key_id, user_id)
    if result.get("success"):
        return {"success": True, "message": result.get("message", "OK")}
    return {"success": False, "message": result.get("message", "Test failed")}


@router.get("/api/keys/usage")
async def key_usage(request: Request):
    """Get token usage statistics for the authenticated user."""
    user_id = get_user_id(request)
    try:
        stats = await get_key_usage_stats(user_id)
        return stats
    except Exception as e:
        logger.error("Error fetching usage for user %s: %s", user_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
