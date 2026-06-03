"""CLI entry point — runs a single agent via LangGraph."""
import asyncio
import sys

from virtual_team.config import load_config
from virtual_team.logging_config import get_logger
from virtual_team.repository import get_active_agent_configs, get_session_memories

logger = get_logger(__name__)


def _build_context(memories) -> str:
    if not memories:
        return ""
    lines = ["\n\n【历史上下文】"]
    for m in memories:
        lines.append(f"- [{m.content_type}] {m.agent_role}: {m.summary}")
    return "\n".join(lines)


def run_cli(requirement: str, session_id: str | None = None) -> dict:
    """Run a single agent from the command line."""
    return asyncio.run(_run_cli_async(requirement, session_id))


async def _run_cli_async(requirement: str, session_id: str | None = None) -> dict:
    """Async implementation of CLI agent runner."""
    config = load_config()

    db_configs = await get_active_agent_configs()
    primary = db_configs[0] if db_configs else None

    system_prompt = primary.system_prompt if primary else "你是一个智能助手。"
    model = primary.model or config.model if primary else config.model

    session_context = ""
    if session_id:
        memories = await get_session_memories(session_id)
        if memories:
            session_context = _build_context(memories)

    from virtual_team.agent_graph import DEFAULT_TOOLS, SingleAgentGraph

    graph = SingleAgentGraph(
        model=model,
        api_key=config.api_key,
        base_url=config.api_base,
        temperature=config.temperature,
    )
    graph.set_tools(DEFAULT_TOOLS)

    result = await graph.run(
        system_prompt=system_prompt,
        user_input=requirement,
        thread_id=session_id or "cli",
        session_context=session_context,
    )

    return result


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python -m virtual_team.main <requirement>", file=sys.stderr)
        return 1

    requirement = sys.argv[1]
    cfg = load_config()
    if len(requirement) > cfg.max_requirement_length:
        print(f"Error: requirement too long ({len(requirement)} chars)", file=sys.stderr)
        return 1

    try:
        result = run_cli(requirement)
        import json
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except Exception as e:
        logger.error("CLI failed: %s", e, exc_info=True)
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
