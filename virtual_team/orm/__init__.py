"""ORM model definitions split by domain.

Import from `virtual_team.orm` for ORM model classes.
Backward-compatible: `from virtual_team.core.infra.database import X` also works.
"""

from virtual_team.core.base import Base

# Import from domain files
from virtual_team.orm.agent import AgentConfigDB, TeamAgentDB, TeamDB
from virtual_team.orm.auth import RefreshTokenDB, RoleDB, UserDB, UserRoleDB
from virtual_team.orm.content import MCPServerDB, PromptDB, RegisteredSkillDB, RegisteredToolDB, VersionDB
from virtual_team.orm.key import KeyUsageLog, UserApiKey
from virtual_team.orm.team import AttachmentDB, AuditLogDB, CommandLogDB
from virtual_team.orm.session import ChatMessage, MemoryEntry, ProjectRun, SessionDB
from virtual_team.orm.workflow import WorkflowConfigDB, WorkflowEdgeDB, WorkflowNodeDB

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
