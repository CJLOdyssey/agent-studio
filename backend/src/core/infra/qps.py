"""线程安全的滑动窗口每秒请求数（QPS）计数器。

单一职责：在滚动窗口内统计 HTTP 请求，使健康端点能上报当前 QPS。
写入方（请求中间件）与读取方（健康检查）共享一个进程级实例；这是
内存内、每进程的指标（适用于单进程后端部署 —— 非分布式）。
"""

import threading
import time
from collections import deque


class QPSCounter:
    """统计滑动窗口内的请求时间戳。"""

    def __init__(self, window_seconds: int = 60) -> None:
        self._window = window_seconds
        self._events: deque[float] = deque()
        self._lock = threading.Lock()

    def record(self) -> None:
        """在当前时刻记录一次请求。"""
        now = time.monotonic()
        with self._lock:
            self._events.append(now)
            self._prune(now)

    def get(self) -> float:
        """返回窗口内的平均 QPS（或当前速率）。"""
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
