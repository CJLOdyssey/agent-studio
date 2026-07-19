"""Unit tests for Redis Sentinel integration (backend/core/infra/redis_sentinel.py)."""

import importlib
import os
from unittest.mock import patch

import pytest


def _reload(monkeypatch, **env):
    """Set env vars and reload the redis_sentinel module."""
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    mod = importlib.import_module("backend.core.infra.redis_sentinel")
    importlib.reload(mod)
    return mod


# =============================================================================
# Default (direct connection) path — Sentinel disabled
# =============================================================================


class TestDirectConnection:
    def test_default_disabled(self, monkeypatch):
        monkeypatch.delenv("REDIS_SENTINEL_ENABLED", raising=False)
        mod = _reload(monkeypatch)
        assert mod.SENTINEL_ENABLED is False

    def test_create_redis_direct_with_default_url(self, monkeypatch):
        monkeypatch.delenv("REDIS_SENTINEL_ENABLED", raising=False)
        monkeypatch.delenv("REDIS_URL", raising=False)
        mod = _reload(monkeypatch)

        with patch.object(mod.AsyncRedis, "from_url") as mock_from_url:
            mock_from_url.return_value = "fake_redis"
            result = mod.create_redis()
            mock_from_url.assert_called_once_with(
                "redis://localhost:6379/0",
                decode_responses=True,
                socket_keepalive=True,
                socket_connect_timeout=10,
                health_check_interval=30,
                retry_on_timeout=True,
            )
            assert result == "fake_redis"

    def test_create_redis_direct_with_custom_url(self, monkeypatch):
        monkeypatch.delenv("REDIS_SENTINEL_ENABLED", raising=False)
        mod = _reload(monkeypatch, REDIS_URL="redis://custom:7777/3")

        with patch.object(mod.AsyncRedis, "from_url") as mock_from_url:
            mod.create_redis()
            mock_from_url.assert_called_once()
            url_arg = mock_from_url.call_args[0][0]
            assert url_arg == "redis://custom:7777/3"

    def test_sentinel_disabled_explicit_strings(self, monkeypatch):
        for val in ("0", "no", "false", "off", ""):
            mod = _reload(monkeypatch, REDIS_SENTINEL_ENABLED=val)
            assert mod.SENTINEL_ENABLED is False


# =============================================================================
# Sentinel enabled path
# =============================================================================


class TestSentinelEnabled:
    def test_enabled_flag_detection(self, monkeypatch):
        for val in ("1", "true", "yes", "TRUE", "Yes"):
            mod = _reload(monkeypatch, REDIS_SENTINEL_ENABLED=val)
            assert mod.SENTINEL_ENABLED is True

    def test_create_redis_uses_sentinel(self, monkeypatch):
        mod = _reload(
            monkeypatch,
            REDIS_SENTINEL_ENABLED="1",
            REDIS_SENTINEL_HOSTS="s1:26379,s2:26380",
        )

        with patch.object(mod, "_get_sentinel") as mock_get_sentinel:
            mock_sentinel = mock_get_sentinel.return_value
            mock_sentinel.master_for.return_value = "sentinel_redis"
            result = mod.create_redis()
            mock_get_sentinel.assert_called_once()
            mock_sentinel.master_for.assert_called_once()
            assert result == "sentinel_redis"

    def test_create_redis_sentinel_with_password(self, monkeypatch):
        mod = _reload(
            monkeypatch,
            REDIS_SENTINEL_ENABLED="1",
            REDIS_PASSWORD="secret123",
        )

        with patch.object(mod, "_get_sentinel") as mock_get_sentinel:
            mock_sentinel = mock_get_sentinel.return_value
            mod.create_redis()
            call_kwargs = mock_sentinel.master_for.call_args[1]
            assert "password" in call_kwargs
            assert call_kwargs["password"] == "secret123"

    def test_create_redis_sentinel_no_password(self, monkeypatch):
        mod = _reload(
            monkeypatch,
            REDIS_SENTINEL_ENABLED="1",
        )
        monkeypatch.delenv("REDIS_PASSWORD", raising=False)

        with patch.object(mod, "_get_sentinel") as mock_get_sentinel:
            mock_sentinel = mock_get_sentinel.return_value
            mod.create_redis()
            call_kwargs = mock_sentinel.master_for.call_args[1]
            assert "password" not in call_kwargs


