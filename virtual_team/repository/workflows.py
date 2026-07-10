from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from virtual_team.database import (
    WorkflowConfigDB,
    WorkflowEdgeDB,
    WorkflowNodeDB,
    get_session_factory,
)
from virtual_team.workflow.models import (
    NodeStrategy,
    WorkflowConfig,
    WorkflowEdge,
    WorkflowNode,
)


def _node_to_domain(db_node: WorkflowNodeDB) -> WorkflowNode:
    return WorkflowNode(
        id=db_node.id,
        agent_config_id=db_node.agent_config_id,
        role_identifier=db_node.role_identifier,
        strategy=NodeStrategy(db_node.strategy),
        order=db_node.order,
    )


def _edge_to_domain(db_edge: WorkflowEdgeDB) -> WorkflowEdge:
    return WorkflowEdge(
        id=db_edge.id,
        from_node_id=db_edge.from_node_id,
        to_node_id=db_edge.to_node_id,
        condition_key=db_edge.condition_key,
        is_default=db_edge.is_default,
        priority=db_edge.priority,
    )


async def get_workflow_config_by_team(team_id: str) -> WorkflowConfig | None:
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(WorkflowConfigDB)
            .options(
                selectinload(WorkflowConfigDB.nodes),
                selectinload(WorkflowConfigDB.edges),
            )
            .where(WorkflowConfigDB.team_id == team_id)
        )
        result = await session.execute(stmt)
        db_config = result.scalar_one_or_none()
        if db_config is None:
            return None
        nodes = [_node_to_domain(n) for n in db_config.nodes]
        id_to_role = {n.id: n.role_identifier for n in nodes}
        edges = []
        for e in db_config.edges:
            edge = _edge_to_domain(e)
            edge.from_node_id = id_to_role.get(edge.from_node_id, edge.from_node_id)
            edge.to_node_id = id_to_role.get(edge.to_node_id, edge.to_node_id)
            edges.append(edge)
        return WorkflowConfig(
            id=db_config.id,
            team_id=db_config.team_id,
            name=db_config.name,
            max_rounds=db_config.max_rounds,
            nodes=nodes,
            edges=edges,
        )


async def save_workflow_config(config: WorkflowConfig) -> WorkflowConfig:
    factory = get_session_factory()
    async with factory() as session:
        async with session.begin():
            stmt = select(WorkflowConfigDB).where(WorkflowConfigDB.team_id == config.team_id)
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()
            if existing:
                existing.name = config.name
                existing.max_rounds = config.max_rounds
                await session.execute(
                    delete(WorkflowEdgeDB).where(WorkflowEdgeDB.workflow_config_id == existing.id)
                )
                await session.execute(
                    delete(WorkflowNodeDB).where(WorkflowNodeDB.workflow_config_id == existing.id)
                )
                db_config = existing
            else:
                db_config = WorkflowConfigDB(
                    id=config.id or str(uuid4()),
                    team_id=config.team_id,
                    name=config.name,
                    max_rounds=config.max_rounds,
                )
                session.add(db_config)
                await session.flush()

            node_id_map: dict[str, str] = {}
            for node in config.nodes:
                db_node = WorkflowNodeDB(
                    id=node.id if node.id else str(uuid4()),
                    workflow_config_id=db_config.id,
                    agent_config_id=node.agent_config_id,
                    role_identifier=node.role_identifier,
                    strategy=node.strategy.value,
                    order=node.order,
                )
                session.add(db_node)
                node_id_map[node.role_identifier] = db_node.id
                if node.id:
                    node_id_map[node.id] = db_node.id

            for edge in config.edges:
                if edge.to_node_id == "END" or edge.from_node_id == "END":
                    continue
                from_id = node_id_map.get(edge.from_node_id, edge.from_node_id)
                to_id = node_id_map.get(edge.to_node_id, edge.to_node_id)
                db_edge = WorkflowEdgeDB(
                    id=edge.id if edge.id else str(uuid4()),
                    workflow_config_id=db_config.id,
                    from_node_id=from_id,
                    to_node_id=to_id,
                    condition_key=edge.condition_key,
                    is_default=edge.is_default,
                    priority=edge.priority,
                )
                session.add(db_edge)

        await session.refresh(db_config)
        config.id = db_config.id
        return config


async def delete_workflow_config(config_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        async with session.begin():
            db_config = await session.get(WorkflowConfigDB, config_id)
            if db_config is None:
                return False
            await session.delete(db_config)
        return True


async def list_workflow_configs() -> list[WorkflowConfig]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(WorkflowConfigDB)
            .options(
                selectinload(WorkflowConfigDB.nodes),
                selectinload(WorkflowConfigDB.edges),
            )
            .order_by(WorkflowConfigDB.created_at)
        )
        result = await session.execute(stmt)
        configs = result.scalars().all()
        return [
            WorkflowConfig(
                id=c.id,
                team_id=c.team_id,
                name=c.name,
                max_rounds=c.max_rounds,
                nodes=[_node_to_domain(n) for n in c.nodes],
                edges=[_edge_to_domain(e) for e in c.edges],
            )
            for c in configs
        ]
