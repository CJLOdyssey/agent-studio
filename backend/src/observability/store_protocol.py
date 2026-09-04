"""事件存储抽象契约 —— 依赖倒置边界。

``EventStore``（SQLite）与 ``PgEventStore``（PostgreSQL）均结构化满足本协议，
调用方（router/analyzer/handler）只依赖本协议，而非具体后端，使后端可随时替换。
"""

from typing import Any, Protocol

from observability.schema import Event


class EventStoreProtocol(Protocol):
    """可观测性事件存储的统一读写契约。"""

    def write(self, event: Event) -> None:
        """将事件入队以进行后台持久化。"""
        ...

    def self_check(self) -> dict[str, Any]:
        """返回内部健康指标。"""
        ...

    def by_trace(self, trace_id: str, limit: int = 200) -> list[dict[str, Any]]:
        """返回给定 trace ID 的所有事件。"""
        ...

    def recent_errors(self, seconds: int = 300, limit: int = 50) -> list[dict[str, Any]]:
        """返回 error_type 非空的最近事件。"""
        ...

    def slow_events(self, min_ms: float = 1000, seconds: int = 3600, limit: int = 50) -> list[dict[str, Any]]:
        """返回超过最小时长阈值的事件。"""
        ...

    def search(self, query: str, limit: int = 50) -> list[dict[str, Any]]:
        """跨字段全文搜索。"""
        ...

    def recent(self, seconds: int = 300, limit: int = 50) -> list[dict[str, Any]]:
        """返回时间窗口内的最新事件。"""
        ...

    def count(self) -> int:
        """返回已存储事件的总数。"""
        ...

    def stats(self, seconds: int = 300) -> dict[str, Any]:
        """返回时间窗口内各级别事件计数与错误总数。"""
        ...

    def error_trace_ids(self, seconds: int = 300, limit: int = 20) -> list[dict[str, Any]]:
        """返回时间窗口内有错误的去重 trace ID。"""
        ...

    def cleanup(self, retention_days: int = 30) -> int:
        """删除早于保留期的事件并返回行数。"""
        ...

    def close(self) -> None:
        """将存储标记为已关闭，拒绝后续写入。"""
        ...
