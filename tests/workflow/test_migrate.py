"""Tests for backend/workflow/migrate.py."""

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

os.environ.setdefault("AUTH_MODE", "legacy")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("KEY_VAULT_SECRET", "0123456789abcdef0123456789abcdef")
os.environ.setdefault("AUTH_ENABLED", "0")
os.environ.setdefault("RATE_LIMIT", "9999")
os.environ.setdefault("CHECKPOINTER_BACKEND", "memory")
os.environ.setdefault("DATABASE_POOL_SIZE", "0")


@pytest.mark.unit
class TestMigrateTeams:
    @pytest.mark.asyncio
    @patch("backend.workflow.migrate.save_workflow_config", new_callable=AsyncMock)
    @patch("backend.workflow.migrate.get_workflow_config_by_team", new_callable=AsyncMock)
    @patch("backend.workflow.migrate.get_session_factory")
    async def test_migrate_creates_workflow_for_new_team(
        self, mock_factory_cls, mock_get_existing, mock_save
    ):
        from backend.workflow.migrate import migrate_teams

        mock_get_existing.return_value = None

        team = MagicMock()
        team.id = "team-1"
        team.name = "Test Team"

        member = MagicMock()
        member.agent_config_id = "ag-1"

        agent = MagicMock()
        agent.id = "ag-1"
        agent.role_identifier = "product_manager"

        # Setup async session mock
        mock_session = AsyncMock()

        execute_results = [
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[team])))),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[member])))),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[agent])))),
        ]

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            result = execute_results[call_count]
            call_count += 1
            return result

        mock_session.execute = AsyncMock(side_effect=mock_execute)
        mock_session.get = AsyncMock(return_value=agent)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        mock_factory_cls.return_value = MagicMock(return_value=mock_session)

        count = await migrate_teams()
        assert count == 1
        mock_save.assert_called_once()

    @pytest.mark.asyncio
    @patch("backend.workflow.migrate.get_workflow_config_by_team", new_callable=AsyncMock)
    @patch("backend.workflow.migrate.get_session_factory")
    async def test_migrate_skips_team_with_existing_config(
        self, mock_factory_cls, mock_get_existing
    ):
        from backend.workflow.migrate import migrate_teams

        mock_get_existing.return_value = MagicMock()  # already exists

        team = MagicMock()
        team.id = "team-1"
        team.name = "Existing Team"

        mock_session = AsyncMock()
        execute_result = MagicMock(
            scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[team])))
        )
        mock_session.execute = AsyncMock(return_value=execute_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        mock_factory_cls.return_value = MagicMock(return_value=mock_session)

        count = await migrate_teams()
        assert count == 0

    @pytest.mark.asyncio
    @patch("backend.workflow.migrate.save_workflow_config", new_callable=AsyncMock)
    @patch("backend.workflow.migrate.get_workflow_config_by_team", new_callable=AsyncMock)
    @patch("backend.workflow.migrate.get_session_factory")
    async def test_migrate_no_agents_skips_team(
        self, mock_factory_cls, mock_get_existing, mock_save
    ):
        from backend.workflow.migrate import migrate_teams

        mock_get_existing.return_value = None

        team = MagicMock()
        team.id = "team-1"
        team.name = "No Agents Team"

        member = MagicMock()
        member.agent_config_id = "ag-missing"

        mock_session = AsyncMock()
        execute_results = [
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[team])))),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[member])))),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),
        ]

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            result = execute_results[call_count]
            call_count += 1
            return result

        mock_session.execute = AsyncMock(side_effect=mock_execute)
        mock_session.get = AsyncMock(return_value=None)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        mock_factory_cls.return_value = MagicMock(return_value=mock_session)

        count = await migrate_teams()
        assert count == 0
        mock_save.assert_not_called()

    @pytest.mark.asyncio
    @patch("backend.workflow.migrate.save_workflow_config", new_callable=AsyncMock)
    @patch("backend.workflow.migrate.get_workflow_config_by_team", new_callable=AsyncMock)
    @patch("backend.workflow.migrate.get_session_factory")
    async def test_migrate_agent_without_role_identifier(
        self, mock_factory_cls, mock_get_existing, mock_save
    ):
        from backend.workflow.migrate import migrate_teams

        mock_get_existing.return_value = None

        team = MagicMock()
        team.id = "team-1"
        team.name = "Team"

        member = MagicMock()
        member.agent_config_id = "ag-1"

        agent = MagicMock()
        agent.id = "ag-1"
        agent.role_identifier = None  # no role identifier

        mock_session = AsyncMock()
        execute_results = [
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[team])))),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[member])))),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[agent])))),
        ]

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            result = execute_results[call_count]
            call_count += 1
            return result

        mock_session.execute = AsyncMock(side_effect=mock_execute)
        mock_session.get = AsyncMock(return_value=agent)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        mock_factory_cls.return_value = MagicMock(return_value=mock_session)

        count = await migrate_teams()
        # Agent has no role_identifier, so agent_ids stays empty, nodes list stays empty
        assert count == 0

    @pytest.mark.asyncio
    @patch("backend.workflow.migrate.save_workflow_config", new_callable=AsyncMock)
    @patch("backend.workflow.migrate.get_workflow_config_by_team", new_callable=AsyncMock)
    @patch("backend.workflow.migrate.get_session_factory")
    async def test_migrate_member_without_agent_config_id(
        self, mock_factory_cls, mock_get_existing, mock_save
    ):
        from backend.workflow.migrate import migrate_teams

        mock_get_existing.return_value = None

        team = MagicMock()
        team.id = "team-1"
        team.name = "Team"

        member = MagicMock()
        member.agent_config_id = None  # no agent config id

        # Provide an agent via the fallback query
        agent = MagicMock()
        agent.id = "ag-1"
        agent.role_identifier = "product_manager"

        mock_session = AsyncMock()
        execute_results = [
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[team])))),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[member])))),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[agent])))),
        ]

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            result = execute_results[call_count]
            call_count += 1
            return result

        mock_session.execute = AsyncMock(side_effect=mock_execute)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        mock_factory_cls.return_value = MagicMock(return_value=mock_session)

        count = await migrate_teams()
        # Should succeed via fallback agent lookup
        assert count == 1

    @pytest.mark.asyncio
    @patch("backend.workflow.migrate.get_workflow_config_by_team", new_callable=AsyncMock)
    @patch("backend.workflow.migrate.get_session_factory")
    async def test_migrate_no_teams(self, mock_factory_cls, mock_get_existing):
        from backend.workflow.migrate import migrate_teams

        mock_session = AsyncMock()
        execute_result = MagicMock(
            scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
        )
        mock_session.execute = AsyncMock(return_value=execute_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        mock_factory_cls.return_value = MagicMock(return_value=mock_session)

        count = await migrate_teams()
        assert count == 0
