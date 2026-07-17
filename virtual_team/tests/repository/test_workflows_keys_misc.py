"""Repository tests for workflows, keys, attachments, admin_stats, and more.

Uses conftest fixtures (db_engine) against in-memory SQLite.
"""

import uuid

from sqlalchemy import select

from virtual_team.repository.admin_stats import get_command_logs, get_dashboard_stats
from virtual_team.repository.attachments import (
    create_attachment,
    delete_attachment,
    get_attachment_by_id,
    list_attachments_by_session,
)
from virtual_team.repository.command_logs import log_command
from virtual_team.repository.core import apply_owner_filter
from virtual_team.repository.keys_crud import (
    create_api_key,
    delete_api_key,
    get_api_key_for_use,
    get_api_keys,
    get_default_api_key,
    get_embedding_api_key,
    update_api_key,
)
from virtual_team.repository.session_repo import create_session
from virtual_team.repository.workflows import (
    delete_workflow_config,
    get_workflow_config_by_team,
    list_workflow_configs,
    save_workflow_config,
)
from virtual_team.workflow.models import NodeStrategy, WorkflowConfig, WorkflowEdge, WorkflowNode

# ── Workflow Tests ─────────────────────────────────────────────────────


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
        await delete_workflow_config(saved.id)
        fetched = await get_workflow_config_by_team(team_id)
        assert fetched is None

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


# ── Keys Tests ─────────────────────────────────────────────────────────


class TestKeysRepo:
    USER_ID = "test-keys-user"

    async def test_create_and_get_api_keys(self, db_engine):
        key = await create_api_key(
            user_id=self.USER_ID,
            provider="openai",
            plaintext_key="sk-test123",
            label="Test Key",
        )
        assert key.id is not None
        assert key.provider == "openai"
        assert key.label == "Test Key"

        keys = await get_api_keys(self.USER_ID)
        assert len(keys) >= 1
        key_dict = next(k for k in keys if k["id"] == key.id)
        assert key_dict["provider"] == "openai"

    async def test_get_api_key_for_use(self, db_engine):
        key = await create_api_key(
            user_id=self.USER_ID,
            provider="anthropic",
            plaintext_key="sk-ant-test",
            label="Use Key",
        )
        usable = await get_api_key_for_use(key.id, self.USER_ID)
        assert usable is not None
        assert usable["id"] == key.id

    async def test_get_api_key_for_use_not_found(self, db_engine):
        result = await get_api_key_for_use("nonexistent-key", "nonexistent-user")
        assert result is None

    async def test_update_api_key(self, db_engine):
        key = await create_api_key(
            user_id=self.USER_ID,
            provider="openai",
            plaintext_key="sk-old",
            label="Update Me",
        )
        await update_api_key(key.id, self.USER_ID, label="Updated Label", is_default=True)
        keys = await get_api_keys(self.USER_ID)
        updated = next(k for k in keys if k["id"] == key.id)
        assert updated["label"] == "Updated Label"
        assert updated["is_default"] is True

    async def test_delete_api_key(self, db_engine):
        key = await create_api_key(
            user_id="delete-user",
            provider="openai",
            plaintext_key="sk-delete",
        )
        await delete_api_key(key.id, "delete-user")
        keys = await get_api_keys("delete-user")
        assert not any(k["id"] == key.id for k in keys)

    async def test_get_default_and_embedding_keys(self, db_engine):
        await create_api_key(
            user_id=self.USER_ID, provider="openai",
            plaintext_key="sk-default", is_default=True,
        )
        default = await get_default_api_key(self.USER_ID)
        assert default is not None

        await get_embedding_api_key()


# ── Attachment Tests ───────────────────────────────────────────────────


