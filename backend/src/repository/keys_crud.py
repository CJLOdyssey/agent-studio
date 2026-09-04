"""API 密钥 CRUD 仓库——加密、存储、列出并管理用户 API 密钥。"""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import select

from core.infra.database import get_session_factory
from core.infra.key_vault import decrypt_api_key, encrypt_api_key, mask_api_key

# Re-export from keys_config for backward compatibility
from repository.keys_config import (  # noqa: F401
    get_embedding_api_key,
    get_embedding_config,
    get_key_usage_stats,
    get_rerank_config,
    get_tool_api_key,
    log_key_usage,
)

__all__ = [
    "get_embedding_api_key",
    "get_embedding_config",
    "get_key_usage_stats",
    "get_rerank_config",
    "get_tool_api_key",
    "log_key_usage",
]
from orm import UserApiKey


async def create_api_key(
    user_id: str,
    provider: str,
    capabilities: list[str] | None = None,
    label: str = "",
    plaintext_key: str = "",
    base_url: str | None = None,
    models: list[str] | None = None,
    model_types: dict[str, str] | None = None,
    is_default: bool = False,
) -> UserApiKey:
    """保存新的 API 密钥——存储前加密，返回创建的密钥。"""
    factory = get_session_factory()
    async with factory() as session:
        # 若设为默认，清除该用户的其他默认密钥
        if is_default:
            result = await session.execute(
                select(UserApiKey).where(
                    UserApiKey.user_id == user_id,
                    UserApiKey.is_default.is_(True),
                )
            )
            for row in result.scalars().all():
                row.is_default = False

        encrypted = encrypt_api_key(plaintext_key)
        obj = UserApiKey(
            id=str(uuid4()),
            user_id=user_id,
            provider=provider,
            capabilities=capabilities if capabilities is not None else ["llm"],
            label=label,
            encrypted_key=encrypted,
            base_url=base_url,
            models=",".join(models) if models else "",
            model_types=model_types,
            is_active=True,
            is_default=is_default,
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj


async def get_api_keys(
    user_id: str,
    fallback_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """列出用户的 API 密钥——密钥被 MASKED，绝不原样返回。

    当当前用户没有密钥时回退到 'anonymous' 用户的密钥，
    使新浏览器无需重新输入即可使用预配置密钥。

    ``fallback_ids``: 要搜索的额外用户 ID（如登录前的 X-User-ID），
    使在客户端生成的匿名 ID 下创建的密钥在用户认证后仍可见。
    """
    factory = get_session_factory()
    async with factory() as session:
        # 收集唯一候选 ID
        candidates = {user_id}
        if fallback_ids:
            candidates.update(fbid for fbid in fallback_ids if fbid and fbid != user_id)

        rows: list[UserApiKey] = []
        seen_ids: set[str] = set()
        # 按优先级顺序搜索候选，按密钥 id 去重
        for cid in [user_id] + (fallback_ids or []):
            if cid in ("anonymous", ""):
                continue
            stmt = (
                select(UserApiKey)
                .where(UserApiKey.user_id == cid)
                .order_by(UserApiKey.created_at)
            )
            result = await session.execute(stmt)
            for r in result.scalars().all():
                if r.id not in seen_ids:
                    rows.append(r)
                    seen_ids.add(r.id)

        # 最终回退：anonymous 用户的密钥（预配置默认值）
        if not rows and user_id != "anonymous":
            stmt = (
                select(UserApiKey)
                .where(UserApiKey.user_id == "anonymous")
                .order_by(UserApiKey.created_at)
            )
            result = await session.execute(stmt)
            rows = list(result.scalars().all())

        results = []
        for r in rows:
            try:
                key_masked = mask_api_key(decrypt_api_key(r.encrypted_key))
            except Exception:
                key_masked = "**** (解密失败，请重新添加)"
            results.append(
                {
                    "id": r.id,
                    "provider": r.provider,
                    "capabilities": list(r.capabilities or []),
                    "model_types": r.model_types,
                    "label": r.label,
                    "key_masked": key_masked,
                    "base_url": r.base_url,
                    "models": [m.strip() for m in r.models.split(",") if m.strip()]
                    if r.models
                    else [],
                    "is_active": r.is_active,
                    "is_default": r.is_default,
                    "last_used_at": r.last_used_at.isoformat() if r.last_used_at else None,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
            )
        return results


async def get_api_key_for_use(key_id: str, user_id: str) -> dict[str, Any] | None:
    """获取解密后的 API 密钥以供实际使用（非掩码）。

    Args:
        key_id: 要获取的密钥 UUID。
        user_id: 属主用户 ID。

    Returns:
        含 provider、api_key（明文）、base_url、models 的字典，
        密钥未找到或未激活时返回 None。

    """
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(UserApiKey).where(
            UserApiKey.id == key_id,
            UserApiKey.user_id == user_id,
            UserApiKey.is_active.is_(True),
        )
        result = await session.execute(stmt)
        row = result.scalar_one_or_none()

        if row is None and user_id != "anonymous":
            stmt = select(UserApiKey).where(
                UserApiKey.id == key_id,
                UserApiKey.user_id == "anonymous",
                UserApiKey.is_active.is_(True),
            )
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()

        if not row:
            return None

        row.last_used_at = datetime.now(UTC)
        await session.commit()

        return {
            "id": row.id,
            "provider": row.provider,
            "capabilities": list(row.capabilities or []),
            "model_types": row.model_types,
            "api_key": decrypt_api_key(row.encrypted_key),
            "base_url": row.base_url,
            "models": [m.strip() for m in row.models.split(",") if m.strip()] if row.models else [],
        }


async def _resolve_key_row(session: Any, user_id: str) -> Any:
    stmt = select(UserApiKey).where(
        UserApiKey.user_id == user_id,
        UserApiKey.is_active.is_(True),
        UserApiKey.is_default.is_(True),
    )
    result = await session.execute(stmt)
    row = result.scalar_one_or_none()
    if row:
        return row

    stmt = (
        select(UserApiKey)
        .where(
            UserApiKey.user_id == user_id,
            UserApiKey.is_active.is_(True),
        )
        .order_by(UserApiKey.created_at)
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_api_key_for_model(model: str, user_id: str) -> dict[str, Any] | None:
    """获取逗号分隔 models 列表包含 ``model`` 的激活密钥。

    优先用户自己的密钥，回退到 ``anonymous`` 密钥。模型匹配按条目精确
    进行——拒绝子串匹配，使 ``deepseek-v4-flash`` 密钥绝不为
    ``deepseek-v4-flash-x`` 请求服务。
    """
    if not model:
        return None

    factory = get_session_factory()
    async with factory() as session:
        row = await _match_model_in_session(session, user_id, model)
        if row is None and user_id != "anonymous":
            row = await _match_model_in_session(session, "anonymous", model)
        if not row:
            return None

        row.last_used_at = datetime.now(UTC)
        await session.commit()
        return {
            "id": row.id,
            "provider": row.provider,
            "capabilities": list(row.capabilities or []),
            "model_types": row.model_types,
            "api_key": decrypt_api_key(row.encrypted_key),
            "base_url": row.base_url,
            "models": [m.strip() for m in row.models.split(",") if m.strip()] if row.models else [],
        }


async def _match_model_in_session(session: Any, user_id: str, model: str) -> Any:
    from sqlalchemy import func

    stmt = (
        select(UserApiKey)
        .where(
            UserApiKey.user_id == user_id,
            UserApiKey.is_active.is_(True),
            func.concat(",", UserApiKey.models, ",").like(f"%,{model},%"),
        )
        .order_by(UserApiKey.created_at)
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_default_api_key(user_id: str) -> dict[str, Any] | None:
    """获取用户默认 API 密钥，带 anonymous 与系统级回退。

    回退链：用户默认 → anonymous → 系统中任一激活的默认密钥。
    """
    factory = get_session_factory()
    async with factory() as session:
        row = await _resolve_key_row(session, user_id)
        if row is None and user_id != "anonymous":
            row = await _resolve_key_row(session, "anonymous")

        # 访客回退：若访客无密钥且 anonymous 也无，则查找系统中任一
        # 激活的默认密钥。这覆盖了合并将所有访客密钥迁移到真实用户的情况。
        if row is None and user_id.startswith("u_"):
            stmt = (
                select(UserApiKey)
                .where(
                    UserApiKey.is_active.is_(True),
                    UserApiKey.is_default.is_(True),
                )
                .limit(1)
            )
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()

        if not row:
            return None

        row.last_used_at = datetime.now(UTC)
        await session.commit()

        return {
            "id": row.id,
            "provider": row.provider,
            "api_key": decrypt_api_key(row.encrypted_key),
            "base_url": row.base_url,
            "models": [m.strip() for m in row.models.split(",") if m.strip()] if row.models else [],
        }


async def update_api_key(
    key_id: str,
    user_id: str,
    label: str | None = None,
    plaintext_key: str | None = None,
    base_url: str | None = None,
    models: list[str] | None = None,
    is_active: bool | None = None,
    is_default: bool | None = None,
    capabilities: list[str] | None = None,
    model_types: dict[str, str] | None = None,
) -> dict[str, Any] | None:
    """更新 API 密钥配置。"""
    factory = get_session_factory()
    async with factory() as session:
        row = await session.get(UserApiKey, key_id)
        if row is None:
            return None
        owner_match = row.user_id == user_id
        anonymous_fallback = user_id != "anonymous" and row.user_id == "anonymous"
        if not owner_match and not anonymous_fallback:
            return None

        if label is not None:
            row.label = label
        if plaintext_key is not None:
            row.encrypted_key = encrypt_api_key(plaintext_key)
        if base_url is not None:
            row.base_url = base_url
        if models is not None:
            row.models = ",".join(models)
        if capabilities is not None:
            row.capabilities = capabilities
        if model_types is not None:
            row.model_types = model_types
        if is_active is not None:
            row.is_active = is_active
        if is_default is not None:
            row.is_default = is_default
            if is_default:
                # 清除其他默认密钥
                result = await session.execute(
                    select(UserApiKey).where(
                        UserApiKey.user_id == user_id,
                        UserApiKey.is_default.is_(True),
                        UserApiKey.id != key_id,
                    )
                )
                for other in result.scalars().all():
                    other.is_default = False

        row.updated_at = datetime.now(UTC)
        await session.commit()

        return {
            "id": row.id,
            "label": row.label,
            "provider": row.provider,
            "capabilities": list(row.capabilities or []),
            "model_types": row.model_types,
            "key_masked": mask_api_key(decrypt_api_key(row.encrypted_key)),
            "is_active": row.is_active,
            "is_default": row.is_default,
        }


async def delete_api_key(key_id: str, user_id: str) -> bool:
    """删除 API 密钥。未找到或不属于用户时返回 False。"""
    factory = get_session_factory()
    async with factory() as session:
        row = await session.get(UserApiKey, key_id)
        if row is None:
            return False
        owner_match = row.user_id == user_id
        anonymous_fallback = user_id != "anonymous" and row.user_id == "anonymous"
        if not owner_match and not anonymous_fallback:
            return False
        await session.delete(row)
        await session.commit()
        return True
