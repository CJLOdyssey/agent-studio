"""Default data seeding — roles and admin user bootstrap."""

from sqlalchemy import select

from core.infra.database import get_session_factory
from orm import RoleDB, UserDB, UserRoleDB


async def seed_default_roles_and_admin() -> None:
    """Create default roles (admin, member) and an admin user if they don't exist."""
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
            email="admin@legacy.local",
            password_hash=bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode(),
            is_active=True,
            is_verified=True,
        )
        session.add(user)
        await session.flush()
        if admin_role_db:
            session.add(UserRoleDB(user_id=user.id, role_id=admin_role_db.id))
        await session.commit()


async def seed_builtin_tools() -> None:
    """Sync registered plugins from ToolRegistry into registered_tools table."""
    import json
    from sqlalchemy import select
    from core.infra.database import get_session_factory
    from orm import RegisteredToolDB
    import thinking_tree.tools  # noqa: F401 — triggers registration
    from thinking_tree.registry import registry

    factory = get_session_factory()
    plugins = registry.list_plugins()
    async with factory() as session:
        for p in plugins:
            name = p["tool_name"]
            result = await session.execute(
                select(RegisteredToolDB).where(
                    RegisteredToolDB.name == name,
                    RegisteredToolDB.is_builtin == True,
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

        # Host primitives dispatched by name — NOT registry plugins, so they must be
        # seeded as plain builtin rows (a registry handler would hijack _ToolWrapper.invoke
        # before the field-based path and lose run_id for attachment registration).
        static_builtins = [
            {
                "name": "execute_python",
                "description": (
                    "Execute Python code in a sandbox subprocess. ALWAYS save generated files to the CURRENT working "
                    "directory (use a relative filename like 'report.docx' or os.getcwd()), NOT absolute paths like "
                    "/mnt or /home — the tool auto-registers any generated file as a downloadable attachment and "
                    "returns its download link. Use this to create or process files (e.g. build a .docx with "
                    "python-docx, parse data, run calculations) when a skill instructs you to run code."
                ),
                "parameters": json.dumps({
                    "type": "object",
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": "The complete Python source code to execute. Save output files to the current working directory with relative paths.",
                        }
                    },
                    "required": ["code"],
                }),
            }
        ]
        static_builtins.append({
            "name": "open_user_browser",
            "description": "Open a URL in the user's local browser. Use when the user needs to see a webpage in their own browser.",
            "parameters": json.dumps({
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The full URL to open",
                    }
                },
                "required": ["url"],
            }),
        })

        for b in static_builtins:
            result = await session.execute(
                select(RegisteredToolDB).where(
                    RegisteredToolDB.name == b["name"],
                    RegisteredToolDB.is_builtin == True,
                )
            )
            if result.scalar_one_or_none():
                continue
            session.add(RegisteredToolDB(
                name=b["name"],
                category="builtin",
                description=b["description"],
                status="active",
                version="v1.0.0",
                parameters=b["parameters"],
                is_builtin=True,
            ))
        await session.commit()
