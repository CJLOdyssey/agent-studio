"""RoleManager 单元测试"""

from datetime import datetime, timedelta

import pytest

from organization.role_manager import (
    Permission,
    Role,
    RoleManager,
    UserRole,
)


@pytest.fixture
def rm() -> RoleManager:
    return RoleManager()


class TestInitSystemRoles:
    def test_has_four_system_roles(self, rm: RoleManager) -> None:
        assert len(rm.roles) == 4

    def test_super_admin_permissions(self, rm: RoleManager) -> None:
        sa = rm.roles["super_admin"]
        assert sa.is_system_role is True
        assert Permission.SYSTEM_ADMIN in sa.permissions

    def test_user_role_permissions(self, rm: RoleManager) -> None:
        u = rm.roles["user"]
        assert Permission.WORKFLOW_READ in u.permissions
        assert Permission.SYSTEM_ADMIN not in u.permissions


class TestCreateRole:
    def test_success(self, rm: RoleManager) -> None:
        role = rm.create_role("custom", "Custom", permissions={Permission.DATA_READ})
        assert role.role_id == "custom"
        assert Permission.DATA_READ in role.permissions

    def test_duplicate_raises(self, rm: RoleManager) -> None:
        with pytest.raises(ValueError, match="already exists"):
            rm.create_role("super_admin", "X")


class TestGetRole:
    def test_found(self, rm: RoleManager) -> None:
        assert rm.get_role("super_admin") is not None

    def test_not_found(self, rm: RoleManager) -> None:
        assert rm.get_role("nope") is None


class TestUpdateRole:
    def test_success(self, rm: RoleManager) -> None:
        rm.create_role("c", "C")
        updated = rm.update_role("c", name="New")
        assert updated.name == "New"

    def test_not_found_raises(self, rm: RoleManager) -> None:
        with pytest.raises(ValueError, match="not found"):
            rm.update_role("nope")

    def test_system_role_raises(self, rm: RoleManager) -> None:
        with pytest.raises(ValueError, match="Cannot modify system role"):
            rm.update_role("super_admin", name="X")

    def test_update_permissions(self, rm: RoleManager) -> None:
        rm.create_role("c", "C")
        rm.update_role("c", permissions={Permission.DATA_WRITE})
        assert Permission.DATA_WRITE in rm.roles["c"].permissions


class TestDeleteRole:
    def test_success(self, rm: RoleManager) -> None:
        rm.create_role("c", "C")
        rm.delete_role("c")
        assert rm.get_role("c") is None

    def test_not_found_raises(self, rm: RoleManager) -> None:
        with pytest.raises(ValueError, match="not found"):
            rm.delete_role("nope")

    def test_system_role_raises(self, rm: RoleManager) -> None:
        with pytest.raises(ValueError, match="Cannot delete system role"):
            rm.delete_role("super_admin")

    def test_with_assigned_users_raises(self, rm: RoleManager) -> None:
        rm.create_role("c", "C")
        rm.assign_role("u1", "c")
        with pytest.raises(ValueError, match="Cannot delete role with assigned users"):
            rm.delete_role("c")


class TestAssignRole:
    def test_success(self, rm: RoleManager) -> None:
        ur = rm.assign_role("u1", "super_admin")
        assert ur.user_id == "u1"
        assert ur.role_id == "super_admin"

    def test_not_found_role_raises(self, rm: RoleManager) -> None:
        with pytest.raises(ValueError, match="not found"):
            rm.assign_role("u1", "nope")

    def test_already_assigned_raises(self, rm: RoleManager) -> None:
        rm.assign_role("u1", "user")
        with pytest.raises(ValueError, match="already has role"):
            rm.assign_role("u1", "user")

    def test_with_expires_at(self, rm: RoleManager) -> None:
        exp = datetime.now() + timedelta(hours=1)
        ur = rm.assign_role("u1", "user", expires_at=exp)
        assert ur.expires_at == exp

    def test_with_assigned_by(self, rm: RoleManager) -> None:
        ur = rm.assign_role("u1", "user", assigned_by="admin")
        assert ur.assigned_by == "admin"


