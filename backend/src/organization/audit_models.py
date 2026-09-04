"""审计日志数据模型 - Audit Log Data Models

定义审计日志相关的枚举与数据类，包括：
- 审计操作类型
- 审计严重级别
- 审计日志条目
"""

import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class AuditAction(Enum):
    """审计操作类型"""
    # 工作流操作
    WORKFLOW_CREATE = "workflow_create"
    WORKFLOW_UPDATE = "workflow_update"
    WORKFLOW_DELETE = "workflow_delete"
    WORKFLOW_EXECUTE = "workflow_execute"

    # 智能体操作
    AGENT_CREATE = "agent_create"
    AGENT_UPDATE = "agent_update"
    AGENT_DELETE = "agent_delete"

    # 组织操作
    ORG_NODE_CREATE = "org_node_create"
    ORG_NODE_UPDATE = "org_node_update"
    ORG_NODE_DELETE = "org_node_delete"
    ORG_MEMBER_ADD = "org_member_add"
    ORG_MEMBER_REMOVE = "org_member_remove"

    # 权限操作
    ROLE_CREATE = "role_create"
    ROLE_UPDATE = "role_update"
    ROLE_DELETE = "role_delete"
    ROLE_ASSIGN = "role_assign"
    ROLE_REVOKE = "role_revoke"

    # 系统操作
    SYSTEM_CONFIG_UPDATE = "system_config_update"
    SYSTEM_BACKUP = "system_backup"
    SYSTEM_RESTORE = "system_restore"


class AuditSeverity(Enum):
    """审计严重级别"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class AuditLogEntry:
    """审计日志条目"""
    log_id: str
    action: AuditAction
    user_id: str
    timestamp: datetime = field(default_factory=datetime.now)
    user_name: str = ""

    # 资源信息
    resource_type: str = ""  # workflow, agent, org_node, role
    resource_id: str = ""
    resource_name: str = ""

    # 操作详情
    description: str = ""
    details: dict[str, Any] = field(default_factory=dict)

    # 变更前后快照
    before_snapshot: dict[str, Any] | None = None
    after_snapshot: dict[str, Any] | None = None

    # 严重级别
    severity: AuditSeverity = AuditSeverity.INFO

    # 结果
    success: bool = True
    error_message: str = ""

    # 上下文
    ip_address: str = ""
    user_agent: str = ""
    session_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "log_id": self.log_id,
            "timestamp": self.timestamp.isoformat(),
            "action": self.action.value,
            "user": {
                "id": self.user_id,
                "name": self.user_name,
            },
            "resource": {
                "type": self.resource_type,
                "id": self.resource_id,
                "name": self.resource_name,
            },
            "description": self.description,
            "details": self.details,
            "snapshots": {
                "before": self.before_snapshot,
                "after": self.after_snapshot,
            },
            "severity": self.severity.value,
            "result": {
                "success": self.success,
                "error": self.error_message,
            },
            "context": {
                "ip_address": self.ip_address,
                "user_agent": self.user_agent,
                "session_id": self.session_id,
            },
        }

    def to_json(self) -> str:
        """转换为JSON字符串"""
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)
