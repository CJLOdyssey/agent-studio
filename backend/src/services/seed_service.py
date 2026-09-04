"""默认数据种子服务 —— 角色与 admin 用户的引导，及内置工具的同步。"""

import os

from sqlalchemy import select

from core.infra.database import get_session_factory
from orm import RegisteredToolDB, RoleDB, UserDB, UserRoleDB

# 引导 admin 密码。仅开发默认 —— 生产必须通过环境变量覆盖。
DEFAULT_ADMIN_PASSWORD = "admin123"
ADMIN_PASSWORD_ENV = "SEED_ADMIN_PASSWORD"


async def seed_default_roles_and_admin() -> None:
    """若不存在则创建默认角色（admin、member）与 admin 用户。"""
    import bcrypt

    factory = get_session_factory()
    async with factory() as session:
        admin_role = await session.execute(select(RoleDB).where(RoleDB.name == "admin"))
        if not admin_role.scalar_one_or_none():
            session.add(RoleDB(name="admin", permissions={"all": True}))
        member_role = await session.execute(select(RoleDB).where(RoleDB.name == "member"))
        if not member_role.scalar_one_or_none():
            session.add(RoleDB(name="member", permissions={"read": True}))
        await session.commit()

    admin_user = await session.execute(select(UserDB).where(UserDB.username == "admin"))
    if not admin_user.scalar_one_or_none():
        admin_role_db = (
            await session.execute(select(RoleDB).where(RoleDB.name == "admin"))
        ).scalar_one_or_none()
        user = UserDB(
            username="admin",
            email="admin@example.com",
            password_hash=bcrypt.hashpw(
                os.environ.get(ADMIN_PASSWORD_ENV, DEFAULT_ADMIN_PASSWORD).encode(),
                bcrypt.gensalt(),
            ).decode(),
            is_active=True,
            is_verified=True,
        )
        session.add(user)
        await session.flush()
        if admin_role_db:
            session.add(UserRoleDB(user_id=user.id, role_id=admin_role_db.id))
        await session.commit()


async def seed_builtin_tools() -> None:
    """将 ToolRegistry 中已注册插件同步到 registered_tools 表。"""
    import json

    import thinking_tree.tools  # noqa: F401 — 触发插件注册
    from thinking_tree.registry import registry

    factory = get_session_factory()
    plugins = registry.list_plugins()
    async with factory() as session:
        for p in plugins:
            name = p["tool_name"]
            result = await session.execute(
                select(RegisteredToolDB).where(
                    RegisteredToolDB.name == name,
                    RegisteredToolDB.is_builtin,
                )
            )
            if result.scalar_one_or_none():
                continue
            tool = RegisteredToolDB(
                name=name,
                category="builtin",
                description=p.get("description", ""),
                status="active",
                version="v1.0.0",
                parameters=json.dumps(p.get("config_schema") or {"type": "object", "properties": {}}),
                is_builtin=True,
            )
            session.add(tool)
        await session.commit()
