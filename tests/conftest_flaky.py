"""Flaky test detection and retry configuration."""
import pytest
import time
from functools import wraps


def flaky_test(max_retries=3, delay=1):
    """Decorator to retry flaky tests."""
    def decorator(func):
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
            raise last_exception
        return wrapper
    return decorator
