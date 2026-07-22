"""Tests for admin_stats, command_logs, core, deps, and snapshot_helper."""

import uuid
from datetime import UTC, datetime

import pytest

from backend.core.infra.database import (
    AgentConfigDB,
    AuditLogDB,
    CommandLogDB,
    MCPServerDB,
    PromptDB,
    RegisteredSkillDB,
    RegisteredToolDB,
    TeamDB,
    get_session_factory,
)
from backend.repository.admin_stats import get_command_logs, get_dashboard_stats, get_recent_activity
from backend.repository.command_logs import log_command
from backend.repository.core import apply_owner_filter


# ── Admin Stats ──────────────────────────────────────────────────────────


class TestAdminStats:
    async def test_get_dashboard_stats_returns_all_keys(self, db_engine):
        stats = await get_dashboard_stats()
        assert "agents" in stats
        assert "prompts" in stats
        assert "tools" in stats
        assert "mcps" in stats
        assert "skills" in stats
        assert "teams" in stats
        assert "logs_today" in stats
        assert "updated_at" in stats

    async def test_get_dashboard_stats_with_data(self, db_engine):
        factory = get_session_factory()
        async with factory() as session:
            session.add(AgentConfigDB(
                id=str(uuid.uuid4()), name="A1", role_identifier="a1", system_prompt="p",
                is_active=True, created_at=datetime.now(UTC), updated_at=datetime.now(UTC),
            ))
            session.add(PromptDB(
                id=str(uuid.uuid4()), name="P1", category="c", content="c",
                status="active",
            ))
            session.add(RegisteredToolDB(
                id=str(uuid.uuid4()), name="T1", category="c", description="d",
                status="active",
            ))
            session.add(MCPServerDB(
                id=str(uuid.uuid4()), name="M1", type="stdio", endpoint="e",
                status="active",
            ))
            session.add(RegisteredSkillDB(
                id=str(uuid.uuid4()), name="S1", category="c", content="c",
                status="installed",
            ))
            session.add(TeamDB(
                id=str(uuid.uuid4()), name="Team1",
            ))
            session.add(CommandLogDB(
                id=str(uuid.uuid4()), session_id=str(uuid.uuid4()),
                command_id="c1", command_name="test", payload="{}", result="ok",
            ))
            await session.commit()

        stats = await get_dashboard_stats()
        assert stats["agents"] >= 1
        assert stats["prompts"] >= 1
        assert stats["tools"] >= 1
        assert stats["mcps"] >= 1
        assert stats["skills"] >= 1
        assert stats["teams"] >= 1
        assert stats["logs_today"] >= 1

    async def test_get_command_logs_empty(self, db_engine):
        logs = await get_command_logs(limit=10)
        assert logs["items"] == []

    async def test_get_command_logs_with_data(self, db_engine):
        factory = get_session_factory()
        async with factory() as session:
            session.add(CommandLogDB(
                id=str(uuid.uuid4()), session_id=str(uuid.uuid4()),
                command_id="c1", command_name="gen",
                payload='{"lang":"py"}', result="done",
                created_at=datetime.now(UTC),
            ))
            await session.commit()

        logs = await get_command_logs(limit=10)
        assert len(logs["items"]) == 1
        assert logs["items"][0]["command"] == "gen"
        assert logs["items"][0]["payload"] == '{"lang":"py"}'
        assert logs["items"][0]["result"] == "done"
        assert logs["items"][0]["id"] is not None
        assert logs["items"][0]["timestamp"] != ""

    async def test_get_command_logs_pagination(self, db_engine):
        factory = get_session_factory()
        async with factory() as session:
            for i in range(5):
                session.add(CommandLogDB(
                    id=str(uuid.uuid4()), session_id=str(uuid.uuid4()),
                    command_id=f"c{i}", command_name=f"act{i}",
                    payload="{}", result="ok",
                    created_at=datetime.now(UTC),
                ))
            await session.commit()

        logs = await get_command_logs(limit=2, offset=0)
        assert len(logs["items"]) == 2
        logs2 = await get_command_logs(limit=2, offset=2)
        assert len(logs2["items"]) == 2

    async def test_get_command_logs_all_fields(self, db_engine):
        """Verify all returned fields from get_command_logs."""
        factory = get_session_factory()
        async with factory() as session:
            session.add(CommandLogDB(
                id="test-log-id", session_id="test-sess-id",
                command_id="c1", command_name="test_cmd",
                payload='{"key": "val"}', result="done",
                created_at=datetime.now(UTC),
            ))
            await session.commit()

        logs = await get_command_logs(limit=10)
        assert len(logs["items"]) == 1
        log = logs["items"][0]
        assert log["id"] == "test-log-id"
        assert log["command"] == "test_cmd"
        assert log["payload"] == '{"key": "val"}'
        assert log["result"] == "done"
        assert log["timestamp"] != ""

    async def test_get_recent_activity_empty(self, db_engine):
        activity = await get_recent_activity(limit=10)
        assert activity == []

    async def test_get_recent_activity_with_data(self, db_engine):
        factory = get_session_factory()
        async with factory() as session:
            session.add(AuditLogDB(
                id=str(uuid.uuid4()), action="create",
                entity_type="agent", entity_name="Agent1",
                detail="Created agent", created_at=datetime.now(UTC),
            ))
            await session.commit()

        activity = await get_recent_activity(limit=10)
        assert len(activity) == 1
        assert activity[0]["action"] == "create"
        assert activity[0]["entity_type"] == "agent"
        assert activity[0]["entity_name"] == "Agent1"
        assert activity[0]["detail"] == "Created agent"
        assert activity[0]["id"] is not None
        assert activity[0]["timestamp"] != ""


