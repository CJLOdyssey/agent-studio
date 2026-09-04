"""认证仓库——用户查找、凭据管理与令牌轮换。"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from sqlalchemy import or_, select, update

from core.infra.database import get_session_factory
from core.infra.logging_config import get_logger
from orm import (
    KeyUsageLog,
    RefreshTokenDB,
    RoleDB,
    SessionDB,
    UserApiKey,
    UserDB,
    UserPreferenceDB,
    UserRoleDB,
)

logger = get_logger(__name__)


async def get_user_by_email(email: str) -> UserDB | None:
    """按邮箱地址查找用户。"""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(UserDB).where(UserDB.email == email))
        return result.scalar_one_or_none()


async def get_user_by_id(user_id: str) -> UserDB | None:
    """按主键 ID 查找用户。"""
    factory = get_session_factory()
    async with factory() as session:
        return await session.get(UserDB, user_id)


async def get_user_by_username(username: str) -> UserDB | None:
    """按用户名查找用户。"""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(UserDB).where(UserDB.username == username))
        return result.scalar_one_or_none()


async def create_user(
    email: str,
    password_hash: str,
    username: str | None = None,
    is_verified: bool = False,
) -> UserDB:
    """创建新用户并可选地分配 "member" 角色。

    Args:
        email: 用户邮箱地址。
        password_hash: 预哈希的密码字符串。
        username: 展示名（默认取邮箱前缀）。
        is_verified: 邮箱是否已验证。

    Returns:
        新创建的 UserDB 实例。

    """
    factory = get_session_factory()
    async with factory() as session:
        user = UserDB(
            id=str(uuid4()),
            email=email,
            username=username or email.split("@")[0],
            password_hash=password_hash,
            is_active=True,
            is_verified=is_verified,
            auth_provider="email",
        )
        session.add(user)
        await session.flush()

        role_result = await session.execute(select(RoleDB).where(RoleDB.name == "member"))
        member_role = role_result.scalar_one_or_none()
        if member_role:
            session.add(UserRoleDB(user_id=user.id, role_id=member_role.id))

        await session.commit()
        await session.refresh(user)
        return user


async def mark_user_verified(user_id: str) -> None:
    """将用户的已验证标志设为 True。"""
    factory = get_session_factory()
    async with factory() as session:
        user = await session.get(UserDB, user_id)
        if user:
            user.is_verified = True
            await session.commit()


async def update_password(user_id: str, new_hash: str) -> None:
    """更新用户密码哈希并重置登录计数器。"""
    factory = get_session_factory()
    async with factory() as session:
        user = await session.get(UserDB, user_id)
        if user:
            user.password_hash = new_hash
            user.failed_login_attempts = 0
            user.locked_until = None
            await session.commit()


async def increment_failed_logins(email: str) -> int:
    """为邮箱递增失败登录计数器；失败 5 次后锁定。

    当尝试次数超过锁定阈值（5）时账户被临时锁定，并记录一条安全相关的
    ``level=error`` 审计条目（暴力破解探测在防篡改审计追踪中可见）。
    审计写入为尽力而为——失败绝不会破坏登录。

    Returns:
        新的失败尝试次数。

    """
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(UserDB).where(UserDB.email == email))
        user = result.scalar_one_or_none()
        if not user:
            return 0
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        count = user.failed_login_attempts
        locked_now = False
        if count >= 5:
            user.locked_until = datetime.now(UTC) + timedelta(minutes=15)
            locked_now = True
        await session.commit()

    if locked_now:
        try:
            from repository.audit import create_audit_entry

            await create_audit_entry(
                action="account_locked",
                entity_type="user",
                entity_name=email,
                detail=f"连续 {count} 次登录失败，账户已临时锁定",
                level="error",
            )
        except Exception:  # noqa: BLE001 — 审计写入绝不能破坏登录
            logger.warning("Failed to write account-lockout audit entry for %s", email, exc_info=True)
    return count


async def reset_failed_logins(email: str) -> None:
    """重置失败登录计数器并解锁用户账户。"""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(UserDB).where(UserDB.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.failed_login_attempts = 0
            user.locked_until = None
            await session.commit()


async def get_user_roles(user_id: str) -> list[str]:
    """返回分配给用户的角色名列表。"""
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(RoleDB.name)
            .join(UserRoleDB, RoleDB.id == UserRoleDB.role_id)
            .where(UserRoleDB.user_id == user_id)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


# ── 刷新令牌操作 ─────────────────────────────────────────────


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _generate_refresh_token() -> str:
    return secrets.token_urlsafe(32)


async def create_refresh_token(user_id: str, family_id: str | None = None, ttl_days: int = 7) -> tuple[str, str]:
    """为用户生成并存储新的刷新令牌。

    Args:
        user_id: 要关联令牌的用户。
        family_id: 用于轮换的令牌族（None 则自动生成）。
        ttl_days: 令牌过期前的天数。

    Returns:
        (plain_token, token_hash) 元组。

    """
    token = _generate_refresh_token()
    token_hash = _hash_token(token)
    family_id = family_id or str(uuid4())

    factory = get_session_factory()
    async with factory() as session:
        obj = RefreshTokenDB(
            id=str(uuid4()),
            user_id=user_id,
            token_hash=token_hash,
            family_id=family_id,
            expires_at=datetime.now(UTC) + timedelta(days=ttl_days),
        )
        session.add(obj)
        await session.commit()
    return token, token_hash


async def consume_refresh_token(token: str) -> tuple[UserDB | None, str | None]:
    """验证并消费刷新令牌（轮换）。

    成功返回 (user, new_family_id)，失败返回 (None, None)。
    正常轮换时 new_family_id 为 None，重放攻击时为新的 uuid4。
    """
    token_hash = _hash_token(token)
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(RefreshTokenDB).where(RefreshTokenDB.token_hash == token_hash)
        )
        rt = result.scalar_one_or_none()

        if rt is None:
            return None, None

        if rt.revoked_at is not None:
            # 重放攻击——撤销整个令牌族
            await session.execute(
                select(RefreshTokenDB).where(RefreshTokenDB.family_id == rt.family_id)
            )
            family_result = await session.execute(
                select(RefreshTokenDB).where(RefreshTokenDB.family_id == rt.family_id)
            )
            for row in family_result.scalars().all():
                row.revoked_at = datetime.now(UTC)
            await session.commit()
            return None, None

        expires = rt.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        if expires < datetime.now(UTC):
            return None, None

        # 轮换：撤销当前令牌，检查全局撤销
        rt.revoked_at = datetime.now(UTC)

        user = await session.get(UserDB, rt.user_id)
        if user is None:
            await session.commit()
            return None, None

        await session.commit()
        return user, rt.family_id


async def revoke_all_user_tokens(user_id: str) -> None:
    """撤销用户所有激活的刷新令牌。"""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(RefreshTokenDB).where(
                RefreshTokenDB.user_id == user_id,
                RefreshTokenDB.revoked_at.is_(None),
            )
        )
        now = datetime.now(UTC)
        for row in result.scalars().all():
            row.revoked_at = now
        await session.commit()


async def revoke_token_family(family_id: str) -> None:
    """撤销属于某令牌族的所有令牌（轮换刷新）。"""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(RefreshTokenDB).where(RefreshTokenDB.family_id == family_id)
        )
        now = datetime.now(UTC)
        for row in result.scalars().all():
            row.revoked_at = now
        await session.commit()


async def merge_guest_data(guest_ids: set[str], real_user_id: str) -> None:
    """将所有访客数据行重新分配给已认证用户。

    对每个表（SessionDB、UserApiKey、KeyUsageLog、UserPreferenceDB），
    更新 ``user_id`` 匹配任一 ``guest_id`` 或以 ``u_``（客户端生成的匿名前缀）
    开头的行，将 ``user_id = real_user_id``。SessionDB 还合并字面量
    ``anonymous`` 回退（对话历史的共享遗留命名空间）。UserApiKey 与
    UserPreferenceDB 跳过 ``anonymous``——它是未发送 ``X-User-ID`` 的客户端
    （curl/脚本）的共享回退，而非唯一访客身份；合并它会把其他客户端的
    key/偏好导入真实用户账户。偏好使用 upsert，因为其主键是
    ``(user_id, key)``——普通 UPDATE 可能与真实用户已有 key 冲突并使整个
    合并回滚。

    Args:
        guest_ids: 候选访客标识集合（已过滤掉真实用户 ID 与空字符串）。
        real_user_id: 要重新分配数据到的已认证用户 ID。
    """
    factory = get_session_factory()
    async with factory() as session:
        for table in (SessionDB, UserApiKey, KeyUsageLog):
            conditions: list[Any] = []

            if guest_ids:
                # 对 UserApiKey，跳过 "anonymous"——它是共享回退
                ids_for_table = (
                    [aid for aid in guest_ids if aid != "anonymous"]
                    if table is UserApiKey
                    else list(guest_ids)
                )
                if ids_for_table:
                    conditions.extend(table.user_id == aid for aid in ids_for_table)

            conditions.append(table.user_id.startswith("u_"))

            await session.execute(
                update(table)
                .where(
                    or_(*conditions),
                    table.user_id != real_user_id,
                )
                .values(user_id=real_user_id)
            )

        # user_preferences 主键是 (user_id, key)：直接把 user_id 改成正式用户
        # 会撞唯一约束（guest 与正式用户已有同一 key），整笔事务回滚。改为逐行
        # upsert——正式用户已有该 key 则覆盖为 guest 最新值（与偏好 last-write-
        # wins 语义一致），否则新建，保证 guest 合并永不失败。
        # user_preferences 与 UserApiKey 同理：跳过共享兜底命名空间 "anonymous"。
        # 前端真实 guest 会话由 axios 拦截器生成唯一 u_<timestamp>_<random> id
        # （经 get_user_id 的 X-User-ID 解析）；"anonymous" 仅是未带 X-User-ID
        # 的客户端（curl/脚本/旧客户端）共享兜底——并入它会把其他浏览器的偏好
        # 导入正式用户账户（跨用户泄漏）。下方 startswith("u_") 已覆盖所有真实
        # guest 偏好行。
        guest_ids_for_pref = [g for g in guest_ids if g != "anonymous"]
        pref_conditions: list[Any] = []
        if guest_ids_for_pref:
            pref_conditions.extend(UserPreferenceDB.user_id == g for g in guest_ids_for_pref)
        pref_conditions.append(UserPreferenceDB.user_id.startswith("u_"))
        pref_rows = await session.execute(
            select(UserPreferenceDB).where(
                or_(*pref_conditions),
                UserPreferenceDB.user_id != real_user_id,
            )
        )
        for pref in pref_rows.scalars().all():
            target = await session.get(UserPreferenceDB, (real_user_id, pref.key))
            if target is None:
                session.add(UserPreferenceDB(user_id=real_user_id, key=pref.key, value=pref.value))
            else:
                target.value = pref.value
        await session.commit()
