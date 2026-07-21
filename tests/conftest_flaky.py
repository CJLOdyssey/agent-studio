"""Flaky test detection and retry configuration.

Prefer pytest-rerunfailures (``--reruns 2`` in CI) over this decorator
for standard flaky test handling. This decorator is kept for edge cases
where per-test custom retry logic is needed.
"""
import asyncio
import time
from functools import wraps


def flaky_test(max_retries: int = 3, delay: float = 1):
    """Decorator to retry flaky tests (sync & async compatible)."""
    def decorator(func):
        if asyncio.iscoroutinefunction(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                last_exception = None
                for attempt in range(max_retries):
                    try:
                        return await func(*args, **kwargs)
                    except Exception as e:
                        last_exception = e
                        if attempt < max_retries - 1:
                            await asyncio.sleep(delay)
                raise last_exception  # type: ignore[misc]
            return wrapper
        else:
            @wraps(func)
            def wrapper(*args, **kwargs):
                last_exception = None
                for attempt in range(max_retries):
                    try:
                        return func(*args, **kwargs)
                    except Exception as e:
                        last_exception = e
                        if attempt < max_retries - 1:
                            time.sleep(delay)
                raise last_exception  # type: ignore[misc]
            return wrapper
    return decorator
