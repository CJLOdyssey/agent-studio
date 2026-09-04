"""意图检测辅助（从 _run_agent_pipeline 提取）。

单一职责：识别用户意图（打开 URL 等），返回意图动作。"""

from __future__ import annotations

import re

from core.infra.logging_config import get_logger

logger = get_logger(__name__)

_SITE_MAP = {
    "百度": "https://www.baidu.com",
    "谷歌": "https://www.google.com",
    "google": "https://www.google.com",
    "bing": "https://www.bing.com",
    "必应": "https://www.bing.com",
    "抖音": "https://www.douyin.com",
    "github": "https://github.com",
    "知乎": "https://www.zhihu.com",
    "微博": "https://weibo.com",
}


def detect_open_url(requirement: str) -> str | None:
    """检测用户是否要求打开某个 URL。返回 URL 或 None。"""
    clean = requirement.strip().lower()
    for keyword, site_url in _SITE_MAP.items():
        if keyword in clean and ("打开" in clean or "访问" in clean or "去" in clean):
            return site_url

    m = re.search(
        r'(?:https?://)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z0-9][-a-zA-Z0-9]*)+',
        requirement.strip(),
    )
    if m and ("打开" in clean or "访问" in clean or "去" in clean):
        domain = m.group(0)
        return f"https://{domain}" if not domain.startswith("http") else domain

    return None
