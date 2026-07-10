import os
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.pool import NullPool

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/virtual_team",
)


class Base(DeclarativeBase):
    pass


class SessionDB(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    title: Mapped[str] = mapped_column(String(256), default="新对话")
    user_id: Mapped[str] = mapped_column(String(128), default="default")
    agent_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("agent_configs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    runs: Mapped[list["ProjectRun"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ProjectRun.created_at",
    )
    memories: Mapped[list["MemoryEntry"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="MemoryEntry.created_at",
    )


class ProjectRun(Base):
    __tablename__ = "project_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    requirement: Mapped[str] = mapped_column(Text, nullable=False)
    pm_document: Mapped[str] = mapped_column(Text, default="", server_default="")
    code: Mapped[str] = mapped_column(Text, default="", server_default="")
    review: Mapped[str] = mapped_column(Text, default="", server_default="")
    approved: Mapped[bool] = mapped_column(Boolean, default=False, server_default="f")
    status: Mapped[str] = mapped_column(
        String(32),
        default="pending",
        server_default="pending",
        comment="pending|running|converged|max_rounds_reached|error",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    session: Mapped["SessionDB | None"] = relationship(back_populates="runs")
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )


class MemoryEntry(Base):
    __tablename__ = "memory_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    run_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("project_runs.id", ondelete="SET NULL"),
        nullable=True,
    )
    agent_role: Mapped[str] = mapped_column(String(32), nullable=False)
    content_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        comment="pm_document|code|review|decision",
    )
    summary: Mapped[str] = mapped_column(String(512), nullable=False)
    details: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )

    session: Mapped["SessionDB"] = relationship(back_populates="memories")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("project_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        comment="pm|programmer|tester",
    )
    agent_name: Mapped[str] = mapped_column(String(64), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    thinking: Mapped[str | None] = mapped_column(Text, nullable=True)
    round_number: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )

    run: Mapped["ProjectRun"] = relationship(back_populates="messages")


class TeamDB(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    status: Mapped[str] = mapped_column(String(16), default="active")
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_expanded: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_id: Mapped[str | None] = mapped_column(String(36), nullable=True, default=None)
    workflow_config_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("workflow_configs.id", ondelete="SET NULL"), nullable=True, default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    members: Mapped[list["TeamAgentDB"]] = relationship(
        back_populates="team",
        cascade="all, delete-orphan",
        order_by="TeamAgentDB.order",
    )
    workflow_config: Mapped["WorkflowConfigDB | None"] = relationship(
        foreign_keys=[workflow_config_id],
    )


class WorkflowConfigDB(Base):
    __tablename__ = "workflow_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    team_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    max_rounds: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    nodes: Mapped[list["WorkflowNodeDB"]] = relationship(
        back_populates="workflow_config",
        cascade="all, delete-orphan",
        order_by="WorkflowNodeDB.order",
    )
    edges: Mapped[list["WorkflowEdgeDB"]] = relationship(
        back_populates="workflow_config",
        cascade="all, delete-orphan",
    )


class WorkflowNodeDB(Base):
    __tablename__ = "workflow_nodes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    workflow_config_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflow_configs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    agent_config_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agent_configs.id", ondelete="RESTRICT"), nullable=False
    )
    role_identifier: Mapped[str] = mapped_column(String(32), nullable=False)
    strategy: Mapped[str] = mapped_column(String(16), default="generator", nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    workflow_config: Mapped["WorkflowConfigDB"] = relationship(back_populates="nodes")
    agent_config: Mapped["AgentConfigDB"] = relationship()
    outgoing_edges: Mapped[list["WorkflowEdgeDB"]] = relationship(
        back_populates="from_node",
        foreign_keys="WorkflowEdgeDB.from_node_id",
        cascade="all, delete-orphan",
    )
    incoming_edges: Mapped[list["WorkflowEdgeDB"]] = relationship(
        back_populates="to_node",
        foreign_keys="WorkflowEdgeDB.to_node_id",
        cascade="all, delete-orphan",
    )


class WorkflowEdgeDB(Base):
    __tablename__ = "workflow_edges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    workflow_config_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflow_configs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_node_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False
    )
    to_node_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False
    )
    condition_key: Mapped[str | None] = mapped_column(String(128), nullable=True, default=None)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    workflow_config: Mapped["WorkflowConfigDB"] = relationship(back_populates="edges")
    from_node: Mapped["WorkflowNodeDB"] = relationship(
        back_populates="outgoing_edges", foreign_keys=[from_node_id]
    )
    to_node: Mapped["WorkflowNodeDB"] = relationship(
        back_populates="incoming_edges", foreign_keys=[to_node_id]
    )


class TeamAgentDB(Base):
    __tablename__ = "team_agents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    team_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    agent_config_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("agent_configs.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    role: Mapped[str] = mapped_column(String(64), default="待配置角色")
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )

    team: Mapped["TeamDB"] = relationship(back_populates="members")
    agent_config: Mapped["AgentConfigDB | None"] = relationship()


class AgentConfigDB(Base):
    __tablename__ = "agent_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    role_identifier: Mapped[str] = mapped_column(
        String(32), unique=True, nullable=False, index=True
    )
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    output_constraints: Mapped[str | None] = mapped_column(Text, nullable=True)
    tools: Mapped[str | None] = mapped_column(Text, nullable=True)
    mcp: Mapped[str | None] = mapped_column(Text, nullable=True)
    skills: Mapped[str | None] = mapped_column(Text, nullable=True)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_approver: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    icon: Mapped[str] = mapped_column(String(8), default="🤖", nullable=False)
    owner_id: Mapped[str | None] = mapped_column(String(36), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


_async_engine: AsyncEngine | None = None
_async_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_async_engine() -> AsyncEngine:
    global _async_engine
    if _async_engine is None:
        _async_engine = create_async_engine(
            DATABASE_URL,
            echo=False,
            poolclass=NullPool,
        )
    return _async_engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _async_session_factory
    if _async_session_factory is None:
        _async_session_factory = async_sessionmaker(get_async_engine(), expire_on_commit=False)
    return _async_session_factory


class CommandLogDB(Base):
    __tablename__ = "command_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    command_id: Mapped[str] = mapped_column(String(64), nullable=False)
    command_name: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[str] = mapped_column(Text, default="")
    result: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )


