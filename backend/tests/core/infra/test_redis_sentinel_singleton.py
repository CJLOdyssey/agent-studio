"""Redis Sentinel: _get_sentinel singleton, host parsing, password."""

import importlib
from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def _reset_sentinel_state(monkeypatch):
    """Restore the real module after each test.

    importlib.reload() re-evaluates SENTINEL_ENABLED from the env at reload
    time; tests that set REDIS_SENTINEL_ENABLED=1 leave the module constant
    True even after monkeypatch restores the env. That leaks into later real
    broker.get_redis() calls on the same worker (rate-limit middleware →
    create_redis → Sentinel path), which can then produce a mock pool and
    crash app-lifespan close_redis() with TypeError.
    """
    yield
    monkeypatch.delenv("REDIS_SENTINEL_ENABLED", raising=False)
    mod = importlib.import_module("core.infra.redis_sentinel")
    importlib.reload(mod)
    mod.SENTINEL_ENABLED = False
    mod._sentinel = None


def _reload(monkeypatch, **env):
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    mod = importlib.import_module("core.infra.redis_sentinel")
    importlib.reload(mod)
    return mod


class TestGetSentinel:
    def test_singleton(self, monkeypatch):
        mod = _reload(monkeypatch, REDIS_SENTINEL_ENABLED="1", REDIS_SENTINEL_HOSTS="s1:26379,s2:26380")
        s1 = mod._get_sentinel()
        s2 = mod._get_sentinel()
        assert s1 is s2

    def test_host_parsing(self, monkeypatch):
        mod = _reload(monkeypatch, REDIS_SENTINEL_ENABLED="1", REDIS_SENTINEL_HOSTS="h1:1234,h2:5678")
        with patch.object(mod, "Sentinel") as Mock:
            mod._get_sentinel()
            hosts = Mock.call_args[0][0] if Mock.call_args[0] else Mock.call_args[1]["sentinels"]
            assert ("h1", 1234) in hosts
            assert ("h2", 5678) in hosts

    def test_with_password(self, monkeypatch):
        mod = _reload(monkeypatch, REDIS_SENTINEL_ENABLED="1", REDIS_PASSWORD="pw")
        with patch.object(mod, "Sentinel") as Mock:
            mod._get_sentinel()
            assert Mock.call_args[1].get("password") == "pw"

    def test_decode_responses_default(self, monkeypatch):
        mod = _reload(monkeypatch, REDIS_SENTINEL_ENABLED="1")
        with patch.object(mod, "Sentinel") as Mock:
            mod._get_sentinel()
            assert Mock.call_args[1].get("decode_responses") is True
