"""Shared agent tool binding — builds ToolConfig lists for graph execution.

Both the single-agent pipeline (tasks/agent_pipeline.py) and the team workflow
engine (workflow/dynamic_team_graph.py) bind an agent's tools/MCP/skills to the
graph before execution. This module owns that mapping so every execution path
produces identical ToolConfigs: agent tools, MCP sub-tools (``mcp_<server>_``),
and skill sub-tools (``skill_<name>`` plus allowed-tools registered as real
tools).
"""

from __future__ import annotations

import json
from typing import Any

from core.infra.logging_config import get_logger
from repository import get_mcps, get_skills, get_tools
from services.tool_config import ToolConfig

from .mcp_executor import exec_stdio_mcp
from .pipeline_utils import _discover_mcp_tools, _parse_json_field

logger = get_logger(__name__)


async def build_agent_tool_configs(ac: Any) -> list[ToolConfig]:
    """Build the deduped list of ToolConfigs for an agent config object.

    ``ac`` needs ``tools`` / ``mcp`` / ``skills`` JSON fields (AgentConfigDB or
    a duck-typed equivalent; missing attributes are treated as empty).
    """
    tool_configs: list[ToolConfig] = []

    all_tools = await get_tools()
    all_mcps = await get_mcps()
    all_skills = await get_skills()

    # ── Agent-bound tools ──
    for item in _parse_json_field(getattr(ac, "tools", "")):
        if not item.get("enabled", True):
            continue
        name = item.get("name", "")
        if name:
            tool_match = next((t for t in all_tools if t.name == name), None)
            # Plugin tool fallback: item.id = canonical tool_name, item.name = display label
            if not tool_match:
                tid = item.get("id", "")
                if tid and tid != name:
                    name = tid
                    tool_match = next((t for t in all_tools if t.name == name), None)
            raw_params = tool_match.parameters if tool_match else (item.get("parameters"))
            if isinstance(raw_params, str):
                try:
                    raw_params = json.loads(raw_params)
                except (json.JSONDecodeError, TypeError):
                    raw_params = None
            tool_configs.append(
                ToolConfig(
                    name=name,
                    description=tool_match.description
                    if tool_match
                    else (item.get("description") or name),
                    parameters=raw_params,
                    endpoint=tool_match.endpoint or "" if tool_match else "",
                    method=tool_match.method or "GET" if tool_match else "GET",
                    headers=tool_match.headers or "{}" if tool_match else "{}",
                )
            )

    # ── MCP servers ──
    for item in _parse_json_field(getattr(ac, "mcp", "")):
        name = item.get("name", "")
        if name:
            mcp_match = next((m for m in all_mcps if m.name == name), None)
            mcp_config = mcp_match.config if mcp_match else None
            mcp_params: dict[str, Any] = {}
            if isinstance(mcp_config, str):
                mcp_params = json.loads(mcp_config) if mcp_config else {}
            elif mcp_config:
                mcp_params = mcp_config
            mcp_type = mcp_match.type or "" if mcp_match else ""
            mcp_endpoint = mcp_match.endpoint or "" if mcp_match else ""
            mcp_prefix = f"mcp_{name}_"

            if mcp_type == "stdio" and mcp_endpoint:
                try:
                    sub_tools = await _discover_mcp_tools(
                        mcp_endpoint,
                        args=mcp_params.get("args") if isinstance(mcp_params, dict) else None,
                        env=mcp_params.get("env") if isinstance(mcp_params, dict) else None,
                    )
                except Exception as e:
                    logger.warning("MCP discovery failed for %s: %s", name, e)
                    sub_tools = []

                if sub_tools:
                    mcp_tool_config = {
                        **(mcp_params if isinstance(mcp_params, dict) else {}),
                        "command": mcp_endpoint,
                    }
                    for st in sub_tools:
                        sub_params = st.get("inputSchema") or {"type": "object"}
                        tool_configs.append(ToolConfig(
                            name=f"{mcp_prefix}{st['name']}",
                            description=st.get("description", "") or "",
                            parameters=sub_params,
                            endpoint="",
                            method="MCP",
                            mcp_type="stdio",
                            mcp_endpoint=mcp_endpoint,
                            mcp_tool_name=st["name"],
                            mcp_config=mcp_tool_config,
                        ))
            elif mcp_endpoint:
                # Non-stdio MCP (like REST-based) → single tool
                params = mcp_params
                tool_configs.append(
                    ToolConfig(
                        name=f"{mcp_prefix}{name}",
                        description=mcp_match.name or name if mcp_match else name,
                        parameters=params,
                        endpoint=mcp_endpoint,
                        method=mcp_type.upper() if mcp_type else "GET",
                        mcp_type=mcp_type,
                    )
                )

    # ── Skills ──
    for item in _parse_json_field(getattr(ac, "skills", "")):
        name = item.get("name", "")
        if name:
            skill_match = next((s for s in all_skills if s.name == name), None)
            if skill_match:
                script_files = getattr(skill_match, "script_files", None) or {}
                parts: list[str] = []
                if skill_match.instructions:
                    parts.append(str(skill_match.instructions))
                if skill_match.output_constraint:
                    parts.append(f"输出约束：\n{skill_match.output_constraint}")
                if skill_match.tool_names:
                    parts.append(f"可用的工具：{', '.join(skill_match.tool_names)}")
                if script_files:
                    ref_blocks = [
                        f"### {path}\n```\n{content}\n```"
                        for path, content in script_files.items()
                    ]
                    parts.append("## 参考脚本（按需复现其逻辑）\n" + "\n".join(ref_blocks))
                skill_instructions = "\n\n".join(filter(None, parts))

                # 子工具真实注册：tool_names 中已存在的工具生成 ToolConfig
                for tname in (skill_match.tool_names or []):
                    tmatch = next((t for t in all_tools if t.name == tname), None)
                    if tmatch:
                        skill_params: dict[str, Any] = {}
                        if getattr(tmatch, "parameters", None):
                            try:
                                if isinstance(tmatch.parameters, str):
                                    skill_params = json.loads(tmatch.parameters)
                                else:
                                    skill_params = tmatch.parameters or {}
                            except (json.JSONDecodeError, TypeError):
                                skill_params = {}
                        tool_configs.append(ToolConfig(
                            name=tname,
                            description=tmatch.description or tname,
                            parameters=skill_params or {"type": "object"},
                            endpoint=tmatch.endpoint or "",
                            method=tmatch.method or "GET",
                            headers=tmatch.headers or "{}",
                        ))

                tool_configs.append(
                    ToolConfig(
                        name=f"skill_{name}",
                        description=(
                            f"{skill_match.content or skill_match.name}。"
                            "当用户请求与该能力相关时调用此技能。"
                        ),
                        instructions=skill_instructions,
                        parameters={"type": "object"},
                        endpoint="",
                        method="GET",
                        headers="{}",
                    )
                )

    # Dedupe by tool name: agent tools, MCP sub-tools, and skill sub-tools can
    # overlap (e.g. agent binds the same tool AND a skill lists it in
    # allowed-tools). LLM APIs reject duplicate tool names — keep first config.
    seen: set[str] = set()
    unique_configs: list[ToolConfig] = []
    for tc in tool_configs:
        if tc.method == "MCP":
            tc.endpoint = exec_stdio_mcp.__name__
        if tc.name in seen:
            continue
        seen.add(tc.name)
        unique_configs.append(tc)

    return unique_configs
