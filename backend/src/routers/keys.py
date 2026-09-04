"""企业级 API 密钥管理路由。

安全不变量：
  - 密钥绝不返回明文——所有响应都显示掩码版本
  - 从客户端视角，密钥存储只写不读
  - 解密仅发生在 Celery 任务内，绝不在 API 处理器中
  - 所有密钥变更都在 INFO 级别做审计记录
"""

import asyncio
from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field, field_validator

from auth import get_user_id
from core.error_codes import ErrorCode, error_response
from core.infra.logging_config import get_logger
from domain.capabilities import VALID, validate_capabilities
from repository import (
    create_api_key,
    delete_api_key,
    get_api_keys,
    get_key_usage_stats,
    test_api_key_connection,
    update_api_key,
)
from services.audit_service import log_audit

logger = get_logger(__name__)
router = APIRouter(tags=["keys"])


class KeyCreateRequest(BaseModel):
    provider: str = Field(..., min_length=1, max_length=32, pattern=r"^[a-z_]+$")
    capabilities: list[str] = Field(default_factory=lambda: ["llm"])
    label: str = Field(..., min_length=1, max_length=64)
    api_key: str = Field(
        ..., min_length=1, description="Plaintext API key — encrypted before storage"
    )
    base_url: str | None = None
    models: list[str] = Field(default_factory=list)
    model_types: dict[str, str] | None = None
    is_default: bool = False

    @field_validator("capabilities")
    @classmethod
    def _check_caps(cls, v: list[str]) -> list[str]:
        err = validate_capabilities(v)
        if err:
            raise ValueError(err)
        return v

    @field_validator("model_types")
    @classmethod
    def _check_model_types(cls, v: dict[str, str] | None) -> dict[str, str] | None:
        if v is None:
            return v
        for value in v.values():
            if value not in VALID:
                raise ValueError(f"未知模型类型: {value}")
        return v


