"""Core —— 共享基础设施、配置、模型与错误处理。

公共符号在下方显式导入，调用方可任选其一：
    from core import XXX
    from core.xxx import XXX
"""

from ._interfaces import StreamResponseHandler, ToolDescriptor, ToolExecutor
from .base import Base
from .config import TeamConfig, load_config
from .error_codes import ErrorCode, error_response
from .infra.events import EventBus, Events
from .infra.key_vault import (
    decrypt_api_key,
    encrypt_api_key,
)
from .infra.logging_config import get_logger
from .infra.metrics import metrics_endpoint
from .infra.request_logger import RequestLogMiddleware

__all__ = [
    "Base",
    "ErrorCode",
    "EventBus",
    "Events",
    "RequestLogMiddleware",
    "StreamResponseHandler",
    "TeamConfig",
    "ToolDescriptor",
    "ToolExecutor",
    "decrypt_api_key",
    "encrypt_api_key",
    "error_response",
    "get_logger",
    "load_config",
    "metrics_endpoint",
]
