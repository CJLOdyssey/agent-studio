"""ORM model definitions split by domain.

Import from `backend.orm` for ORM model classes.
Backward-compatible: `from core.infra.database import X` also works.
"""

from core.base import Base

# Import from domain files
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
from orm.preference import UserPreferenceDB
from orm.session import ChatMessage, MemoryEntry, ProjectRun, SessionDB
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
