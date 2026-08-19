"""Core — shared infrastructure, config, models, and error handling.

Public symbols are explicitly imported below so callers can use either:
    from core import XXX
    from core.xxx import XXX
"""

# log_audit / seed_default_roles_and_admin are resolved lazily via __getattr__
# (PEP 562) and therefore absent from the module dict — suppress the false
# "in __all__ but not present" warning (see _LAZY_MODULES below).
# pyright: reportUnsupportedDunderAll=false

from typing import Any

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

# log_audit / seed_default_roles_and_admin are resolved lazily via __getattr__
# (PEP 562): both modules transitively import `orm`, and an eager import here
# would put `orm` on the import path of EVERY `import core.*` — creating a
# cycle (orm → core.base → core → orm) that fails for callers who import orm
# directly. The public `from core import log_audit` API is preserved.

_LAZY_MODULES = {"log_audit": "audit", "seed_default_roles_and_admin": "seed"}


def __getattr__(name: str) -> Any:
    if name in _LAZY_MODULES:
        import importlib

        module = importlib.import_module(f".{_LAZY_MODULES[name]}", __name__)
        attr = getattr(module, name)
        globals()[name] = attr
        return attr
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


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
    "log_audit",
    "metrics_endpoint",
    "seed_default_roles_and_admin",
]
