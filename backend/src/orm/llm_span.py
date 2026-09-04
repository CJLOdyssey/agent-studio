"""LLM span ORM 模型。

一个 span 是 run 内的一次 LLM/模型调用（trace 根 = ``project_runs.id``）。
它携带渲染 Langfuse 风格 trace 详情所需的指标：模型、token/成本、耗时、状态、
父子嵌套，以及截断的输入/输出载荷，使每次调用都能在不存储完整会话的前提下被查看。

存储完整 prompt/completion 有数据合规成本，因此默认仅持久化有界摘要
（``LLM_SPAN_PAYLOAD_CHARS``）。如需要，后续可通过显式 opt-in 标志扩展为完整载荷。
"""


from datetime import UTC, datetime
from uuid import uuid4

from db.base import Base
from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column


class LLMSpanDB(Base):
    __tablename__ = "llm_spans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    # Trace 根 = project_runs.id；所有同 run 的 span 聚成一个 trace
    run_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    # Span 树：父 span 为同 run 内先完成的调用；空 = 根级调用
    parent_span_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    # 归属与计费维度（与 token_usage 同构）
    team_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    user_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    key_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    # 语义标记：agent / node / tool，便于前端归类
    span_type: Mapped[str] = mapped_column(String(16), default="llm", nullable=False)
    # 触发节点（single-agent=agent_id / "chat"，team=node.role_identifier）
    node_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    # 计费与性能指标
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="success", nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 载荷（截断摘要；完整对话不落库）
    input_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        index=True,
    )