class AuditLogDB(Base):
    """Admin audit log — records management CRUD operations (no session FK)."""
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_name: Mapped[str] = mapped_column(String(255), default="")
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        index=True,
    )


class AttachmentDB(Base):
    __tablename__ = "attachments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    filename: Mapped[str] = mapped_column(String(256), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), default="application/octet-stream")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )


class UserApiKey(Base):
    """Enterprise API key vault — encrypted at rest, never returned to client."""

    __tablename__ = "user_api_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(
        String(32), nullable=False, comment="openai|deepseek|anthropic|custom"
    )
    usage_type: Mapped[str] = mapped_column(
        String(16),
        default="llm",
        nullable=False,
        comment="llm|embedding|both — how this key is used",
    )
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    encrypted_key: Mapped[str] = mapped_column(Text, nullable=False)
    base_url: Mapped[str | None] = mapped_column(String(256), nullable=True)
    models: Mapped[str] = mapped_column(Text, default="", comment="Comma-separated model IDs")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )


class KeyUsageLog(Base):
    """Audit log: records every LLM call with token consumption."""

    __tablename__ = "key_usage_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    key_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("user_api_keys.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    tokens_prompt: Mapped[int] = mapped_column(Integer, default=0)
    tokens_completion: Mapped[int] = mapped_column(Integer, default=0)
    tokens_total: Mapped[int] = mapped_column(Integer, default=0)
    cost_estimate_usd: Mapped[float] = mapped_column(Float, default=0.0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default="success", comment="success|error")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )


class PromptDB(Base):
    __tablename__ = "prompts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")
    version: Mapped[str] = mapped_column(String(16), default="v1.0.0")
    owner_id: Mapped[str | None] = mapped_column(String(36), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )


class RegisteredToolDB(Base):
    __tablename__ = "registered_tools"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")
    version: Mapped[str] = mapped_column(String(16), default="v1.0.0")
    endpoint: Mapped[str] = mapped_column(String(256), default="")
    method: Mapped[str] = mapped_column(String(8), default="GET")
    headers: Mapped[str] = mapped_column(Text, default="{}")
    parameters: Mapped[str] = mapped_column(Text, default='{"type":"object","properties":{}}')
    owner_id: Mapped[str | None] = mapped_column(String(36), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )


class MCPServerDB(Base):
    __tablename__ = "mcp_servers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    type: Mapped[str] = mapped_column(String(32), default="stdio")
    endpoint: Mapped[str] = mapped_column(String(256), default="")
    config: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")
    owner_id: Mapped[str | None] = mapped_column(String(36), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )


class RegisteredSkillDB(Base):
    __tablename__ = "registered_skills"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[str | None] = mapped_column(String(64), nullable=True)
    version: Mapped[str] = mapped_column(String(16), default="v1.0.0")
    status: Mapped[str] = mapped_column(String(16), default="active")
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    tool_names: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    output_constraint: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )


class VersionDB(Base):
    __tablename__ = "versions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    resource_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    resource_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    version_num: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    __table_args__ = (
        Index("ix_versions_resource", "resource_type", "resource_id"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )


# ── RBAC models ──────────────────────────────────────────────────────────────


class UserDB(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )


class RoleDB(Base):
    __tablename__ = "roles"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    permissions: Mapped[dict] = mapped_column(JSON, default=dict)


class UserRoleDB(Base):
    __tablename__ = "user_roles"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True
    )


async def init_db():
    """Bootstrap database tables on first run.

    Uses create_all() which is idempotent — only creates tables that don't
    already exist. For production deployments with existing data, use Alembic
    migrations instead:

        alembic upgrade head

    See alembic/versions/ for migration history.
    """
    # Lazy-register checkpoint model to avoid circular import
    from virtual_team.checkpoint import CheckpointDB  # noqa: F401

    engine = get_async_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Enterprise: add FK + index for agent_id on existing sessions table
        await conn.execute(
            text(
                """
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'sessions_agent_id_fkey'
                ) THEN
                    UPDATE sessions SET agent_id = NULL
                    WHERE agent_id IS NOT NULL
                    AND agent_id NOT IN (
                        SELECT id FROM agent_configs
                    );
                    ALTER TABLE sessions
                    ADD CONSTRAINT sessions_agent_id_fkey
                    FOREIGN KEY (agent_id) REFERENCES agent_configs(id)
                    ON DELETE SET NULL;
                END IF;
            END $$;
        """
            )
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_sessions_agent_id ON sessions(agent_id);")
        )


async def log_audit(
    action: str,
    entity_type: str,
    entity_name: str = "",
    detail: str = "",
) -> None:
    """Write an audit log entry for a management CRUD operation."""
    from virtual_team.database import AuditLogDB, get_session_factory
    entry = AuditLogDB(
        action=action,
        entity_type=entity_type,
        entity_name=entity_name,
        detail=detail,
    )
    factory = get_session_factory()
    async with factory() as session:
        session.add(entry)
        await session.commit()


async def get_session():
    """Async generator yielding a database session (FastAPI Depends)."""
    factory = get_session_factory()
    async with factory() as session:
        yield session
