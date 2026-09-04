"""会话记忆导出——将记忆条目渲染为 JSON 或 Markdown 内容。

单一职责：从 repository 层的记忆条目生成可下载内容。HTTP 传输（Response、
Content-Disposition）留在路由层，本模块只做纯内容渲染，便于独立复用与单测。
"""

import json
from typing import Any


def _memory_to_dict(m: Any) -> dict[str, Any]:
    return {
        "id": m.id,
        "agent_role": m.agent_role,
        "content_type": m.content_type,
        "summary": m.summary,
        "details": m.details,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def render_memories_json(memories: list[Any]) -> str:
    """将记忆渲染为格式化 JSON 字符串。"""
    items = [_memory_to_dict(m) for m in memories]
    return json.dumps(items, ensure_ascii=False, default=str, indent=2)


def render_memories_markdown(session_id: str, memories: list[Any]) -> str:
    """将记忆渲染为 Markdown 文本。"""
    md_lines = [f"# Session Memories ({session_id})\n"]
    for m in memories:
        md_lines.append(f"## Memory: {m.content_type}")
        md_lines.append(
            f"**Agent**: {m.agent_role} | "
            f"**Created**: {m.created_at.isoformat() if m.created_at else 'N/A'}"
        )
        md_lines.append("")
        md_lines.append(f"**Summary**: {m.summary}")
        md_lines.append("")
        md_lines.append("**Details**:")
        md_lines.append(m.details or "(无详情)")
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")
    return "\n".join(md_lines)
