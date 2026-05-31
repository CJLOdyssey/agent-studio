import asyncio
import logging
import sys

from virtual_team.config import TeamConfig, load_config
from virtual_team.conversation import TeamManager
from virtual_team.logging_config import get_logger
from virtual_team.models import AgentConfig
from virtual_team.repository import get_active_agent_configs

logger = get_logger(__name__)

MAX_REQUIREMENT_LENGTH = 2000


def run_team(
    requirement: str, config: TeamConfig | None = None
) -> dict:
    if config is None:
        config = load_config()

    loop = asyncio.new_event_loop()
    try:
        db_configs = loop.run_until_complete(get_active_agent_configs())
    finally:
        loop.close()

    agent_configs = [
        AgentConfig(
            id=ac.id,
            name=ac.name,
            role_identifier=ac.role_identifier,
            system_prompt=ac.system_prompt,
            model=ac.model,
            temperature=ac.temperature,
            order=ac.order,
            is_active=ac.is_active,
            is_approver=ac.is_approver,
            icon=ac.icon,
        )
        for ac in db_configs
    ]

    manager = TeamManager(config, agent_configs)
    output = manager.run(requirement)
    return output.model_dump()


def main() -> int:
    if len(sys.argv) < 2:
        logger.warning("No requirement provided")
        print("Usage: python -m virtual_team.main <requirement>")
        return 1
    requirement = sys.argv[1]
    if len(requirement) > MAX_REQUIREMENT_LENGTH:
        logger.error("Requirement too long: %d chars (max %d)", len(requirement), MAX_REQUIREMENT_LENGTH)
        print(f"Error: requirement too long ({len(requirement)} chars, max {MAX_REQUIREMENT_LENGTH})", file=sys.stderr)
        return 1
    logger.info("CLI run | requirement=%.200s | chars=%d", requirement, len(requirement))
    try:
        config = load_config()
        loop = asyncio.new_event_loop()
        try:
            db_configs = loop.run_until_complete(get_active_agent_configs())
        finally:
            loop.close()

        agent_configs = [
            AgentConfig(
                id=ac.id, name=ac.name, role_identifier=ac.role_identifier,
                system_prompt=ac.system_prompt, model=ac.model,
                temperature=ac.temperature, order=ac.order,
                is_active=ac.is_active, is_approver=ac.is_approver, icon=ac.icon,
            )
            for ac in db_configs
        ]
        manager = TeamManager(config, agent_configs)
        output = manager.run(requirement)
        print(output.model_dump_json(indent=2, ensure_ascii=False))
        logger.info("CLI completed | status=%s | approved=%s",
                     manager.status.value, output.approved)
        return 0
    except (ValueError, RuntimeError) as e:
        logger.error("CLI failed | error=%s", e, exc_info=True)
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
