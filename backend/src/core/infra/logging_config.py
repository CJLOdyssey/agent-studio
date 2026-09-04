"""支持 JSON 格式化的集中式日志配置。"""

import json
import logging
import os
import sys


def get_logger(name: str, level: int | None = None) -> logging.Logger:
    """获取或创建带可选可观测性处理器的已配置 logger。"""
    logger = _get_logger(name, level)
    _maybe_attach_obs_handler(logger)
    return logger


def _get_logger(name: str, level: int | None = None) -> logging.Logger:
    """获取 backend 包内格式一致的 logger。

    用法：
        logger = get_logger(__name__)
        logger.info("...")
        logger.error("...", exc_info=True)

    日志格式由 LOG_FORMAT 环境变量控制：
      - "json"  → 结构化 JSON 行（用于 Loki/ELK 等日志聚合器）
      - 默认   → 带时间戳的可读纯文本
    """
    logger = logging.getLogger(name)

    if logger.handlers:
        return logger

    log_format = os.environ.get("LOG_FORMAT", "text").lower()
    handler = _json_handler() if log_format == "json" else _text_handler()

    if level is not None:
        logger.setLevel(level)
    else:
        logger.setLevel(logging.DEBUG if _is_debug() else logging.INFO)

    logger.addHandler(handler)
    logger.propagate = False
    _maybe_attach_obs_handler(logger)
    return logger


class JsonFormatter(logging.Formatter):
    """用于对接日志聚合器（Loki/ELK）的 JSON 日志格式化器。"""

    def format(self, record: logging.LogRecord) -> str:
        """将日志记录格式化为 JSON 字符串。"""
        try:
            message = record.getMessage()
        except (TypeError, ValueError):
            message = record.msg
        return json.dumps(
            {
                "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
                "level": record.levelname,
                "logger": record.name,
                "message": message,
                "module": record.module,
                "line": record.lineno,
            },
            ensure_ascii=False,
        )


def _text_handler() -> logging.Handler:
    """创建写入 stdout 的可读文本日志处理器。"""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            "[%(asctime)s] %(levelname)-5s [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )
    return handler


def _json_handler() -> logging.Handler:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    return handler


def _is_debug() -> bool:
    return os.environ.get("LOG_LEVEL", "").upper() == "DEBUG"


_OBS_ATTACHED = False


_OBS_HANDLER: logging.Handler | None = None


def _maybe_attach_obs_handler(logger: logging.Logger) -> None:
    global _OBS_HANDLER
    if os.environ.get("OBSERVABILITY_ENABLED", "1") == "0":
        return
    try:
        from observability.handler import ObservabilityHandler
        if _OBS_HANDLER is None:
            _OBS_HANDLER = ObservabilityHandler()
        if _OBS_HANDLER not in logger.handlers:
            logger.addHandler(_OBS_HANDLER)
    except Exception:
        pass
