"""Repository layer — async data-access functions and CRUD helpers.
Explicit imports from each submodule — no star-imports."""

# ruff: noqa: I001 — isort wants alphabetical, we group by module

from repository.agents import (
    create_agent_config,
    delete_agent_config,
    get_active_agent_configs,
    get_agent_config,
    get_agent_config_by_role,
    get_agent_config_count,
    get_agent_configs,
    get_cached_agent_configs,
    update_agent_config,
)

from repository.attachments import (
    create_attachment,
    delete_attachment,
    get_attachment_by_id,
    list_attachments_by_run,
    list_attachments_by_session,
)

from repository.health import check_database, check_redis

from repository.audit import create_audit_entry

from repository.auth import (
    consume_refresh_token,
    create_refresh_token,
    create_user,
    get_user_by_email,
    get_user_by_id,
    get_user_by_username,
    get_user_roles,
    increment_failed_logins,
    mark_user_verified,
    merge_guest_data,
    reset_failed_logins,
    revoke_all_user_tokens,
    revoke_token_family,
    update_password,
)

from repository.command_logs import log_command

from repository.core import apply_owner_filter

from repository.keys import (
    create_api_key,
    delete_api_key,
    get_api_key_for_model,
    get_api_key_for_use,
    get_api_keys,
    get_default_api_key,
    get_embedding_api_key,
    get_key_usage_stats,
    get_tool_api_key,
    log_key_usage,
    test_api_key_connection,
    update_api_key,
)

from repository.mcps import (
    create_mcp,
    delete_mcp,
    get_mcp,
    get_mcps,
    get_mcps_as_dicts,
    update_mcp,
)

from repository.memory_repo import (
    clear_session_memories,
    create_memory_entry,
    delete_memory_entry,
    get_memory_entry,
    get_session_memories,
)

from repository.message_repo import (
    get_messages,
    get_run_messages,
    get_session_messages,
    save_message,
    update_message_content,
    update_message_versions,
)

from repository.prompts import (
    create_prompt,
    delete_prompt,
    get_cached_prompts_as_dicts,
    get_prompt,
    get_prompts,
    get_prompts_as_dicts,
    update_prompt,
)

from repository.run_repo import (
    create_run,
    get_run,
    get_run_ancestors,
    get_runs,
    get_runs_by_session_ids,
    get_session_runs,
    update_run_result,
    update_run_status,
)

from repository.session_repo import (
    create_session,
    delete_session,
    get_session,
    get_sessions,
    update_session_pin,
    update_session_title,
)

from repository.skills import (
    create_skill,
    delete_skill,
    get_skill,
    get_skills,
    get_skills_as_dicts,
    update_skill,
)

from repository.teams import (
    add_team_member,
    create_team,
    delete_team,
    get_cached_teams,
    get_team,
    get_teams,
    link_agent_config,
    remove_team_member,
    reorder_team_members,
    update_team,
)

from repository.tools import (
    create_tool,
    delete_tool,
    get_tool,
    get_tools,
    get_tools_as_dicts,
    list_tool_plugins,
    update_tool,
)

from repository.workflows import (
    delete_workflow_config,
    get_workflow_config_by_team,
    list_workflow_configs,
    save_workflow_config,
)

__all__ = [
    "add_team_member",
    "apply_owner_filter",
    "check_database",
    "check_redis",
    "clear_session_memories",
    "consume_refresh_token",
    "create_api_key",
    "create_attachment",
    "create_audit_entry",
    "create_agent_config",
    "create_mcp",
    "create_memory_entry",
    "create_prompt",
    "create_refresh_token",
    "create_run",
    "create_session",
    "create_skill",
    "create_team",
    "create_tool",
    "create_user",
    "delete_api_key",
    "delete_attachment",
    "delete_agent_config",
    "delete_mcp",
    "delete_memory_entry",
    "get_memory_entry",
    "delete_prompt",
    "delete_session",
    "delete_skill",
    "delete_team",
    "delete_tool",
    "delete_workflow_config",
    "get_active_agent_configs",
    "get_agent_config",
    "get_agent_config_by_role",
    "get_agent_config_count",
    "get_agent_configs",
    "get_cached_agent_configs",
    "get_cached_prompts_as_dicts",
    "get_cached_teams",
    "get_api_key_for_model",
    "get_api_key_for_use",
    "get_api_keys",
    "get_mcp",
    "get_tool_api_key",
    "get_attachment_by_id",
    "get_default_api_key",
    "get_embedding_api_key",
    "get_key_usage_stats",
    "get_mcps",
    "get_mcps_as_dicts",
    "get_messages",
    "get_prompt",
    "get_prompts",
    "get_prompts_as_dicts",
    "get_run",
    "get_run_ancestors",
    "get_run_messages",
    "get_runs",
    "get_runs_by_session_ids",
    "get_session",
    "get_session_memories",
    "get_session_messages",
    "get_session_runs",
    "get_sessions",
    "get_skill",
    "get_skills",
    "get_skills_as_dicts",
    "get_team",
    "get_teams",
    "get_tool",
    "get_tools",
    "get_tools_as_dicts",
    "get_user_by_email",
    "get_user_by_id",
    "get_user_by_username",
    "get_user_roles",
    "get_workflow_config_by_team",
    "increment_failed_logins",
    "link_agent_config",
    "list_attachments_by_run",
    "list_attachments_by_session",
    "list_tool_plugins",
    "list_workflow_configs",
    "log_command",
    "log_key_usage",
    "mark_user_verified",
    "merge_guest_data",
    "remove_team_member",
    "reorder_team_members",
    "reset_failed_logins",
    "revoke_all_user_tokens",
    "revoke_token_family",
    "save_message",
    "save_workflow_config",
    "test_api_key_connection",
    "update_message_content",
    "update_message_versions",
    "update_api_key",
    "update_agent_config",
    "update_mcp",
    "update_password",
    "update_prompt",
    "update_run_result",
    "update_run_status",
    "update_session_pin",
    "update_session_title",
    "update_skill",
    "update_team",
    "update_tool",
]