class TestAttachmentRepo:
    async def test_create_and_get_attachment(self, db_engine):
        sess = await create_session(title="Att Session")
        att = await create_attachment(
            attachment_id=str(uuid.uuid4()),
            session_id=sess.id,
            filename="test.txt",
            content_type="text/plain",
            size_bytes=100,
            storage_path="/tmp/test.txt",
        )
        assert att.id is not None
        assert att.filename == "test.txt"

        fetched = await get_attachment_by_id(att.id)
        assert fetched is not None
        assert fetched.filename == "test.txt"

    async def test_get_attachment_not_found(self, db_engine):
        result = await get_attachment_by_id("nonexistent")
        assert result is None

    async def test_list_attachments_by_session(self, db_engine):
        sess = await create_session(title="List Att Session")
        await create_attachment(
            attachment_id=str(uuid.uuid4()), session_id=sess.id,
            filename="a.txt", content_type="text/plain",
            size_bytes=10, storage_path="/tmp/a.txt",
        )
        await create_attachment(
            attachment_id=str(uuid.uuid4()), session_id=sess.id,
            filename="b.txt", content_type="text/plain",
            size_bytes=20, storage_path="/tmp/b.txt",
        )
        attachments = await list_attachments_by_session(sess.id)
        assert len(attachments) == 2

    async def test_delete_attachment(self, db_engine):
        sess = await create_session(title="Del Att Session")
        att = await create_attachment(
            attachment_id=str(uuid.uuid4()), session_id=sess.id,
            filename="del.txt", content_type="text/plain",
            size_bytes=1, storage_path="/tmp/del.txt",
        )
        path = await delete_attachment(att.id)
        assert path == "/tmp/del.txt"
        fetched = await get_attachment_by_id(att.id)
        assert fetched is None

    async def test_delete_attachment_not_found(self, db_engine):
        result = await delete_attachment("nonexistent")
        assert result is None


# ── Admin Stats Tests ──────────────────────────────────────────────────


class TestAdminStatsRepo:
    async def test_get_dashboard_stats(self, db_engine):
        stats = await get_dashboard_stats()
        assert "agents" in stats
        assert "prompts" in stats
        assert "tools" in stats
        assert "mcps" in stats
        assert "skills" in stats
        assert "teams" in stats
        assert "logs_today" in stats

    async def test_get_command_logs_empty(self, db_engine):
        logs = await get_command_logs(limit=10)
        assert logs == []


# ── Command Logs Tests ─────────────────────────────────────────────────


class TestCommandLogsRepo:
    async def test_log_command(self, db_engine):
        await log_command(
            session_id=str(uuid.uuid4()),
            command_id="cmd-1",
            command_name="generate_code",
            payload='{"language": "python"}',
            result="success",
        )
        logs = await get_command_logs(limit=10)
        assert len(logs) == 1
        assert logs[0]["command"] == "generate_code"

    async def test_multiple_command_logs(self, db_engine):
        sid = str(uuid.uuid4())
        for i in range(3):
            await log_command(
                session_id=sid, command_id=f"cmd-{i}",
                command_name=f"action_{i}",
                payload="{}", result="ok",
            )
        logs = await get_command_logs(limit=10)
        assert len(logs) >= 3


# ── Core Tests ─────────────────────────────────────────────────────────


class TestCoreRepo:
    async def test_apply_owner_filter_with_owner(self, db_engine):
        from virtual_team.database import AgentConfigDB
        stmt = select(AgentConfigDB)
        filtered = apply_owner_filter(stmt, AgentConfigDB, owner_id="user123")
        assert filtered is not None

    async def test_apply_owner_filter_no_owner(self, db_engine):
        from virtual_team.database import AgentConfigDB
        stmt = select(AgentConfigDB)
        filtered = apply_owner_filter(stmt, AgentConfigDB, owner_id=None)
        assert filtered is not None

    async def test_apply_owner_filter_wildcard(self, db_engine):
        from virtual_team.database import AgentConfigDB
        stmt = select(AgentConfigDB)
        filtered = apply_owner_filter(stmt, AgentConfigDB, owner_id="*")
        assert filtered is not None
