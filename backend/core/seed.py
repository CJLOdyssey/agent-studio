"""Default data seeding — roles, admin user, and built-in tools bootstrap."""

from sqlalchemy import select

from backend.core.infra.database import get_session_factory
from backend.orm import RegisteredToolDB, RoleDB, UserDB, UserRoleDB


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


async def seed_default_tools() -> None:
    """Create built-in tools (web_search, calculator, fetch_page) if none exist."""
    from backend.core.infra.logging_config import get_logger

    logger = get_logger(__name__)
    factory = get_session_factory()
    async with factory() as session:
        existing = await session.execute(select(RegisteredToolDB).limit(1))
        if existing.scalar_one_or_none():
            return

        seed_data = [
            {
                "name": "web_search",
                "category": "builtin",
                "description": "Search the web for current information.",
                "endpoint": "builtin://web_search",
            },
            {
                "name": "calculator",
                "category": "builtin",
                "description": "Evaluate math expressions: +, -, *, /, **, %, sqrt, sin, cos.",
                "endpoint": "builtin://calculator",
            },
            {
                "name": "fetch_page",
                "category": "builtin",
                "description": "Fetch and read the content of a web page.",
                "endpoint": "builtin://fetch_page",
            },
        ]
        for data in seed_data:
            session.add(RegisteredToolDB(**data))
        await session.commit()
        logger.info("[LIFECYCLE] seeded %d default tools", len(seed_data))
