"""Tests for workflows.py repository."""

import uuid

import pytest

from backend.repository.workflows import (
    delete_workflow_config,
    get_workflow_config_by_team,
    list_workflow_configs,
    save_workflow_config,
)
from backend.workflow.models import NodeStrategy, WorkflowConfig, WorkflowEdge, WorkflowNode


class TestWorkflowRepo:
    def _make_config(self, team_id: str, suffix: str = "") -> WorkflowConfig:
        n1_id = f"n1_{suffix}" if suffix else str(uuid.uuid4())
        n2_id = f"n2_{suffix}" if suffix else str(uuid.uuid4())
        return WorkflowConfig(
            id=str(uuid.uuid4()),
            team_id=team_id,
            name="Test Workflow",
            max_rounds=3,
            nodes=[
                WorkflowNode(
                    id=n1_id, agent_config_id="agent1", role_identifier="pm",
                    strategy=NodeStrategy.GENERATOR, order=1,
                ),
                WorkflowNode(
                    id=n2_id, agent_config_id="agent2", role_identifier="dev",
                    strategy=NodeStrategy.REVIEWER, order=2,
                ),
            ],
            edges=[
                WorkflowEdge(from_node_id=n1_id, to_node_id=n2_id),
            ],
        )

    async def test_save_and_get_workflow_config(self, db_engine):
        team_id = str(uuid.uuid4())
        config = self._make_config(team_id, "save")
        saved = await save_workflow_config(config)
        assert saved.id is not None
        assert saved.team_id == team_id
        assert saved.name == "Test Workflow"

        fetched = await get_workflow_config_by_team(team_id)
        assert fetched is not None
        assert fetched.team_id == team_id
        assert len(fetched.nodes) == 2
        assert len(fetched.edges) == 1

    async def test_get_workflow_config_not_found(self, db_engine):
        result = await get_workflow_config_by_team("nonexistent-team")
        assert result is None

    async def test_list_workflow_configs(self, db_engine):
        configs = await list_workflow_configs()
        count_before = len(configs)
        config = self._make_config(str(uuid.uuid4()), "list")
        await save_workflow_config(config)
        configs = await list_workflow_configs()
        assert len(configs) == count_before + 1

    async def test_delete_workflow_config(self, db_engine):
        team_id = str(uuid.uuid4())
        config = self._make_config(team_id, "del")
        saved = await save_workflow_config(config)
        result = await delete_workflow_config(saved.id)
        assert result is True
        fetched = await get_workflow_config_by_team(team_id)
        assert fetched is None

    async def test_delete_workflow_config_not_found(self, db_engine):
        result = await delete_workflow_config(str(uuid.uuid4()))
        assert result is False

    async def test_save_update_existing(self, db_engine):
        team_id = str(uuid.uuid4())
        config = self._make_config(team_id, "upd")
        await save_workflow_config(config)

        updated = self._make_config(team_id, "upd2")
        updated.name = "Updated Workflow"
        await save_workflow_config(updated)

        fetched = await get_workflow_config_by_team(team_id)
        assert fetched is not None
        assert fetched.name == "Updated Workflow"

    async def test_save_config_with_end_edges(self, db_engine):
        """Edges with 'END' as from or to node should be skipped."""
        team_id = str(uuid.uuid4())
        n1_id = str(uuid.uuid4())
        config = WorkflowConfig(
            id=str(uuid.uuid4()),
            team_id=team_id,
            name="End Test",
            max_rounds=1,
            nodes=[
                WorkflowNode(
                    id=n1_id, agent_config_id="a1", role_identifier="pm",
                    strategy=NodeStrategy.GENERATOR, order=1,
                ),
            ],
            edges=[
                WorkflowEdge(from_node_id=n1_id, to_node_id="END"),
                WorkflowEdge(from_node_id="END", to_node_id=n1_id),
            ],
        )
        saved = await save_workflow_config(config)
        fetched = await get_workflow_config_by_team(team_id)
        assert fetched is not None
        # END edges should be skipped
        assert len(fetched.edges) == 0

    async def test_save_config_node_id_mapping(self, db_engine):
        """Edge from_node_id and to_node_id get remapped to role identifiers."""
        team_id = str(uuid.uuid4())
        n1 = str(uuid.uuid4())
        n2 = str(uuid.uuid4())
        config = WorkflowConfig(
            id=str(uuid.uuid4()),
            team_id=team_id,
            name="Map Test",
            max_rounds=2,
            nodes=[
                WorkflowNode(id=n1, agent_config_id="a1", role_identifier="pm", strategy=NodeStrategy.GENERATOR, order=1),
                WorkflowNode(id=n2, agent_config_id="a2", role_identifier="dev", strategy=NodeStrategy.REVIEWER, order=2),
            ],
            edges=[
                WorkflowEdge(from_node_id=n1, to_node_id=n2, condition_key="approve", is_default=True, priority=1),
            ],
        )
        saved = await save_workflow_config(config)
        fetched = await get_workflow_config_by_team(team_id)
        assert fetched is not None
        assert len(fetched.edges) == 1
        edge = fetched.edges[0]
        assert edge.from_node_id == "pm"
        assert edge.to_node_id == "dev"
        assert edge.condition_key == "approve"
        assert edge.is_default is True
        assert edge.priority == 1

    async def test_save_config_without_node_ids(self, db_engine):
        """Nodes without explicit IDs get UUIDs assigned."""
        team_id = str(uuid.uuid4())
        config = WorkflowConfig(
            id=str(uuid.uuid4()),
            team_id=team_id,
            name="No ID Test",
            max_rounds=1,
            nodes=[
                WorkflowNode(agent_config_id="a1", role_identifier="pm", strategy=NodeStrategy.GENERATOR, order=1),
            ],
            edges=[],
        )
        saved = await save_workflow_config(config)
        fetched = await get_workflow_config_by_team(team_id)
        assert fetched is not None
        assert len(fetched.nodes) == 1
        assert fetched.nodes[0].id is not None

    async def test_list_configs_empty(self, db_engine):
        configs = await list_workflow_configs()
        # May be empty or have data from other tests
        assert isinstance(configs, list)
