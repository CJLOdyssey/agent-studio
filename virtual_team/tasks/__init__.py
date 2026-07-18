"""Re-exports — all logic migrated to virtual_team/tasks/ package."""
from virtual_team.tasks.agent_pipeline import _run_agent_pipeline
from virtual_team.tasks.complete_pipeline import _complete_pipeline
from virtual_team.tasks.pipeline_utils import (
    _build_session_context,
    _discover_mcp_tools,
    _get_rag_context,
    _parse_json_field,
    _report_run_error,
    _run_async,
    _save_output_memories,
    _try_mock_fallback,
)
from virtual_team.tasks.registry import complete_agent, run_agent

__all__ = [
    "_run_agent_pipeline",
    "_complete_pipeline",
    "_build_session_context",
    "_discover_mcp_tools",
    "_get_rag_context",
    "_parse_json_field",
    "_report_run_error",
    "_run_async",
    "_save_output_memories",
    "_try_mock_fallback",
    "complete_agent",
    "run_agent",
]
