"""用于应用层解耦的轻量异步事件总线。

用法
-----
    from core.infra.events import bus, Events

    async def on_run_created(run_id: str, **kw):
        notify(run_id)

    bus.on(Events.RUN_CREATED, on_run_created)

    # 别处 …
    await bus.emit(Events.RUN_CREATED, run_id="abc-123")
"""

import asyncio
import logging
from collections import defaultdict
from collections.abc import Callable
from typing import Any

logger = logging.getLogger(__name__)

EventHandler = Callable[..., Any]


class EventBus:
    """用于解耦应用模块的简单发布/订阅事件总线。"""

    def __init__(self) -> None:
        """初始化事件总线。"""
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)

    def on(self, event: str, handler: EventHandler) -> EventHandler:
        """为事件订阅处理器。可用作装饰器。"""
        self._handlers[event].append(handler)
        return handler

    def off(self, event: str, handler: EventHandler) -> None:
        """从事件取消订阅处理器。"""
        self._handlers[event] = [h for h in self._handlers[event] if h is not handler]

    async def emit(self, event: str, **data: Any) -> None:
        """触发事件，以 ``**data`` 调用所有已注册处理器。"""
        for handler in self._handlers.get(event, []):
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(**data)
                else:
                    handler(**data)
            except Exception:
                logger.exception("Event handler %r failed for %s", handler.__name__, event)

    def clear(self) -> None:
        """移除所有处理器（测试中常用）。"""
        self._handlers.clear()


bus = EventBus()


class Events:
    """应用全局使用的规范事件名。"""

    RUN_CREATED = "run:created"
    AGENT_CONFIG_CHANGED = "agent_config:changed"
    KEY_CREATED = "key:created"
    KEY_DELETED = "key:deleted"
