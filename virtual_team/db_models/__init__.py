"""ORM model definitions split by domain.

Import from `virtual_team.db_models` for ORM model classes.
Backward-compatible: `from virtual_team.core.database import X` also works.
"""

from virtual_team.core.base import Base

# Import from domain files
from virtual_team.db_models.agent import AgentConfigDB, TeamAgentDB, TeamDB
from virtual_team.db_models.auth import RefreshTokenDB, RoleDB, UserDB, UserRoleDB
from virtual_team.db_models.content import MCPServerDB, PromptDB, RegisteredSkillDB, RegisteredToolDB, VersionDB
from virtual_team.db_models.key import KeyUsageLog, UserApiKey
from virtual_team.db_models.misc import AttachmentDB, AuditLogDB, CommandLogDB
from virtual_team.db_models.session import ChatMessage, MemoryEntry, ProjectRun, SessionDB
from virtual_team.db_models.workflow import WorkflowConfigDB, WorkflowEdgeDB, WorkflowNodeDB

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