# ── Command Logs ─────────────────────────────────────────────────────────


class TestCommandLogs:
    async def test_log_command(self, db_engine):
        await log_command(
            session_id=str(uuid.uuid4()),
            command_id="cmd-1",
            command_name="generate_code",
            payload='{"language": "python"}',
            result="success",
        )
        logs = await get_command_logs(limit=10)
        assert len(logs["items"]) == 1
        assert logs["items"][0]["command"] == "generate_code"

    async def test_multiple_command_logs(self, db_engine):
        sid = str(uuid.uuid4())
        for i in range(3):
            await log_command(
                session_id=sid, command_id=f"cmd-{i}",
                command_name=f"action_{i}",
                payload="{}", result="ok",
            )
        logs = await get_command_logs(limit=10)
        assert len(logs["items"]) >= 3


# ── Core ─────────────────────────────────────────────────────────────────


class TestCore:
    def test_apply_owner_filter_with_owner(self):
        from sqlalchemy import select
        stmt = select(AgentConfigDB)
        filtered = apply_owner_filter(stmt, AgentConfigDB, owner_id="user123")
        assert filtered is not None

    def test_apply_owner_filter_no_owner(self):
        from sqlalchemy import select
        stmt = select(AgentConfigDB)
        filtered = apply_owner_filter(stmt, AgentConfigDB, owner_id=None)
        assert filtered is not None

    def test_apply_owner_filter_wildcard(self):
        from sqlalchemy import select
        stmt = select(AgentConfigDB)
        filtered = apply_owner_filter(stmt, AgentConfigDB, owner_id="*")
        assert filtered is not None

    def test_apply_owner_filter_model_without_owner_id(self):
        """Model without owner_id attribute — no filtering applied."""
        from sqlalchemy import select
        stmt = select(PromptDB)
        filtered = apply_owner_filter(stmt, PromptDB, owner_id="user123")
        assert filtered is not None


# ── Deps ─────────────────────────────────────────────────────────────────


class TestDeps:
    def test_import_get_session(self):
        from backend.repository.deps import get_session
        assert get_session is not None

    def test_get_session_is_asyncgen(self):
        import inspect
        from backend.repository.deps import get_session
        assert inspect.isasyncgenfunction(get_session)


# ── Snapshot Helper ──────────────────────────────────────────────────────


