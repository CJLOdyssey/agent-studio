"""按领域拆分的 ORM 模型定义。

从 `backend.orm` 导入 ORM 模型类。
向后兼容：`from core.infra.database import X` 同样可用。
"""

from db.base import Base

# 从领域文件导入
from orm.agent import AgentConfigDB, TeamAgentDB, TeamDB
from orm.alert import (
    AlertEventDB,
    AlertRuleDB,
    NotificationDB,
    NotificationSubscriptionDB,
)
from orm.auth import RefreshTokenDB, RoleDB, UserDB, UserRoleDB
from orm.content import MCPServerDB, PromptDB, RegisteredSkillDB, RegisteredToolDB, VersionDB
from orm.global_memory import GlobalMemoryDB
from orm.key import KeyUsageLog, UserApiKey
from orm.llm_span import LLMSpanDB
from orm.preference import UserPreferenceDB
from orm.session import ChatMessage, MemoryEntry, ProjectRun, SessionDB
from orm.slo import SLIDefinitionDB
from orm.team import AttachmentDB, AuditLogDB, CommandLogDB
from orm.workflow import WorkflowConfigDB, WorkflowEdgeDB, WorkflowNodeDB

__all__ = [
    "Base",
    "AgentConfigDB",
    "AlertEventDB",
    "AlertRuleDB",
    "AttachmentDB",
    "AuditLogDB",
    "ChatMessage",
    "CommandLogDB",
    "GlobalMemoryDB",
    "KeyUsageLog",
    "LLMSpanDB",
    "MCPServerDB",
    "MemoryEntry",
    "NotificationDB",
    "NotificationSubscriptionDB",
    "ProjectRun",
    "PromptDB",
    "RefreshTokenDB",
    "RegisteredSkillDB",
    "RegisteredToolDB",
    "RoleDB",
    "SessionDB",
    "SLIDefinitionDB",
    "TeamAgentDB",
    "TeamDB",
    "UserApiKey",
    "UserDB",
    "UserPreferenceDB",
    "UserRoleDB",
    "VersionDB",
    "WorkflowConfigDB",
    "WorkflowEdgeDB",
    "WorkflowNodeDB",
]
