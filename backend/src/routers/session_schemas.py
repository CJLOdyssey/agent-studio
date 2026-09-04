"""会话相关 Pydantic 请求模型。"""

from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    title: str = "新对话"
    agent_id: str | None = None
    team_id: str | None = None


class SessionUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=256)


class SessionPinRequest(BaseModel):
    is_pinned: bool = True


class AnswerVersionsRequest(BaseModel):
    versions: list[str]
    thinking_versions: list[str] | None = None
