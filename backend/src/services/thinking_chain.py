"""思考链内容构建器——为 agent 思考链展示生成结构化节点。

封装：
  - 配置信息块（系统提示词、输出约束、工具、MCP、技能）
  - 用于展示前缀的工具名分类
  - 结果摘要格式化
"""

from __future__ import annotations

import json
from typing import Any


def get_tool_prefix(tool_name: str) -> str:
    """根据工具类别返回工具名的展示前缀。

    - ``mcp_*`` → ``[mcp]``
    - ``skill_*`` → ``[skill]``
    - 其他 → ``[tools]``
    """
    if tool_name.startswith("mcp_"):
        return "[mcp]"
    if tool_name.startswith("skill_"):
        return "[skill]"
    return "[tools]"


def build_config_thinking(
    system_prompt: str,
    tool_definitions: list[dict[str, Any]],
) -> str:
    """为思考链构建初始的配置信息文本块。

    返回一个多段块，各段以 ``\\n\\n`` 分隔，使每段在前端思考链
    （按 ``/\\n{2,}/`` 切分）中渲染为独立节点。

    若无内容可展示则返回空字符串。
    """
    segments: list[str] = []

    # ── 系统提示词与输出约束 ──────────────────────
    if system_prompt:
        clean = system_prompt.strip()
        constraints = ""
        if "输出约束：" in clean:
            parts = clean.split("输出约束：", 1)
            clean = parts[0].strip()
            constraints = parts[1].strip()

        if clean:
            preview = clean.replace("\n", " ")[:120]
            if len(clean.replace("\n", " ")) > 120:
                preview += "..."
            segments.append(f"[info] 系统提示词\n{preview}")
        if constraints:
            segments.append(f"[info] 输出约束\n{constraints[:200]}")
    # ── 工具 / MCP / 技能分类 ───────────────────────
    tool_names: list[str] = [
        d.get("function", {}).get("name", "")
        for d in tool_definitions
    ]

    regular: list[str] = [
        n for n in tool_names
        if n and not n.startswith("mcp_") and not n.startswith("skill_")
    ]
    mcp_servers: set[str] = set()
    for n in tool_names:
        if n.startswith("mcp_") and "_" in n:
            parts = n.split("_", 2)
            if len(parts) >= 2:
                mcp_servers.add(parts[1])
    skill_names: list[str] = [
        n.split("_", 1)[1] for n in tool_names if n.startswith("skill_")
    ]

    if regular:
        segments.append(f"[tools] 可用工具\n{', '.join(regular)}")
    if mcp_servers:
        segments.append(f"[mcp] MCP 服务\n{', '.join(sorted(mcp_servers))}")
    if skill_names:
        segments.append(f"[skill] Skills\n{', '.join(skill_names)}")

    if not segments:
        return ""

    return "\n\n".join(segments) + "\n\n"


def format_result_preview(result: str | Any, max_len: int = 0) -> str:
    """格式化工具结果以在思考链中展示。

    当 max_len > 0 时截断到该长度；当为 0（默认）时返回完整文本——
    前端通过 max-h + overflow-y-auto 控制视觉溢出。
    """
    if isinstance(result, dict):
        # 剔除已在 [tools] 行可见的字段（工具名、query）
        preview = {k: v for k, v in result.items() if k not in ("tool", "query")}
        text = json.dumps(preview, ensure_ascii=False, default=str).strip()
    else:
        text = str(result or "").strip()
        # ToolWrapper.invoke 将字典序列化为 JSON 字符串——尝试解析并剔除
        if text.startswith("{"):
            try:
                parsed = json.loads(text)
                if isinstance(parsed, dict):
                    stripped = {k: v for k, v in parsed.items() if k not in ("tool", "query", "url")}
                    text = json.dumps(stripped, ensure_ascii=False, default=str).strip()
            except json.JSONDecodeError:
                pass
    if not text:
        return "(empty)"
    if 0 < max_len < len(text):
        return text[:max_len] + "..."
    return text
