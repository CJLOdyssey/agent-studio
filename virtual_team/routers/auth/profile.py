"""User profile endpoints: config, me, merge guest data."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_, update

from virtual_team.auth import CurrentUser, get_current_user
from virtual_team.database import KeyUsageLog, SessionDB, UserApiKey, get_session_factory
from virtual_team.logging_config import get_logger
from virtual_team.repository.auth import get_user_by_email, get_user_by_id, get_user_roles

from .schemas import AuthConfigResponse, MergeRequest, UserResponse

logger = get_logger(__name__)

router = APIRouter(tags=["auth"])


@router.get("/config", response_model=AuthConfigResponse)
async def auth_config():
    from virtual_team.auth import AUTH_ENABLED, AUTH_MODE

    return AuthConfigResponse(enabled=AUTH_ENABLED, mode=AUTH_MODE)


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser = Depends(get_current_user)):
    user = await get_user_by_email(current_user.email)
    if user is None:
        user = await get_user_by_id(current_user.id)
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    roles = await get_user_roles(user.id)
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        roles=roles,
        is_verified=user.is_verified,
    )


@router.post("/merge")
async def merge_guest_data(
    body: MergeRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Merge ALL anonymous guest data into the authenticated user's account.

    Strategy: scan every row in the affected tables whose ``user_id``
    matches any of these patterns, then reassign it to the real user:
      1. The explicit ``guest_id`` sent by the frontend (browser's localStorage)
      2. The current ``X-User-ID`` header (may differ from #1, e.g. behind a proxy)
      3. The literal string ``anonymous`` (fallback in legacy clients)
      4. Any value starting with ``u_`` — the client-generated anonymous prefix
         (catches stale guest_ids from other browsers / localStorage resets)
    """

    x_user_id = request.headers.get("X-User-ID", "")
    explicit_ids = {body.guest_id, x_user_id, "anonymous"}
    explicit_ids.discard(current_user.id)
    explicit_ids.discard("")

    factory = get_session_factory()
    async with factory() as session:
        for table in (SessionDB, UserApiKey, KeyUsageLog):
            conditions = []
            # For UserApiKey, skip "anonymous" — it's a shared fallback for guests
            if explicit_ids:
                ids_for_table = (
                    [aid for aid in explicit_ids if aid != "anonymous"]
                    if table is UserApiKey
                    else explicit_ids
                )
                if ids_for_table:
                    conditions.extend(table.user_id == aid for aid in ids_for_table)
            conditions.append(table.user_id.startswith("u_"))

            await session.execute(
                update(table)
                .where(
                    or_(*conditions),
                    table.user_id != current_user.id,
                )
                .values(user_id=current_user.id)
            )
        await session.commit()

    logger.info(
        "Guest data merged: explicit=%s u_prefix=yes → user=%s",
        sorted(explicit_ids),
        current_user.id,
    )
    return {"status": "merged"}