class TestSnapshotHelper:
    async def test_create_snapshot_from_dict(self, db_engine):
        from backend.repository.snapshot_helper import create_snapshot_from_dict

        await create_snapshot_from_dict(
            resource_type="agent",
            resource_id="agent-1",
            snapshot={"name": "Test Agent", "prompt": "You are helpful."},
            created_by="test_user",
        )

        from backend.core.infra.database import VersionDB, get_session_factory
        factory = get_session_factory()
        async with factory() as session:
            from sqlalchemy import select
            result = await session.execute(
                select(VersionDB).where(
                    VersionDB.resource_type == "agent",
                    VersionDB.resource_id == "agent-1",
                )
            )
            versions = result.scalars().all()
            assert len(versions) == 1
            assert versions[0].snapshot == {"name": "Test Agent", "prompt": "You are helpful."}
            assert versions[0].created_by == "test_user"

    async def test_create_snapshot_from_dict_with_session(self, db_engine):
        from backend.repository.snapshot_helper import create_snapshot_from_dict
        from backend.core.infra.database import get_session_factory, VersionDB

        factory = get_session_factory()
        async with factory() as session:
            await create_snapshot_from_dict(
                resource_type="team",
                resource_id="team-1",
                snapshot={"name": "Dev Team"},
                session=session,
            )
            await session.commit()

        async with factory() as session:
            from sqlalchemy import select
            result = await session.execute(
                select(VersionDB).where(VersionDB.resource_id == "team-1")
            )
            versions = result.scalars().all()
            assert len(versions) == 1

    async def test_with_session_with_existing_session(self, db_engine):
        from backend.repository.snapshot_helper import with_session
        from backend.core.infra.database import get_session_factory

        called_with = {}

        async def fake_fn(session, resource_type, resource_id, **kw):
            called_with["rt"] = resource_type
            called_with["rid"] = resource_id

        factory = get_session_factory()
        async with factory() as session:
            await with_session(
                fake_fn,
                resource_type="test",
                resource_id="test-1",
                session=session,
            )
        assert called_with["rt"] == "test"
        assert called_with["rid"] == "test-1"

    async def test_with_session_creates_new_session(self, db_engine):
        from backend.repository.snapshot_helper import with_session

        called = {}

        async def fake_fn(session, resource_type, resource_id, **kw):
            called["ok"] = True

        await with_session(
            fake_fn,
            resource_type="test",
            resource_id="test-2",
        )
        assert called.get("ok") is True

    def test_build_table_snapshot(self):
        from backend.repository.snapshot_helper import build_table_snapshot
        from backend.core.infra.database import AgentConfigDB

        agent = AgentConfigDB(
            id="test-id",
            name="Test Agent",
            role_identifier="test_role",
            system_prompt="Prompt text",
        )
        snapshot = build_table_snapshot(agent)
        assert "id" not in snapshot
        assert "created_at" not in snapshot
        assert "updated_at" not in snapshot
        assert snapshot["name"] == "Test Agent"
        assert snapshot["role_identifier"] == "test_role"
        assert snapshot["system_prompt"] == "Prompt text"

    def test_build_table_snapshot_custom_exclude(self):
        from backend.repository.snapshot_helper import build_table_snapshot
        from backend.core.infra.database import AgentConfigDB

        agent = AgentConfigDB(
            id="test-id",
            name="Test Agent",
            role_identifier="test_role",
            system_prompt="Prompt text",
        )
        snapshot = build_table_snapshot(agent, exclude={"name", "id"})
        assert "name" not in snapshot
        assert "id" not in snapshot
        assert snapshot["role_identifier"] == "test_role"

    def test_build_table_snapshot_datetime_value(self):
        """DateTime values are converted to isoformat strings."""
        from backend.repository.snapshot_helper import build_table_snapshot
        from backend.core.infra.database import AgentConfigDB
        from datetime import UTC, datetime

        agent = AgentConfigDB(
            id="test-id", name="Test Agent", role_identifier="r",
            created_at=datetime(2024, 1, 1, tzinfo=UTC),
            updated_at=datetime(2024, 6, 15, tzinfo=UTC),
        )
        snapshot = build_table_snapshot(agent, exclude=set())
        assert snapshot["created_at"] == "2024-01-01T00:00:00+00:00"
        assert snapshot["updated_at"] == "2024-06-15T00:00:00+00:00"

    def test_build_table_snapshot_none_value(self):
        """None column values are included as None."""
        from backend.repository.snapshot_helper import build_table_snapshot
        from backend.core.infra.database import AgentConfigDB

        agent = AgentConfigDB(
            id="id", name="Test", role_identifier="r",
        )
        snapshot = build_table_snapshot(agent, exclude=set())
        # icon defaults to something, but model/temperature may be None
        assert "model" in snapshot