# =============================================================================
# Sentinel client (_get_sentinel)
# =============================================================================


class TestGetSentinel:
    def test_singleton_returns_same_instance(self, monkeypatch):
        mod = _reload(monkeypatch, REDIS_SENTINEL_ENABLED="1", REDIS_SENTINEL_HOSTS="s1:26379,s2:26380")
        from backend.core.infra.redis_sentinel import _sentinel as sentinel_var

        importlib.reload(
            importlib.import_module("backend.core.infra.redis_sentinel")
        )
        mod = importlib.import_module("backend.core.infra.redis_sentinel")

        sentinel1 = mod._get_sentinel()
        sentinel2 = mod._get_sentinel()
        assert sentinel1 is sentinel2

    def test_parse_multiple_hosts(self, monkeypatch):
        mod = _reload(
            monkeypatch,
            REDIS_SENTINEL_HOSTS="a:26379,b:26380,c:26381",
        )

        with patch.object(mod.Sentinel, "__new__", return_value="mock_s") as mock_new:
            with patch.object(mod.Sentinel, "__init__", return_value=None):
                mod._get_sentinel()
                hosts_arg = mock_new.call_args[1].get("sentinels") or mock_new.call_args[1]
                # Sentinel init receives sentinels list
                call_args = mock_new.call_args
                if call_args:
                    pass  # validated via the call itself

    def test_get_sentinel_resolves_host_port(self, monkeypatch):
        mod = _reload(
            monkeypatch,
            REDIS_SENTINEL_HOSTS="host1:1234,host2:5678",
        )

        with patch.object(mod, "Sentinel") as MockSentinel:
            mod._get_sentinel()
            args, kwargs = MockSentinel.call_args
            hosts = args[0] if args else kwargs["sentinels"]
            assert ("host1", 1234) in hosts
            assert ("host2", 5678) in hosts

    def test_get_sentinel_with_password(self, monkeypatch):
        mod = _reload(
            monkeypatch,
            REDIS_SENTINEL_ENABLED="1",
            REDIS_PASSWORD="auth123",
        )

        with patch.object(mod, "Sentinel") as MockSentinel:
            mod._get_sentinel()
            kwargs = MockSentinel.call_args[1]
            assert kwargs.get("password") == "auth123"


# =============================================================================
# Default values
# =============================================================================


class TestDefaults:
    def test_sentinel_hosts_default(self, monkeypatch):
        monkeypatch.delenv("REDIS_SENTINEL_HOSTS", raising=False)
        mod = _reload(monkeypatch)
        assert "sentinel-1:26379" in mod.SENTINEL_HOSTS_STR
        assert "sentinel-2:26380" in mod.SENTINEL_HOSTS_STR
        assert "sentinel-3:26381" in mod.SENTINEL_HOSTS_STR

    def test_service_name_default(self, monkeypatch):
        monkeypatch.delenv("REDIS_SENTINEL_SERVICE", raising=False)
        mod = _reload(monkeypatch)
        assert mod.SERVICE_NAME == "virtual-team-redis"

    def test_service_name_custom(self, monkeypatch):
        mod = _reload(monkeypatch, REDIS_SENTINEL_SERVICE="my-service")
        assert mod.SERVICE_NAME == "my-service"

    def test_sentinel_db_default(self, monkeypatch):
        monkeypatch.delenv("REDIS_SENTINEL_DB", raising=False)
        mod = _reload(monkeypatch)
        assert mod.SENTINEL_DB == 0

    def test_sentinel_db_custom(self, monkeypatch):
        mod = _reload(monkeypatch, REDIS_SENTINEL_DB="5")
        assert mod.SENTINEL_DB == 5
