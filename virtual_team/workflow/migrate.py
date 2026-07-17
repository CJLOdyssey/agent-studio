"""Migration: create default workflow config for existing teams
that matches the old hardcoded PM→Frontend→Backend→Tester flow.

Run once at startup or via: PYTHONPATH=. python -m virtual_team.workflow.migrate
"""
import asyncio
from typing import Any, cast

from sqlalchemy import select

from virtual_team.database import (
    AgentConfigDB,
    TeamAgentDB,
    TeamDB,
    get_session_factory,
)
from virtual_team.logging_config import get_logger
from virtual_team.repository.workflows import get_workflow_config_by_team, save_workflow_config
from virtual_team.workflow.models import (
    NodeStrategy,
    WorkflowConfig,
    WorkflowEdge,
    WorkflowNode,
)

logger = get_logger(__name__)

DEFAULT_WORKFLOW: dict[str, Any] = {
    "name": "默认四阶段协作",
    "max_rounds": 5,
    "nodes": [
        {"role_identifier": "product_manager", "strategy": "generator", "order": 0},
        {"role_identifier": "frontend", "strategy": "generator", "order": 1},
        {"role_identifier": "backend", "strategy": "generator", "order": 2},
        {"role_identifier": "tester", "strategy": "reviewer", "order": 3},
    ],
    "edges": [
        {"from": "product_manager", "to": "frontend"},
        {"from": "frontend", "to": "backend"},
        {"from": "backend", "to": "tester"},
        {"from": "tester", "to": "END", "condition_key": "APPROVED|PASS|✅|通过", "priority": 1},
        {"from": "tester", "to": "frontend", "condition_key": "NEED_FIX|修改", "is_default": True, "priority": 2},
    ],
}


async def migrate_teams() -> int:
    """Create default workflow configs for all teams that don't have one yet."""
    factory = get_session_factory()
    async with factory() as session:
        teams_result = await session.execute(select(TeamDB))
        teams = teams_result.scalars().all()

    migrated = 0
    for team in teams:
        existing = await get_workflow_config_by_team(team.id)
        if existing:
            continue

        # Collect agent configs for this team
        async with factory() as session:
            members_result = await session.execute(
                select(TeamAgentDB).where(TeamAgentDB.team_id == team.id)
            )
            members = members_result.scalars().all()

        agent_ids: dict[str, str] = {}
        async with factory() as session:
            for member in members:
                if not member.agent_config_id:
                    continue
                agent = await session.get(AgentConfigDB, member.agent_config_id)
                if agent and agent.role_identifier:
                    agent_ids[agent.role_identifier] = agent.id

        # Fallback: check all agent configs
        async with factory() as session:
            all_agents = await session.execute(select(AgentConfigDB))
            for agent in all_agents.scalars().all():
                if agent.role_identifier not in agent_ids:
                    agent_ids[agent.role_identifier] = agent.id

        nodes: list[WorkflowNode] = []
        for nd in DEFAULT_WORKFLOW["nodes"]:
            rid = nd["role_identifier"]
            cfg_id = agent_ids.get(rid)
            if cfg_id:
                nodes.append(WorkflowNode(
                    agent_config_id=cfg_id,
                    role_identifier=rid,
                    strategy=NodeStrategy(nd["strategy"]),
                    order=nd["order"],
                ))

        if not nodes:
            logger.info("Team %s has no matching agent configs for default workflow", team.name)
            continue

        edges: list[WorkflowEdge] = []
        for i, ed in enumerate(cast(list[Any], DEFAULT_WORKFLOW["edges"])):
            edges.append(WorkflowEdge(
                id=f"e-{i}", from_node_id=ed["from"], to_node_id=ed["to"],
                condition_key=ed.get("condition_key"),
                is_default=ed.get("is_default", False),
                priority=ed.get("priority", 0),
            ))

        config = WorkflowConfig(
            team_id=team.id,
            name=cast(str, DEFAULT_WORKFLOW["name"]),
            max_rounds=cast(int, DEFAULT_WORKFLOW["max_rounds"]),
            nodes=nodes,
            edges=edges,
        )
        await save_workflow_config(config)
        logger.info("Migrated team %s: created default workflow", team.name)
        migrated += 1

    return migrated


if __name__ == "__main__":
    count = asyncio.run(migrate_teams())
    print(f"Migrated {count} teams")
