"""Initial schema — all core tables.

Revision ID: 0001
Revises: None
Create Date: 2026-06-03
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── sessions ─────────────────────────────────────────────────────────
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(256), default="新对话"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── project_runs ─────────────────────────────────────────────────────
    op.create_table(
        "project_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "session_id", sa.String(36),
            sa.ForeignKey("sessions.id", ondelete="SET NULL"),
            nullable=True, index=True,
        ),
        sa.Column("requirement", sa.Text, nullable=False),
        sa.Column("pm_document", sa.Text, default="", server_default=""),
        sa.Column("code", sa.Text, default="", server_default=""),
        sa.Column("review", sa.Text, default="", server_default=""),
        sa.Column("approved", sa.Boolean, default=False, server_default="f"),
        sa.Column(
            "status", sa.String(32), default="pending", server_default="pending",
            comment="pending|running|converged|max_rounds_reached|error",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── chat_messages ────────────────────────────────────────────────────
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "run_id", sa.String(36),
            sa.ForeignKey("project_runs.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column(
            "role", sa.String(32), nullable=False,
            comment="pm|programmer|tester",
        ),
        sa.Column("agent_name", sa.String(64), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("round_number", sa.Integer, default=1),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── memory_entries ───────────────────────────────────────────────────
    op.create_table(
        "memory_entries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "session_id", sa.String(36),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column(
            "run_id", sa.String(36),
            sa.ForeignKey("project_runs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("agent_role", sa.String(32), nullable=False),
        sa.Column(
            "content_type", sa.String(32), nullable=False,
            comment="pm_document|code|review|decision",
        ),
        sa.Column("summary", sa.String(512), nullable=False),
        sa.Column("details", sa.Text, default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── agent_configs ────────────────────────────────────────────────────
    op.create_table(
        "agent_configs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column(
            "role_identifier", sa.String(32), unique=True,
            nullable=False, index=True,
        ),
        sa.Column("system_prompt", sa.Text, nullable=False),
        sa.Column("model", sa.String(64), nullable=True),
        sa.Column("temperature", sa.Float, nullable=True),
        sa.Column("order", sa.Integer, default=0, nullable=False),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("is_approver", sa.Boolean, default=False, nullable=False),
        sa.Column("icon", sa.String(8), default="🤖", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── command_logs ─────────────────────────────────────────────────────
    op.create_table(
        "command_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "session_id", sa.String(36),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("command_id", sa.String(64), nullable=False),
        sa.Column("command_name", sa.String(64), nullable=False),
        sa.Column("payload", sa.Text, default=""),
        sa.Column("result", sa.Text, default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── attachments ──────────────────────────────────────────────────────
    op.create_table(
        "attachments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "session_id", sa.String(36),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("run_id", sa.String(36), nullable=True),
        sa.Column("filename", sa.String(256), nullable=False),
        sa.Column(
            "content_type", sa.String(128),
            default="application/octet-stream",
        ),
        sa.Column("size_bytes", sa.Integer, default=0),
        sa.Column("storage_path", sa.String(512), nullable=False),
        sa.Column("extracted_text", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── user_api_keys ────────────────────────────────────────────────────
    op.create_table(
        "user_api_keys",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(128), nullable=False, index=True),
        sa.Column(
            "provider", sa.String(32), nullable=False,
            comment="openai|deepseek|anthropic|custom",
        ),
        sa.Column("label", sa.String(64), nullable=False),
        sa.Column("encrypted_key", sa.Text, nullable=False),
        sa.Column("base_url", sa.String(256), nullable=True),
        sa.Column(
            "models", sa.Text, default="",
            comment="Comma-separated model IDs",
        ),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("is_default", sa.Boolean, default=False, nullable=False),
        sa.Column(
            "last_used_at", sa.DateTime(timezone=True), nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── key_usage_logs ───────────────────────────────────────────────────
    op.create_table(
        "key_usage_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "key_id", sa.String(36),
            sa.ForeignKey("user_api_keys.id", ondelete="SET NULL"),
            nullable=True, index=True,
        ),
        sa.Column("user_id", sa.String(128), nullable=False, index=True),
        sa.Column("run_id", sa.String(36), nullable=True),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("model", sa.String(64), nullable=False),
        sa.Column("tokens_prompt", sa.Integer, default=0),
        sa.Column("tokens_completion", sa.Integer, default=0),
        sa.Column("tokens_total", sa.Integer, default=0),
        sa.Column("cost_estimate_usd", sa.Float, default=0.0),
        sa.Column("duration_ms", sa.Integer, default=0),
        sa.Column(
            "status", sa.String(16), default="success",
            comment="success|error",
        ),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── checkpoints ──────────────────────────────────────────────────────
    op.create_table(
        "checkpoints",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "session_id", sa.String(36),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column(
            "run_id", sa.String(36),
            sa.ForeignKey("project_runs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("step_index", sa.Integer, default=0),
        sa.Column("agent_state", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("checkpoints")
    op.drop_table("key_usage_logs")
    op.drop_table("user_api_keys")
    op.drop_table("attachments")
    op.drop_table("command_logs")
    op.drop_table("agent_configs")
    op.drop_table("memory_entries")
    op.drop_table("chat_messages")
    op.drop_table("project_runs")
    op.drop_table("sessions")
