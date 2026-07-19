"""Root conftest — auto-skip integration tests when infrastructure is unavailable."""

import socket
import pytest


def _service_available(host: str, port: int, timeout: float = 1.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (OSError, TimeoutError):
        return False


def pytest_collection_modifyitems(config, items):
    """Auto-skip integration-marked tests when required services are not running."""
    # Check backend server (most integration tests need this)
    backend_ok = _service_available("localhost", 8080) or _service_available("localhost", 8081)

    if backend_ok:
        return

    skip_marker = pytest.mark.skip(reason="Integration test requires: backend server on port 8080/8081")
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip_marker)
