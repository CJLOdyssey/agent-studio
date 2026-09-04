"""应用全局共享的 Pydantic 数据模型。"""

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class Role(StrEnum):
    """团队对话中的 agent 角色。"""

    PM = "pm"
    PROGRAMMER = "programmer"
    TESTER = "tester"

    @property
    def display_name(self) -> str:
        """角色的中文显示名。"""
        mapping = {
            Role.PM: "产品经理",
            Role.PROGRAMMER: "资深程序员",
            Role.TESTER: "测试工程师",
        }
        return mapping[self]


class AgentConfig(BaseModel):
    """Agent 配置 —— 名称、模型、温度、提示词。"""

    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = Field(..., min_length=1, max_length=64)
    role_identifier: str = Field(..., min_length=1, max_length=32, pattern=r"^[a-z_]+$")
    system_prompt: str = Field(..., min_length=1)
    model: str | None = Field(default=None)
    temperature: float | None = Field(default=None, ge=0.0, le=1.0)
    order: int = Field(default=0, ge=0)
    is_active: bool = Field(default=True)
    is_approver: bool = Field(default=False)
    icon: str = Field(default="🤖", max_length=8)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Message(BaseModel):
    """一条聊天消息，含角色、内容与可选的思考过程。"""

    role: str  # 现为字符串（role_identifier），不再是枚举
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    round_number: int = Field(default=1, ge=1)

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        """校验内容非空。"""
        stripped = v.strip()
        if not stripped:
            raise ValueError("content must not be empty")
        return stripped


class ConversationStatus(StrEnum):
    """团队对话的可能状态。"""

    IN_PROGRESS = "in_progress"
    CONVERGED = "converged"
    MAX_ROUNDS_REACHED = "max_rounds_reached"
    ERROR = "error"


class ConversationRound(BaseModel):
    """团队对话中的单个轮次及其消息。"""

    round_number: int = Field(ge=1)
    messages: list[Message] = Field(min_length=1)


class MemoryEntryItem(BaseModel):
    """为会话上下文检索而存储的记忆条目。"""

    id: str
    agent_role: str
    content_type: str = Field(..., pattern=r"^(pm_document|code|review|decision)$")
    summary: str
    details: str
    created_at: datetime


class SessionItem(BaseModel):
    """会话的摘要视图（列表视图）。"""

    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class SessionDetail(SessionItem):
    """包含 runs 的会话详情视图。"""

    runs: list[Any] = Field(default_factory=list)


class AttachmentResponse(BaseModel):
    """API 返回的附件元数据。"""

    id: str
    session_id: str | None = None
    run_id: str | None = None
    filename: str
    content_type: str = "application/octet-stream"
    size_bytes: int = 0
    has_extracted_text: bool = False
    created_at: datetime | None = None


class CommandResponse(BaseModel):
    """返回给前端的已注册命令定义。"""

    id: str
    name: str
    description: str
    shortcut: str | None = None
    category: str = "general"
    requires_input: bool = False
    enabled: bool = True


class CommandExecuteRequest(BaseModel):
    """执行已注册命令的请求。"""

    command_id: str
    session_id: str
    payload: dict[str, Any] = Field(default_factory=dict)


class CommandExecuteResponse(BaseModel):
    """执行命令的响应。"""

    success: bool
    message: str = ""
    data: dict[str, Any] = Field(default_factory=dict)


class TeamOutput(BaseModel):
    """团队 agent 运行的输出 —— 文档、代码、评审与状态。"""

    requirement: str = Field(min_length=1)
    pm_document: str
    code: str
    review: str
    approved: bool = False
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    conversation_rounds: list[ConversationRound] = Field(default_factory=list)


class SessionSummary(BaseModel):
    """用于列表视图的轻量会话摘要。"""

    id: str
    title: str
    kind: str = "normal"
    agent_id: str | None = None
    team_id: str | None = None
    is_pinned: bool = False
    run_count: int = 0
    created_at: str | None = None
    updated_at: str | None = None


class RunSummary(BaseModel):
    """用于会话详情视图的轻量 run 摘要。"""

    id: str
    session_id: str | None = None
    parent_run_id: str | None = None
    requirement: str
    pm_document: str = ""
    code: str = ""
    review: str = ""
    approved: bool = False
    status: str = "pending"
    cost_usd: float = 0.0
    created_at: str | None = None
    updated_at: str | None = None
    messages: list["MessageItem"] = Field(default_factory=list)
    attachments: list["AttachmentResponse"] = Field(default_factory=list)


class MessageItem(BaseModel):
    """API 返回的聊天消息条目。"""

    id: str
    role: str
    agent_name: str
    content: str
    thinking: str | None = None
    round_number: int = 1
    created_at: str | None = None
    versions: list[str] | None = None
    thinking_versions: list[str] | None = None
    user_versions: list[str] | None = None


class RunDetail(RunSummary):
    """包含消息的 run 详情视图。"""

    messages: list[MessageItem] = Field(default_factory=list)


class MemoryItem(BaseModel):
    """API 返回的记忆条目。"""

    id: str
    agent_role: str
    content_type: str
    summary: str
    details: str = ""
    created_at: str | None = None


class SessionDetailResponse(BaseModel):
    """包含 runs 与 memories 的完整会话详情响应。"""

    id: str
    title: str
    kind: str = "normal"
    agent_id: str | None = None
    team_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    runs: list[RunSummary] = Field(default_factory=list)
    memories: list[MemoryItem] = Field(default_factory=list)
