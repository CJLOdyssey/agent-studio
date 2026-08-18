"""组织结构模块 - Organization Module

提供组织结构管理、角色权限控制、审计日志和权限验证中间件功能
"""

from organization.audit_logger import AuditAction, AuditLogEntry, AuditLogger, AuditSeverity
from organization.organization_manager import (
    OrganizationManager,
    OrganizationNode,
    OrganizationType,
)
from organization.permission_middleware import PermissionMiddleware, require_permission
from organization.role_manager import Permission, Role, RoleManager, UserRole

__all__ = [
    "AuditAction",
    "AuditLogger",
    "AuditLogEntry",
    "AuditSeverity",
    "OrganizationManager",
    "OrganizationNode",
    "OrganizationType",
    "Permission",
    "PermissionMiddleware",
    "Role",
    "RoleManager",
    "UserRole",
    "require_permission",
]
