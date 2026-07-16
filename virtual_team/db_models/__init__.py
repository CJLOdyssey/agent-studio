"""ORM model definitions split by domain.

Import from `virtual_team.db_models` for ORM model classes.
Backward-compatible: `from virtual_team.database import X` also works.
"""

from virtual_team.base import Base

# Import from domain files

from virtual_team.db_models.agent import TeamDB, TeamAgentDB, AgentConfigDB
from virtual_team.db_models.auth import UserDB, RefreshTokenDB, RoleDB, UserRoleDB
from virtual_team.db_models.content import PromptDB, RegisteredToolDB, MCPServerDB, RegisteredSkillDB, VersionDB
from virtual_team.db_models.key import UserApiKey, KeyUsageLog
from virtual_team.db_models.misc import CommandLogDB, AuditLogDB, AttachmentDB
from virtual_team.db_models.session import SessionDB, ProjectRun, MemoryEntry, ChatMessage
from virtual_team.db_models.workflow import WorkflowConfigDB, WorkflowNodeDB, WorkflowEdgeDB


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
