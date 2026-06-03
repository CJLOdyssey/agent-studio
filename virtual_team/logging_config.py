import json
import logging
import os
import sys
from typing import Optional


def get_logger(name: str, level: Optional[int] = None) -> logging.Logger:
    """Get a logger with consistent formatting for the virtual_team package.

    Usage:
        logger = get_logger(__name__)
        logger.info("...")
        logger.error("...", exc_info=True)

    Log format is controlled by the LOG_FORMAT environment variable:
      - "json"  → structured JSON lines (for log aggregators like Loki/ELK)
      - default → human-readable plaintext with timestamps
    """
    logger = logging.getLogger(name)

    if logger.handlers:
        return logger

    log_format = os.environ.get("LOG_FORMAT", "text").lower()
    if log_format == "json":
        handler = _json_handler()
    else:
        handler = _text_handler()

    if level is not None:
        logger.setLevel(level)
    else:
        logger.setLevel(logging.DEBUG if _is_debug() else logging.INFO)

    logger.addHandler(handler)
    logger.propagate = False
    return logger


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps(
            {
                "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
                "module": record.module,
                "line": record.lineno,
            },
            ensure_ascii=False,
        )


def _text_handler() -> logging.Handler:
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