class TestRevokeRole:
    def test_success(self, rm: RoleManager) -> None:
        rm.assign_role("u1", "user")
        rm.revoke_role("u1", "user")
        assert rm.get_user_roles("u1") == []

    def test_no_roles_raises(self, rm: RoleManager) -> None:
        with pytest.raises(ValueError, match="has no roles"):
            rm.revoke_role("u1", "user")

    def test_role_not_assigned_raises(self, rm: RoleManager) -> None:
        rm.assign_role("u1", "user")
        with pytest.raises(ValueError, match="does not have role"):
            rm.revoke_role("u1", "super_admin")


class TestGetUserRoles:
    def test_normal(self, rm: RoleManager) -> None:
        rm.assign_role("u1", "user")
        roles = rm.get_user_roles("u1")
        assert len(roles) == 1
        assert roles[0].role_id == "user"

    def test_expired_role_filtered(self, rm: RoleManager) -> None:
        exp = datetime.now() - timedelta(hours=1)
        rm.assign_role("u1", "user", expires_at=exp)
        assert rm.get_user_roles("u1") == []

    def test_unknown_user(self, rm: RoleManager) -> None:
        assert rm.get_user_roles("nope") == []


class TestGetUserPermissions:
    def test_union_of_roles(self, rm: RoleManager) -> None:
        rm.assign_role("u1", "user")
        rm.assign_role("u1", "workflow_operator")
        perms = rm.get_user_permissions("u1")
        assert Permission.WORKFLOW_READ in perms
        assert Permission.WORKFLOW_EXECUTE in perms


class TestHasPermission:
    def test_true(self, rm: RoleManager) -> None:
        rm.assign_role("u1", "user")
        assert rm.has_permission("u1", Permission.WORKFLOW_READ) is True

    def test_false(self, rm: RoleManager) -> None:
        rm.assign_role("u1", "user")
        assert rm.has_permission("u1", Permission.SYSTEM_ADMIN) is False


class TestHasAnyPermission:
    def test_true(self, rm: RoleManager) -> None:
        rm.assign_role("u1", "user")
        assert rm.has_any_permission("u1", [Permission.SYSTEM_ADMIN, Permission.WORKFLOW_READ]) is True

    def test_false(self, rm: RoleManager) -> None:
        rm.assign_role("u1", "user")
        assert rm.has_any_permission("u1", [Permission.SYSTEM_ADMIN, Permission.DATA_DELETE]) is False


class TestHasAllPermissions:
    def test_true(self, rm: RoleManager) -> None:
        rm.assign_role("u1", "super_admin")
        assert rm.has_all_permissions("u1", [Permission.SYSTEM_ADMIN, Permission.DATA_WRITE]) is True

    def test_false(self, rm: RoleManager) -> None:
        rm.assign_role("u1", "user")
        assert rm.has_all_permissions("u1", [Permission.WORKFLOW_READ, Permission.SYSTEM_ADMIN]) is False


class TestGetRoleStatistics:
    def test_counts(self, rm: RoleManager) -> None:
        rm.create_role("c", "C")
        rm.assign_role("u1", "user")
        rm.assign_role("u2", "user")
        stats = rm.get_role_statistics()
        assert stats["total_roles"] == 5
        assert stats["system_roles"] == 4
        assert stats["custom_roles"] == 1
        assert stats["role_user_distribution"]["user"] == 2


class TestRoleToDict:
    def test_to_dict(self) -> None:
        role = Role(role_id="r", name="R", permissions={Permission.DATA_READ})
        d = role.to_dict()
        assert d["role_id"] == "r"
        assert "data:read" in d["permissions"]


class TestUserRoleToDict:
    def test_to_dict_no_expires(self) -> None:
        ur = UserRole(user_id="u", role_id="r")
        d = ur.to_dict()
        assert d["expires_at"] is None

    def test_to_dict_with_expires(self) -> None:
        exp = datetime(2030, 1, 1)
        ur = UserRole(user_id="u", role_id="r", expires_at=exp)
        d = ur.to_dict()
        assert d["expires_at"] is not None