class KeyUpdateRequest(BaseModel):
    capabilities: list[str] | None = Field(default=None)
    label: str | None = None
    api_key: str | None = Field(default=None, description="New plaintext key (optional)")
    base_url: str | None = None
    models: list[str] | None = None
    model_types: dict[str, str] | None = None
    is_active: bool | None = None
    is_default: bool | None = None

    @field_validator("capabilities")
    @classmethod
    def _check_caps(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        err = validate_capabilities(v)
        if err:
            raise ValueError(err)
        return v

    @field_validator("model_types")
    @classmethod
    def _check_model_types(cls, v: dict[str, str] | None) -> dict[str, str] | None:
        if v is None:
            return v
        for value in v.values():
            if value not in VALID:
                raise ValueError(f"未知模型类型: {value}")
        return v


class FetchModelsRequest(BaseModel):
    api_key: str = Field(..., min_length=1)
    base_url: str | None = None
    provider: str = Field(default="custom")


class KeyResponse(BaseModel):
    id: str
    provider: str
    capabilities: list[str]
    model_types: dict[str, str] | None = None
    label: str
    key_masked: str
    base_url: str | None
    models: list[str]
    is_active: bool
    is_default: bool
    last_used_at: str | None
    created_at: str | None


# 连通性检查在短暂同步窗口内运行，使保存密钥绝不被慢服务商 API 阻塞；
# 超时/失败时后台任务继续尝试并回填模型列表（最终一致性）。
_KEY_TEST_TIMEOUT = 3.0


def _schedule_key_models_refresh(app: Any, key_id: str, user_id: str) -> None:
    """在快速路径同步尝试失败或超时后，于后台运行连通性检查 + 模型获取。
    任务引用存放在 app.state 以防被 GC；shutdown() 会取消它们。"""
    async def _refresh() -> None:
        try:
            test_result = await test_api_key_connection(key_id, user_id)
            if test_result.get("success"):
                fetched_models = test_result.get("models", [])
                if fetched_models:
                    await update_api_key(key_id=key_id, user_id=user_id, models=fetched_models)
        except Exception:
            logger.exception("Background key model refresh failed | key=%s", key_id)

    task = asyncio.create_task(_refresh())
    pending = getattr(app.state, "pending_key_tasks", None)
    if pending is None:
        pending = set()
        app.state.pending_key_tasks = pending
    pending.add(task)
    task.add_done_callback(pending.discard)


async def _test_with_fast_path(app: Any, key_id: str, user_id: str) -> dict[str, Any]:
    """受 _KEY_TEST_TIMEOUT 限定的同步连通性检查。

    服务商及时响应时返回测试结果；否则安排后台刷新并返回降级结果，
    使密钥仍能成功保存。"""
    try:
        async with asyncio.timeout(_KEY_TEST_TIMEOUT):
            return await test_api_key_connection(key_id, user_id)
    except TimeoutError:
        logger.warning(
            "Key connectivity check timed out (non-blocking) — background refresh scheduled | key=%s",
            key_id,
        )
        _schedule_key_models_refresh(app, key_id, user_id)
        return {"success": False, "models": []}
    except Exception:
        logger.exception(
            "Key connectivity check failed (non-blocking) — background refresh scheduled | key=%s",
            key_id,
        )
        _schedule_key_models_refresh(app, key_id, user_id)
        return {"success": False, "models": []}


# ── CRUD 路由 ──────────────────────────────────────────────────────────────


@router.get("/api/keys", response_model=list[KeyResponse])
async def list_keys(request: Request) -> Any:
    """列出已认证用户的所有 API 密钥。密钥被 MASKED。"""
    user_id = get_user_id(request)
    # 包含 X-User-ID 作为回退，使在客户端生成的匿名 ID 下创建的密钥
    # 在用户认证（JWT cookie）后仍可见。
    x_uid = str(request.headers.get("X-User-ID", ""))
    fallback_ids = [x_uid] if x_uid and x_uid != user_id else None
    try:
        keys = await get_api_keys(user_id, fallback_ids=fallback_ids)
        return [
            KeyResponse(
                id=k["id"],
                provider=k["provider"],
                capabilities=k.get("capabilities", ["llm"]),
                model_types=k.get("model_types"),
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
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.post("/api/keys", status_code=201, response_model=KeyResponse)
async def add_key(req: KeyCreateRequest, request: Request) -> Any:
    """保存新的 API 密钥。自动校验连通性并获取可用模型。"""
    user_id = get_user_id(request)
    logger.info(
        "Key creation requested | user=%s | provider=%s | label=%s",
        user_id,
        req.provider,
        req.label,
    )

    obj = await create_api_key(
        user_id=user_id,
        provider=req.provider,
        capabilities=req.capabilities,
        label=req.label,
        plaintext_key=req.api_key,
        base_url=req.base_url,
        models=req.models,
        model_types=req.model_types,
        is_default=req.is_default,
    )

    # 纯 embedding 密钥跳过连通性测试与模型获取
    if set(req.capabilities) == {"embedding"}:
        from core.infra.key_vault import decrypt_api_key, mask_api_key

        return KeyResponse(
            id=obj.id,
            provider=obj.provider,
            capabilities=obj.capabilities,
            model_types=obj.model_types,
            label=obj.label,
            key_masked=mask_api_key(decrypt_api_key(obj.encrypted_key)),
            base_url=obj.base_url,
            models=[],
            is_active=obj.is_active,
            is_default=obj.is_default,
            last_used_at=obj.last_used_at.isoformat() if obj.last_used_at else None,
            created_at=obj.created_at.isoformat() if obj.created_at else None,
        )

    test_result = await _test_with_fast_path(request.app, obj.id, user_id)

    if not test_result.get("success"):
        logger.warning(
            "Key validation failed (non-blocking): %s",
            test_result.get("message", "connection error"),
        )
    fetched_models = test_result.get("models", []) if test_result.get("success") else []
    models_to_store = fetched_models if fetched_models else req.models

    await update_api_key(
        key_id=obj.id,
        user_id=user_id,
        models=models_to_store,
    )

    from core.infra.key_vault import decrypt_api_key, mask_api_key

    return KeyResponse(
        id=obj.id,
        provider=obj.provider,
        capabilities=obj.capabilities,
        model_types=obj.model_types,
        label=obj.label,
        key_masked=mask_api_key(decrypt_api_key(obj.encrypted_key)),
        base_url=obj.base_url,
        models=models_to_store,
        is_active=obj.is_active,
        is_default=obj.is_default,
        last_used_at=obj.last_used_at.isoformat() if obj.last_used_at else None,
        created_at=obj.created_at.isoformat() if obj.created_at else None,
    )


@router.put("/api/keys/{key_id}", response_model=KeyResponse)
async def edit_key(key_id: str, req: KeyUpdateRequest, request: Request) -> Any:
    """更新 API 密钥。若 api_key 或 base_url 变更则重新校验。"""
    user_id = get_user_id(request)
    result = await update_api_key(
        key_id=key_id,
        user_id=user_id,
        capabilities=req.capabilities,
        label=req.label,
        plaintext_key=req.api_key,
        base_url=req.base_url,
        models=req.models,
        model_types=req.model_types,
        is_active=req.is_active,
        is_default=req.is_default,
    )
    if not result:
        raise error_response(ErrorCode.KEY_NOT_FOUND, detail="Key not found or access denied")

    if req.api_key or req.base_url:
        test_result = await _test_with_fast_path(request.app, key_id, user_id)
        if test_result.get("success"):
            fetched_models = test_result.get("models", [])
            if fetched_models:
                await update_api_key(key_id=key_id, user_id=user_id, models=fetched_models)
                result["models"] = fetched_models

    await log_audit("create", "api_key", result["label"], "创建成功")
    return KeyResponse(
        id=result["id"],
        provider=result["provider"],
        capabilities=result.get("capabilities", ["llm"]),
        model_types=result.get("model_types"),
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
async def remove_key(key_id: str, request: Request) -> Any:
    """删除 API 密钥。不可逆——加密密钥被永久移除。"""
    user_id = get_user_id(request)
    # 删除前获取标签
    keys = await get_api_keys(user_id)
    target = next((k for k in keys if k["id"] == key_id), None)
    key_label = target["label"] if target else key_id
    deleted = await delete_api_key(key_id, user_id)
    if not deleted:
        raise error_response(ErrorCode.KEY_NOT_FOUND, detail="Key not found or access denied")
    await log_audit("delete", "api_key", key_label, "删除成功")
    logger.info("Key deleted | user=%s | key_id=%s", user_id, key_id)
    return {"status": "deleted", "id": key_id}


@router.post("/api/keys/{key_id}/test")
async def test_key_connection(key_id: str, request: Request) -> Any:
    """测试已存储密钥的连通性。不暴露明文密钥。"""
    user_id = get_user_id(request)
    result = await test_api_key_connection(key_id, user_id)
    if result.get("success"):
        return {"success": True, "message": result.get("message", "OK")}
    return {"success": False, "message": result.get("message", "Test failed")}


@router.post("/api/keys/fetch-models")
async def fetch_models_from_provider(req: FetchModelsRequest) -> Any:
    """从服务商 API 获取可用模型而不保存密钥。"""
    from repository.keys import _test_connection_sync

    key_cfg = {
        "provider": req.provider,
        "api_key": req.api_key,
        "base_url": req.base_url,
    }
    result = await asyncio.to_thread(_test_connection_sync, key_cfg)
    if result.get("success"):
        return {
            "success": True,
            "models": result.get("models", []),
            "types": result.get("types", {}),
        }
    logger.warning("Model fetch failed (non-blocking): %s", result.get("message", "unknown"))
    return {"success": False, "models": [], "types": {}, "message": result.get("message", "Connection failed")}


@router.get("/api/keys/usage")
async def key_usage(request: Request) -> Any:
    """获取已认证用户的 token 用量统计。"""
    user_id = get_user_id(request)
    try:
        stats = await get_key_usage_stats(user_id)
        return stats
    except Exception as e:
        logger.error("Error fetching usage for user %s: %s", user_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e
