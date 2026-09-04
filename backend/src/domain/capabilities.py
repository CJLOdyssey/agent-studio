"""密钥能力枚举 —— 8 类体系的唯一事实来源。

对齐 Dify ModelType（llm/text-embedding/rerank/speech2text/tts/moderation），
外加 Tool（Dify 插件类别）与独立的 Image 类别（图像生成提供商与工具提供商分开跟踪）。
"""

CAPABILITIES: tuple[str, ...] = (
    "llm",
    "embedding",
    "rerank",
    "speech2text",
    "tts",
    "moderation",
    "image",
    "tool",
)

VALID = frozenset(CAPABILITIES)

# 旧版单值 usage_type → capabilities 映射（仅迁移用）。
USAGE_TYPE_TO_CAPABILITIES: dict[str, list[str]] = {
    "chat": ["llm"],
    "vector": ["embedding"],
    "general": ["llm", "embedding"],
    "image": ["image"],
    "tool": ["tool"],
    "audio": [],
}


def validate_capabilities(caps: list[str]) -> str | None:
    """对未知能力返回错误消息，否则返回 None。"""
    for c in caps:
        if c not in VALID:
            return f"未知能力: {c}"
    return None
