from typing import Any

"""捕获日志系统无法触及的启动前崩溃。

写入简单文件而非 EventStore，因为 EventStore 依赖应用存活才能初始化。
"""

import contextlib
import os
import tempfile
import time
from pathlib import Path

_MARKER_DIR = Path(tempfile.gettempdir()) / "agentstudio"
_MARKER_FILE = _MARKER_DIR / "startup.marker"
_CRASH_LOG = _MARKER_DIR / "startup_crash.log"


def mark_starting() -> None:
    """在应用开始初始化前写入标记。"""
    _MARKER_DIR.mkdir(parents=True, exist_ok=True)
    _MARKER_FILE.write_text(f"starting pid={os.getpid()} at={time.time()}\n")
    _clean_crash_log()


def mark_started() -> None:
    """应用完全初始化后更新标记。"""
    _MARKER_FILE.write_text(f"started pid={os.getpid()} at={time.time()}\n")


def mark_stopped() -> None:
    """关闭时移除启动标记文件。"""
    with contextlib.suppress(Exception):
        _MARKER_FILE.unlink(missing_ok=True)


def record_crash(exc: BaseException) -> None:
    """写入能在进程退出后留存下来的崩溃记录。"""
    import traceback
    _MARKER_DIR.mkdir(parents=True, exist_ok=True)
    tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    _CRASH_LOG.write_text(
        f"crash at={time.time()} pid={os.getpid()}\n{tb}\n"
    )


def _clean_crash_log() -> None:
    with contextlib.suppress(Exception):
        _CRASH_LOG.unlink(missing_ok=True)


def health() -> dict[str, Any]:
    """报告启动状态——即使应用未完成启动也可调用。"""
    marker_ok = _MARKER_FILE.exists()
    crashed = _CRASH_LOG.exists()
    result: dict[str, Any] = {
        "marker_exists": marker_ok,
        "crashed": crashed,
    }
    if marker_ok:
        content = _MARKER_FILE.read_text().strip()
        parts = content.split()
        result["status"] = parts[0] if parts else "unknown"
        for part in parts[1:]:
            if "=" in part:
                k, v = part.split("=", 1)
                result[k] = v
    if crashed:
        result["crash_log"] = _CRASH_LOG.read_text()[:1000]
    return result
