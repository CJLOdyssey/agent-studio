"""Default data seeding — roles and admin user bootstrap."""

from sqlalchemy import select

from virtual_team.core.infra.database import get_session_factory
from virtual_team.orm import RoleDB, UserDB, UserRoleDB


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
