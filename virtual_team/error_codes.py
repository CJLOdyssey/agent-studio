"""Structured error code system.

Format: ``{MODULE}_{3_DIGIT_NUMBER}`` (e.g. ``TEAM_001``, ``AGENT_002``).

Usage::

    from virtual_team.error_codes import ErrorCode, error_response
    raise error_response(ErrorCode.TEAM_001, detail="'MyTeam' already exists")
"""

from enum import StrEnum

from starlette.responses import JSONResponse


class ErrorCode(StrEnum):
    """Structured error codes used across the application.

    Format: ``{MODULE}_{3_DIGIT_NUMBER}`` (e.g. ``TEAM_001``).
    """

    # ── Agent ────────────────────────────────────────────────────────
    AGENT_001 = "AGENT_001"  # Agent config not found
    AGENT_002 = "AGENT_002"  # Duplicate role identifier
    AGENT_003 = "AGENT_003"  # Cannot delete last approver
    AGENT_004 = "AGENT_004"  # Cannot deactivate last approver
    AGENT_005 = "AGENT_005"  # Agent creation failed

    # ── Prompt ──────────────────────────────────────────────────────
    PROMPT_001 = "PROMPT_001"  # Prompt not found
    PROMPT_002 = "PROMPT_002"  # Duplicate prompt name

    # ── Tool ─────────────────────────────────────────────────────────
    TOOL_001 = "TOOL_001"  # Tool not found
    TOOL_002 = "TOOL_002"  # Tool generation failed

    # ── MCP ──────────────────────────────────────────────────────────
    MCP_001 = "MCP_001"  # MCP server not found

    # ── Skill ────────────────────────────────────────────────────────
    SKILL_001 = "SKILL_001"  # Skill not found
    SKILL_002 = "SKILL_002"  # Skill generation failed

    # ── Team ─────────────────────────────────────────────────────────
    TEAM_001 = "TEAM_001"  # Team name already exists
    TEAM_002 = "TEAM_002"  # Team not found

    # ── Key ──────────────────────────────────────────────────────────
    KEY_001 = "KEY_001"  # API key not found
    KEY_002 = "KEY_002"  # Invalid key format

    # ── Session ──────────────────────────────────────────────────────
    SESSION_001 = "SESSION_001"  # Session not found

    # ── Auth ─────────────────────────────────────────────────────────
    AUTH_001 = "AUTH_001"  # Unauthorized
    AUTH_002 = "AUTH_002"  # Insufficient role
    AUTH_003 = "AUTH_003"  # Token expired

    # ── Rate Limiting ────────────────────────────────────────────────
    RATE_001 = "RATE_001"  # Too many requests

    # ── General ──────────────────────────────────────────────────────
    GENERAL_001 = "GENERAL_001"  # Internal server error
    GENERAL_002 = "GENERAL_002"  # Invalid request


_ERROR_STATUS = {
    ErrorCode.TEAM_001: 409,
    ErrorCode.AGENT_002: 409,
    ErrorCode.PROMPT_002: 409,
    ErrorCode.AGENT_003: 400,
    ErrorCode.AGENT_004: 400,
    ErrorCode.RATE_001: 429,
    ErrorCode.AUTH_001: 401,
    ErrorCode.AUTH_002: 403,
    ErrorCode.AUTH_003: 401,
}

_ERROR_MESSAGES = {
    ErrorCode.TEAM_001: "Team name already exists",
    ErrorCode.AGENT_002: "Duplicate role identifier",
    ErrorCode.AGENT_003: "Cannot delete last approver",
}


def error_response(code: ErrorCode, detail: str | None = None) -> JSONResponse:
    """Create a JSON error response with structured error code."""
    status = _ERROR_STATUS.get(code, 404) if "001" in code.value else _ERROR_STATUS.get(code, 400)
    message = _ERROR_MESSAGES.get(code, code.value.replace("_", " ").title())
    return JSONResponse(
        status_code=status,
        content={
            "error": {"code": code.value, "message": detail or message},
        },
    )
