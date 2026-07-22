"""ORM model definitions split by domain.

Import from `backend.orm` for ORM model classes.
Backward-compatible: `from backend.core.infra.database import X` also works.
"""

from backend.core.base import Base

# Import from domain files
from backend.orm.agent import AgentConfigDB, TeamAgentDB, TeamDB
from backend.orm.auth import RefreshTokenDB, RoleDB, UserDB, UserRoleDB
from backend.orm.content import MCPServerDB, PromptDB, RegisteredSkillDB, RegisteredToolDB, VersionDB
from backend.orm.key import KeyUsageLog, UserApiKey
from backend.orm.session import ChatMessage, MemoryEntry, ProjectRun, SessionDB
from backend.orm.team import AttachmentDB, AuditLogDB, CommandLogDB
from backend.orm.workflow import WorkflowConfigDB, WorkflowEdgeDB, WorkflowNodeDB

__all__ = [
    "Base",
    "AgentConfigDB",
    "AttachmentDB",
    "AuditLogDB",
    "ChatMessage",
    "CommandLogDB",
    "KeyUsageLog",
    "MCPServerDB",
    "MemoryEntry",
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
    "UserRoleDB",
    "VersionDB",
    "WorkflowConfigDB",
    "WorkflowEdgeDB",
    "WorkflowNodeDB",
]
