"""共享工具库 - 多个 Agent 共用的工具函数."""

import json
import os
from typing import Any


def ensure_dir(path: str) -> None:
    """Create directory if it doesn't exist."""
    os.makedirs(path, exist_ok=True)


def read_json(file_path: str) -> dict[str, Any]:
    """Read and parse a JSON file."""
    with open(file_path, encoding="utf-8") as f:
        return json.load(f)


def write_json(file_path: str, data: dict[str, Any]) -> None:
    """Write a dict to a JSON file with indentation."""
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def safe_filename(name: str) -> str:
    """Sanitize a string into a safe filename."""
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in name).strip("_")
