"""审计日志记录 - Audit Log Recording

实现可审计的操作日志，包括：
- 操作记录
- 变更追踪
- 审计查询
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


class AuditLogger:
    """审计日志记录器"""

    def __init__(self, max_entries: int = 10000):
        self.logs: list[AuditLogEntry] = []
        self.max_entries = max_entries
        self._log_counter = 0

    def log(
        self,
        action: AuditAction,
        user_id: str,
        resource_type: str = "",
        resource_id: str = "",
        resource_name: str = "",
        description: str = "",
        details: dict[str, Any] | None = None,
        before_snapshot: dict[str, Any] | None = None,
        after_snapshot: dict[str, Any] | None = None,
        severity: AuditSeverity = AuditSeverity.INFO,
        success: bool = True,
        error_message: str = "",
        user_name: str = "",
        ip_address: str = "",
        user_agent: str = "",
        session_id: str = "",
    ) -> AuditLogEntry:
        """记录审计日志"""
        self._log_counter += 1
        log_id = f"audit_{self._log_counter}_{int(datetime.now().timestamp())}"

        entry = AuditLogEntry(
            log_id=log_id,
            action=action,
            user_id=user_id,
            user_name=user_name,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            description=description,
            details=details or {},
            before_snapshot=before_snapshot,
            after_snapshot=after_snapshot,
            severity=severity,
            success=success,
            error_message=error_message,
            ip_address=ip_address,
            user_agent=user_agent,
            session_id=session_id,
        )

        self.logs.append(entry)

        # 限制日志数量
        if len(self.logs) > self.max_entries:
            self.logs = self.logs[-self.max_entries:]

        return entry

    def log_workflow_create(
        self,
        user_id: str,
        workflow_id: str,
        workflow_name: str,
        workflow_data: dict[str, Any],
        **kwargs: Any,
    ) -> AuditLogEntry:
        """记录工作流创建"""
        return self.log(
            action=AuditAction.WORKFLOW_CREATE,
            user_id=user_id,
            resource_type="workflow",
            resource_id=workflow_id,
            resource_name=workflow_name,
            description=f"创建工作流: {workflow_name}",
            after_snapshot=workflow_data,
            **kwargs,
        )

    def log_workflow_update(
        self,
        user_id: str,
        workflow_id: str,
        workflow_name: str,
        before_data: dict[str, Any],
        after_data: dict[str, Any],
        **kwargs: Any,
    ) -> AuditLogEntry:
        """记录工作流更新"""
        return self.log(
            action=AuditAction.WORKFLOW_UPDATE,
            user_id=user_id,
            resource_type="workflow",
            resource_id=workflow_id,
            resource_name=workflow_name,
            description=f"更新工作流: {workflow_name}",
            before_snapshot=before_data,
            after_snapshot=after_data,
            **kwargs,
        )

    def log_workflow_delete(
        self,
        user_id: str,
        workflow_id: str,
        workflow_name: str,
        workflow_data: dict[str, Any],
        **kwargs: Any,
    ) -> AuditLogEntry:
        """记录工作流删除"""
        return self.log(
            action=AuditAction.WORKFLOW_DELETE,
            user_id=user_id,
            resource_type="workflow",
            resource_id=workflow_id,
            resource_name=workflow_name,
            description=f"删除工作流: {workflow_name}",
            before_snapshot=workflow_data,
            severity=AuditSeverity.WARNING,
            **kwargs,
        )

    def log_agent_create(
        self,
        user_id: str,
        agent_id: str,
        agent_name: str,
        agent_data: dict[str, Any],
        **kwargs: Any,
    ) -> AuditLogEntry:
        """记录智能体创建"""
        return self.log(
            action=AuditAction.AGENT_CREATE,
            user_id=user_id,
            resource_type="agent",
            resource_id=agent_id,
            resource_name=agent_name,
            description=f"创建智能体: {agent_name}",
            after_snapshot=agent_data,
            **kwargs,
        )

    def log_role_assign(
        self,
        user_id: str,
        target_user_id: str,
        role_id: str,
        role_name: str,
        **kwargs: Any,
    ) -> AuditLogEntry:
        """记录角色分配"""
        return self.log(
            action=AuditAction.ROLE_ASSIGN,
            user_id=user_id,
            resource_type="user",
            resource_id=target_user_id,
            resource_name=role_name,
            description=f"分配角色 {role_name} 给用户 {target_user_id}",
            details={"role_id": role_id, "target_user_id": target_user_id},
            severity=AuditSeverity.INFO,
            **kwargs,
        )

    def get_logs(
        self,
        user_id: str | None = None,
        action: AuditAction | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        limit: int = 100,
    ) -> list[AuditLogEntry]:
        """查询审计日志"""
        filtered = self.logs

        if user_id:
            filtered = [log for log in filtered if log.user_id == user_id]

        if action:
            filtered = [log for log in filtered if log.action == action]

        if resource_type:
            filtered = [log for log in filtered if log.resource_type == resource_type]

        if resource_id:
            filtered = [log for log in filtered if log.resource_id == resource_id]

        if start_time:
            filtered = [log for log in filtered if log.timestamp >= start_time]

        if end_time:
            filtered = [log for log in filtered if log.timestamp <= end_time]

        # 按时间倒序
        filtered = sorted(filtered, key=lambda x: x.timestamp, reverse=True)

        return filtered[:limit]

    def get_resource_history(
        self,
        resource_type: str,
        resource_id: str,
    ) -> list[AuditLogEntry]:
        """获取资源变更历史"""
        return self.get_logs(
            resource_type=resource_type,
            resource_id=resource_id,
            limit=1000,
        )

    def get_user_activity(
        self,
        user_id: str,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> list[AuditLogEntry]:
        """获取用户活动记录"""
        return self.get_logs(
            user_id=user_id,
            start_time=start_time,
            end_time=end_time,
            limit=1000,
        )

    def get_statistics(self) -> dict[str, Any]:
        """获取审计统计"""
        total_logs = len(self.logs)

        # 按操作类型统计
        action_counts: dict[str, int] = {}
        for log in self.logs:
            action_name = log.action.value
            action_counts[action_name] = action_counts.get(action_name, 0) + 1

        # 按严重级别统计
        severity_counts: dict[str, int] = {}
        for log in self.logs:
            severity_name = log.severity.value
            severity_counts[severity_name] = severity_counts.get(severity_name, 0) + 1

        # 按用户统计
        user_activity: dict[str, int] = {}
        for log in self.logs:
            user_activity[log.user_id] = user_activity.get(log.user_id, 0) + 1

        # 最近活动时间
        latest_activity = None
        if self.logs:
            latest = max(self.logs, key=lambda x: x.timestamp)
            latest_activity = latest.timestamp.isoformat()

        return {
            "total_logs": total_logs,
            "action_distribution": action_counts,
            "severity_distribution": severity_counts,
            "user_activity": user_activity,
            "latest_activity": latest_activity,
        }

    def export_logs(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> str:
        """导出审计日志为JSON"""
        logs = self.get_logs(
            start_time=start_time,
            end_time=end_time,
            limit=100000,
        )

        export_data = {
            "export_time": datetime.now().isoformat(),
            "total_count": len(logs),
            "logs": [log.to_dict() for log in logs],
        }

        return json.dumps(export_data, ensure_ascii=False, indent=2)
