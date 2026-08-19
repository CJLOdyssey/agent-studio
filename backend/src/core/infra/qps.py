"""Thread-safe sliding-window requests-per-second counter.

Single responsibility: count HTTP requests over a rolling window so the
health endpoint can report current QPS. Writers (the request middleware)
and the reader (health) share one process-global instance; this is an
in-memory, per-process metric (adequate for the single-process backend
deployment — not distributed).
"""

import threading
import time
from collections import deque


class QPSCounter:
    """Count timestamps of requests within a sliding window."""

    def __init__(self, window_seconds: int = 60) -> None:
        self._window = window_seconds
        self._events: deque[float] = deque()
        self._lock = threading.Lock()

    def record(self) -> None:
        """Record one request at the current time."""
        now = time.monotonic()
        with self._lock:
            self._events.append(now)
            self._prune(now)

    def get(self) -> float:
        """Return the average QPS over the window (or the current rate)."""
        now = time.monotonic()
        with self._lock:
            self._prune(now)
            elapsed = self._window
            return round(len(self._events) / elapsed, 2)

    def _prune(self, now: float) -> None:
        cutoff = now - self._window
        while self._events and self._events[0] <= cutoff:
            self._events.popleft()


_counter = QPSCounter()


def record_request() -> None:
    _counter.record()


def current_qps() -> float:
    return _counter.get()
