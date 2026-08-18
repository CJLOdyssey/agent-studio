"""角色权限系统 - Role-Based Access Control

实现基于角色的权限控制，包括：
- 角色定义
- 权限分配
- 权限检查
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class Permission(Enum):
    """权限类型"""
    # 工作流权限
    WORKFLOW_CREATE = "workflow:create"
    WORKFLOW_READ = "workflow:read"
    WORKFLOW_UPDATE = "workflow:update"
    WORKFLOW_DELETE = "workflow:delete"
    WORKFLOW_EXECUTE = "workflow:execute"

    # 智能体权限
    AGENT_CREATE = "agent:create"
    AGENT_READ = "agent:read"
    AGENT_UPDATE = "agent:update"
    AGENT_DELETE = "agent:delete"

    # 组织权限
    ORG_MANAGE = "org:manage"
    ORG_READ = "org:read"

    # 系统权限
    SYSTEM_ADMIN = "system:admin"
    SYSTEM_CONFIG = "system:config"

    # 数据权限
    DATA_READ = "data:read"
    DATA_WRITE = "data:write"
    DATA_DELETE = "data:delete"


@dataclass
class Role:
    """角色定义"""
    role_id: str
    name: str
    description: str = ""

    # 权限列表
    permissions: set[Permission] = field(default_factory=set)

    # 元数据
    is_system_role: bool = False  # 系统内置角色
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "role_id": self.role_id,
            "name": self.name,
            "description": self.description,
            "permissions": [p.value for p in self.permissions],
            "is_system_role": self.is_system_role,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class UserRole:
    """用户角色分配"""
    user_id: str
    role_id: str
    assigned_at: datetime = field(default_factory=datetime.now)
    assigned_by: str = ""  # 分配者
    expires_at: datetime | None = None  # 过期时间

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "user_id": self.user_id,
            "role_id": self.role_id,
            "assigned_at": self.assigned_at.isoformat(),
            "assigned_by": self.assigned_by,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }


class RoleManager:
    """角色管理器"""

    def __init__(self) -> None:
        self.roles: dict[str, Role] = {}
        self.user_roles: dict[str, list[UserRole]] = {}  # user_id -> [UserRole]

        # 初始化系统角色
        self._init_system_roles()

    def _init_system_roles(self) -> None:
        """初始化系统内置角色"""
        # 超级管理员
        super_admin = Role(
            role_id="super_admin",
            name="超级管理员",
            description="拥有所有权限",
            permissions=set(Permission),
            is_system_role=True,
        )
        self.roles["super_admin"] = super_admin

        # 工作流管理员
        workflow_admin = Role(
            role_id="workflow_admin",
            name="工作流管理员",
            description="管理工作流和智能体",
            permissions={
                Permission.WORKFLOW_CREATE,
                Permission.WORKFLOW_READ,
                Permission.WORKFLOW_UPDATE,
                Permission.WORKFLOW_DELETE,
                Permission.WORKFLOW_EXECUTE,
                Permission.AGENT_CREATE,
                Permission.AGENT_READ,
                Permission.AGENT_UPDATE,
                Permission.AGENT_DELETE,
            },
            is_system_role=True,
        )
        self.roles["workflow_admin"] = workflow_admin

        # 工作流操作员
        workflow_operator = Role(
            role_id="workflow_operator",
            name="工作流操作员",
            description="执行和查看工作流",
            permissions={
                Permission.WORKFLOW_READ,
                Permission.WORKFLOW_EXECUTE,
                Permission.AGENT_READ,
            },
            is_system_role=True,
        )
        self.roles["workflow_operator"] = workflow_operator

        # 普通用户
        user = Role(
            role_id="user",
            name="普通用户",
            description="基本访问权限",
            permissions={
                Permission.WORKFLOW_READ,
                Permission.AGENT_READ,
                Permission.DATA_READ,
            },
            is_system_role=True,
        )
        self.roles["user"] = user

    def create_role(
        self,
        role_id: str,
        name: str,
        description: str = "",
        permissions: set[Permission] | None = None,
    ) -> Role:
        """创建角色"""
        if role_id in self.roles:
            raise ValueError(f"Role {role_id} already exists")

        role = Role(
            role_id=role_id,
            name=name,
            description=description,
            permissions=permissions or set(),
        )
        self.roles[role_id] = role

        return role

    def get_role(self, role_id: str) -> Role | None:
        """获取角色"""
        return self.roles.get(role_id)

    def update_role(
        self,
        role_id: str,
        name: str | None = None,
        description: str | None = None,
        permissions: set[Permission] | None = None,
    ) -> Role:
        """更新角色"""
        if role_id not in self.roles:
            raise ValueError(f"Role {role_id} not found")

        role = self.roles[role_id]

        if role.is_system_role:
            raise ValueError(f"Cannot modify system role: {role_id}")

        if name:
            role.name = name
        if description is not None:
            role.description = description
        if permissions is not None:
            role.permissions = permissions

        role.updated_at = datetime.now()
        return role

    def delete_role(self, role_id: str) -> None:
        """删除角色"""
        if role_id not in self.roles:
            raise ValueError(f"Role {role_id} not found")

        role = self.roles[role_id]
        if role.is_system_role:
            raise ValueError(f"Cannot delete system role: {role_id}")

        # 检查是否有用户分配了该角色
        for _user_id, roles in self.user_roles.items():
            if any(ur.role_id == role_id for ur in roles):
                raise ValueError(f"Cannot delete role with assigned users: {role_id}")

        del self.roles[role_id]

    def assign_role(
        self,
        user_id: str,
        role_id: str,
        assigned_by: str = "",
        expires_at: datetime | None = None,
    ) -> UserRole:
        """分配角色给用户"""
        if role_id not in self.roles:
            raise ValueError(f"Role {role_id} not found")

        # 检查是否已分配
        if user_id in self.user_roles:
            for ur in self.user_roles[user_id]:
                if ur.role_id == role_id:
                    raise ValueError(f"User {user_id} already has role {role_id}")

        user_role = UserRole(
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by,
            expires_at=expires_at,
        )

        if user_id not in self.user_roles:
            self.user_roles[user_id] = []
        self.user_roles[user_id].append(user_role)

        return user_role

    def revoke_role(self, user_id: str, role_id: str) -> None:
        """撤销用户角色"""
        if user_id not in self.user_roles:
            raise ValueError(f"User {user_id} has no roles")

        roles = self.user_roles[user_id]
        for i, ur in enumerate(roles):
            if ur.role_id == role_id:
                roles.pop(i)
                return

        raise ValueError(f"User {user_id} does not have role {role_id}")

    def get_user_roles(self, user_id: str) -> list[Role]:
        """获取用户的所有角色"""
        if user_id not in self.user_roles:
            return []

        roles = []
        for ur in self.user_roles[user_id]:
            # 检查是否过期
            if ur.expires_at and ur.expires_at < datetime.now():
                continue

            role = self.roles.get(ur.role_id)
            if role:
                roles.append(role)

        return roles

    def get_user_permissions(self, user_id: str) -> set[Permission]:
        """获取用户的所有权限"""
        roles = self.get_user_roles(user_id)
        permissions: set[Permission] = set()

        for role in roles:
            permissions.update(role.permissions)

        return permissions

    def has_permission(self, user_id: str, permission: Permission) -> bool:
        """检查用户是否有权限"""
        permissions = self.get_user_permissions(user_id)
        return permission in permissions

    def has_any_permission(self, user_id: str, permissions: list[Permission]) -> bool:
        """检查用户是否有任一权限"""
        user_permissions = self.get_user_permissions(user_id)
        return any(p in user_permissions for p in permissions)

    def has_all_permissions(self, user_id: str, permissions: list[Permission]) -> bool:
        """检查用户是否有所有权限"""
        user_permissions = self.get_user_permissions(user_id)
        return all(p in user_permissions for p in permissions)

    def get_role_statistics(self) -> dict[str, Any]:
        """获取角色统计"""
        total_roles = len(self.roles)
        system_roles = sum(1 for r in self.roles.values() if r.is_system_role)
        custom_roles = total_roles - system_roles

        # 统计每个角色的用户数
        role_user_counts: dict[str, int] = {}
        for roles in self.user_roles.values():
            for ur in roles:
                role_user_counts[ur.role_id] = role_user_counts.get(ur.role_id, 0) + 1

        return {
            "total_roles": total_roles,
            "system_roles": system_roles,
            "custom_roles": custom_roles,
            "role_user_distribution": role_user_counts,
        }
