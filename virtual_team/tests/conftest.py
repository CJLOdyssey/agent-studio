"""Shared fixtures and helpers for E2E tests."""

import contextlib
import string
import uuid

import httpx
import pytest

BASE = "http://localhost:8080"


def _rid(prefix: str = "test") -> str:
    suffix = uuid.uuid4().hex[:8]
    clean_suffix = "".join(c for c in suffix if c in string.ascii_lowercase)
    clean_prefix = "".join(c for c in prefix if c in string.ascii_lowercase + "_")
    result = f"{clean_prefix}_{clean_suffix}" if clean_suffix else f"{clean_prefix}_x"
    return result


def _clear_rate_limits():
    try:
        import subprocess
        keys = subprocess.run(
            ["docker", "exec", "virtual-team-redis", "redis-cli", "KEYS", "ratelimit:*"],
            capture_output=True, text=True, timeout=5,
        )
        if keys.stdout.strip():
            key_list = keys.stdout.strip().split("\n")
            subprocess.run(
                ["docker", "exec", "virtual-team-redis", "redis-cli", "DEL"] + key_list,
                capture_output=True, timeout=5,
            )
    except Exception:
        pass


def _cleanup(*ids_and_endpoints: tuple[str, str]):
    c = httpx.Client(base_url=BASE, timeout=10)
    for eid, ep in ids_and_endpoints:
        with contextlib.suppress(Exception):
            c.delete(f"{ep}/{eid}")
    c.close()


class Api:
    def __init__(self, base: str = BASE):
        self.client = httpx.Client(base_url=base, timeout=30)

    def get(self, path: str, **kw):
        return self.client.get(path, **kw)

    def post(self, path: str, json=None, **kw):
        return self.client.post(path, json=json, **kw)

    def put(self, path: str, json=None, **kw):
        return self.client.put(path, json=json, **kw)

    def delete(self, path: str, **kw):
        return self.client.delete(path, **kw)

    def close(self):
        self.client.close()


@pytest.fixture
def api():
    a = Api()
    yield a
    a.close()


@pytest.fixture(autouse=True)
def _fresh_rate_limit():
    _clear_rate_limits()
