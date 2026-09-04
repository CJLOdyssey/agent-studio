"""用户资料端点：config、me、合并访客数据。"""

from typing import Any

from fastapi import APIRouter, Depends, Request

from auth import CurrentUser, get_current_user
from core.error_codes import ErrorCode, error_response
from core.infra.logging_config import get_logger
from repository.auth import (
    get_user_by_email,
    get_user_by_id,
    get_user_roles,
)
from repository.auth import (
    merge_guest_data as _merge_guest_data,
)

from .schemas import AuthConfigResponse, MergeRequest, UserResponse

logger = get_logger(__name__)

router = APIRouter(tags=["auth"])


@router.get("/config", response_model=AuthConfigResponse)
def auth_config() -> Any:
    """返回当前认证模式与启用状态。"""
    from auth import AUTH_ENABLED, AUTH_MODE

    return AuthConfigResponse(enabled=AUTH_ENABLED, mode=AUTH_MODE)


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser = Depends(get_current_user)) -> Any:
    """返回当前已认证用户的资料。"""
    user = await get_user_by_email(current_user.email)
    if user is None:
        user = await get_user_by_id(current_user.id)
    if user is None:
        raise error_response(ErrorCode.AUTH_USER_NOT_FOUND, detail="用户不存在")
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
) -> Any:
    """将所有匿名访客数据合并到已认证用户账户。

    策略：扫描受影响表中 ``user_id`` 匹配以下任一模式的行，然后重新分配给
    真实用户：
      1. 前端发送的显式 ``guest_id``（浏览器的 localStorage）
      2. 当前 ``X-User-ID`` 头（可能与 #1 不同，例如经代理）
      3. 字面量 ``anonymous``（旧客户端中的回退）
      4. 任何以 ``u_`` 开头的值——客户端生成的匿名前缀
         （捕获来自其他浏览器 / localStorage 重置的过期 guest_id）
    """
    x_user_id = request.headers.get("X-User-ID", "")
    explicit_ids = {body.guest_id, x_user_id, "anonymous"}
    explicit_ids.discard(current_user.id)
    explicit_ids.discard("")

    await _merge_guest_data(explicit_ids, current_user.id)

    logger.info(
        "Guest data merged: explicit=%s u_prefix=yes → user=%s",
        sorted(explicit_ids),
        current_user.id,
    )
    return {"status": "merged"}
