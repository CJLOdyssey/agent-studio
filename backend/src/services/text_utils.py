"""共享文本解析辅助函数（无业务逻辑）。"""

import json


def parse_json_list(raw: str | None) -> list[str] | None:
    """将 JSON 数组字符串解析为列表；空或无效时返回 None。"""
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else None
    except Exception:
        return None


__all__ = ["parse_json_list"]
