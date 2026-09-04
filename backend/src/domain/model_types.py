"""模型类型推断 —— 按名称启发式分类模型 ID。

无 repository/router 依赖的纯函数，由模型路由与密钥连通性分类共享。
"""

EMBEDDING_PREFIXES = ("text-embedding", "embedding", "bge-", "m3e-", "jina-embeddings")
RERANK_PREFIXES = ("rerank", "bge-reranker")


def infer_model_type(model: str, provider: str) -> str:
    m = model.lower()
    # 在 basename（"BAAI/" 这类组织/命名空间前缀之后的部分）上匹配，
    # 因为真实模型 ID 带前缀（如 "BAAI/bge-m3"），否则会破坏 startswith 判断。
    # 子串检查（"embed"、"asr"）保留在全名上，避免过度匹配厂商名。
    base = m.rsplit("/", 1)[-1]
    if base.startswith(EMBEDDING_PREFIXES) or "embed" in m:
        return "embedding"
    if base.startswith(RERANK_PREFIXES) or "rerank" in m:
        return "rerank"
    if base.startswith(("whisper", "paraformer", "sherpa")) or "asr" in m:
        return "speech2text"
    if base.startswith(("tts", "edge-tts")) or "voice" in m:
        return "tts"
    if "moderation" in m:
        return "moderation"
    if provider in ("tavily", "stability"):
        return "tool"
    return "llm"
