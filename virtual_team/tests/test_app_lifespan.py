"""Tests for virtual_team/app_lifespan.py — startup, Redis check, seed tools, shutdown."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestAppLifespan:
    def test_mask_url_with_credentials(self):
        from virtual_team.app_lifespan import _mask_url
        result = _mask_url("postgresql://user:secret@localhost:5432/db")
        assert result == "postgresql:***@localhost:5432/db"

    def test_mask_url_without_credentials(self):
        from virtual_team.app_lifespan import _mask_url
        result = _mask_url("redis://localhost:6379/0")
        assert result == "redis://localhost:6379/0"

    def test_mask_url_empty(self):
        from virtual_team.app_lifespan import _mask_url
        assert _mask_url("") == ""

    def test_startup_report_includes_basic_info(self):
        from virtual_team.app_lifespan import _startup_report
        lines = _startup_report()
        assert len(lines) >= 3
        assert any("Application Starting" in line for line in lines)
        assert any("python=" in line for line in lines)
        assert any("Startup config complete" in line for line in lines)

    @pytest.mark.asyncio
    async def test_check_redis_success(self):
        from virtual_team.app_lifespan import _check_redis

        mock_redis = AsyncMock()
        mock_redis.ping.return_value = True

        with patch("virtual_team.app_lifespan.get_redis", return_value=mock_redis):
            await _check_redis()
            mock_redis.ping.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_check_redis_connection_failure(self):
        from virtual_team.app_lifespan import _check_redis

        mock_redis = AsyncMock()
        mock_redis.ping.side_effect = ConnectionError("Redis not available")

        with patch("virtual_team.app_lifespan.get_redis", return_value=mock_redis):
            await _check_redis()
            mock_redis.ping.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_check_redis_timeout(self):
        from virtual_team.app_lifespan import _check_redis

        mock_redis = AsyncMock()
        mock_redis.ping.side_effect = TimeoutError("timeout")

        with patch("virtual_team.app_lifespan.get_redis", return_value=mock_redis):
            await _check_redis()
            mock_redis.ping.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_seed_default_tools_when_empty(self):
        from virtual_team.app_lifespan import seed_default_tools

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None

        async def fake_execute(*args, **kwargs):
            return mock_result

        mock_session = MagicMock()
        mock_session.execute = fake_execute
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()

        mock_cm = AsyncMock()
        mock_cm.__aenter__.return_value = mock_session
        mock_factory = MagicMock(return_value=mock_cm)

        with patch("virtual_team.database.get_session_factory", return_value=mock_factory):
            await seed_default_tools()
            assert mock_session.add.call_count == 3
            mock_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_seed_default_tools_skips_when_exists(self):
        from virtual_team.app_lifespan import seed_default_tools

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = {"id": 1}

        async def fake_execute(*args, **kwargs):
            return mock_result

        mock_session = MagicMock()
        mock_session.execute = fake_execute
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()

        mock_cm = AsyncMock()
        mock_cm.__aenter__.return_value = mock_session
        mock_factory = MagicMock(return_value=mock_cm)

        with patch("virtual_team.database.get_session_factory", return_value=mock_factory):
            await seed_default_tools()
            mock_session.add.assert_not_called()
            mock_session.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_init_database_handles_exception(self):
        from virtual_team.app_lifespan import _init_database

        with patch("virtual_team.app_lifespan._do_init_db", side_effect=Exception("DB error")):
            await _init_database()

    @pytest.mark.asyncio
    async def test_shutdown_cancels_gc_task(self):
        import asyncio

        from virtual_team.app_lifespan import shutdown

        real_task = asyncio.create_task(asyncio.sleep(9999))
        mock_app = MagicMock()
        mock_app.state.gc_task = real_task
        mock_app.title = "test"

        await shutdown(mock_app)
        assert real_task.cancelled()

    @pytest.mark.asyncio
    async def test_startup_calls_config_and_init(self):
        from virtual_team.app_lifespan import startup

        mock_app = MagicMock()
        mock_app.state = MagicMock()

        with patch("virtual_team.app_lifespan.load_config"):
            with patch("virtual_team.app_lifespan._init_database", new_callable=AsyncMock):
                with patch("virtual_team.app_lifespan._check_redis", new_callable=AsyncMock):
                    with patch("virtual_team.app_lifespan.mark_started"):
                        await startup(mock_app)
                        assert hasattr(mock_app.state, "gc_task")

    @pytest.mark.asyncio
    async def test_startup_handles_exception(self):
        from virtual_team.app_lifespan import startup

        mock_app = MagicMock()
        mock_app.state = MagicMock()

        with patch("virtual_team.app_lifespan.load_config"):
            with patch("virtual_team.app_lifespan._init_database", side_effect=RuntimeError("Fatal")):
                with patch("virtual_team.app_lifespan.record_crash") as mock_record:
                    with pytest.raises(RuntimeError, match="Fatal"):
                        await startup(mock_app)
                    mock_record.assert_called_once()

    def test_env_helper(self):
        from virtual_team.app_lifespan import _env

        with patch("virtual_team.app_lifespan.os.environ", {"MY_KEY": "my_value"}):
            assert _env("MY_KEY") == "my_value"
            assert _env("NONEXISTENT", "default") == "default"
            assert _env("NONEXISTENT2") == ""
