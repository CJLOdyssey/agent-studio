"""API 密钥连通性测试——针对服务商端点验证有效密钥。"""

import asyncio
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from domain.model_types import infer_model_type
from repository.keys_crud import get_api_key_for_use

# SiliconFlow /models 的 sub_type 过滤值（官方 OpenAPI）→ 模型类型。
_SUB_TYPE_TO_MODEL_TYPE: dict[str, str] = {
    "chat": "llm",
    "embedding": "embedding",
    "reranker": "rerank",
    "text-to-image": "image",
    "image-to-image": "image",
    "text-to-video": "image",
    "speech-to-text": "speech2text",
}

# 音频模型不带 sub_type；按名称启发式分类。先检查 ASR，
# 因为例如 "SenseVoice" 也会匹配 TTS 的 "voice" 标记。
_ASR_NAME_MARKERS = ("asr", "whisper", "paraformer", "sherpa", "sensevoice")
_TTS_NAME_MARKERS = ("tts", "voice", "speech", "cosyvoice", "edge-tts", "moss")

_FETCH_TIMEOUT = 8


async def test_api_key_connection(key_id: str, user_id: str) -> dict[str, Any]:
    """测试已存储密钥的连通性。不返回密钥本身。

    在线程池中运行阻塞的 HTTP 调用，以避免阻塞事件循环。
    """
    key_cfg = await get_api_key_for_use(key_id, user_id)
    if not key_cfg:
        return {"success": False, "message": "Key not found or inactive"}

    return await asyncio.to_thread(_test_connection_sync, key_cfg)


def _test_connection_sync(key_cfg: dict[str, Any]) -> dict[str, Any]:
    """在线程池中通过 HTTP 同步测试 API 密钥连通性。"""
    endpoints = {
        "openai": "https://api.openai.com/v1/models",
        "deepseek": "https://api.deepseek.com/v1/models",
        "anthropic": "https://api.anthropic.com/v1/models",
    }

    base_url = (key_cfg.get("base_url") or "").rstrip("/")

    if base_url:
        if base_url.endswith("/v1"):
            test_url = base_url + "/models"
        elif base_url.endswith("/v1/"):
            test_url = base_url[:-1] + "/models"
        else:
            test_url = base_url + "/v1/models"
    else:
        test_url = endpoints.get(key_cfg["provider"], "")

    if not test_url:
        return {"success": False, "message": "No base URL configured", "models": [], "types": {}}

    success, models, types, message = _classify_models(
        test_url, key_cfg["api_key"], key_cfg["provider"]
    )
    return {"success": success, "message": message, "models": models, "types": types}


def _parse_models_from_response(resp: Any, provider: str) -> list[str]:
    """从服务商的 /models 响应中提取模型 ID。"""
    try:
        body = json.loads(resp.read().decode())
        data = body.get("data", [])
        models = []
        for item in data:
            model_id = item.get("id", "")
            if model_id:
                models.append(model_id)
        return models
    except Exception:
        return []


def _is_siliconflow(provider: str, base_url: str) -> bool:
    """当服务商为 SiliconFlow（名称或 base URL）时返回 True。"""
    provider_l = (provider or "").lower()
    base_l = (base_url or "").lower()
    return "硅基流动" in provider or "siliconflow" in provider_l or "siliconflow" in base_l


def _fetch_models_for_url(url: str, api_key: str) -> list[str]:
    """带 Bearer 认证 GET 一个 /models 风格端点。HTTP 错误时抛出。"""
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")

    with urllib.request.urlopen(req, timeout=_FETCH_TIMEOUT) as resp:  # nosec B310
        if resp.status != 200:
            raise ConnectionError(f"HTTP {resp.status}")
        return _parse_models_from_response(resp, "siliconflow")


def _infer_audio_type(model_id: str) -> str:
    """对缺少 sub_type 的音频模型的启发式类型：tts 或 speech2text。"""
    m = model_id.lower()
    if any(marker in m for marker in _ASR_NAME_MARKERS):
        return "speech2text"
    if any(marker in m for marker in _TTS_NAME_MARKERS):
        return "tts"
    return ""


def _classify_models(
    base_url: str, api_key: str, provider: str
) -> tuple[bool, list[str], dict[str, str], str]:
    """在单个 HTTP 阶段获取模型并将每个映射到模型类型。

    SiliconFlow：每个 sub_type 过滤一次请求，外加一次 type=audio 请求，
    并发获取。任何获取失败时，降级为单次全量列表请求且 types 映射为空
    （预分类行为）；若降级请求也失败，则报告失败并附底层消息。
    其他服务商：单次全量列表请求，types 始终为空。
    返回 (success, models, {model_id: type}, message)。
    """

    def fetch_full() -> tuple[bool, list[str], dict[str, str], str]:
        try:
            models = _fetch_models_for_url(base_url, api_key)
            types = {m: infer_model_type(m, provider) for m in models}
            return True, models, types, "Connection successful"
        except Exception as e:
            return False, [], {}, str(e)

    if not _is_siliconflow(provider, base_url):
        return fetch_full()

    queries = {sub: f"{base_url}?sub_type={sub}" for sub in _SUB_TYPE_TO_MODEL_TYPE}
    queries["audio"] = f"{base_url}?type=audio"

    buckets: dict[str, list[str]] = {}
    try:
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = {
                pool.submit(_fetch_models_for_url, url, api_key): key
                for key, url in queries.items()
            }
            buckets = {key: fut.result() for fut, key in futures.items()}
    except Exception:
        buckets = {}

    if not buckets:
        return fetch_full()

    models: list[str] = []
    types: dict[str, str] = {}
    seen: set[str] = set()
    for key, model_ids in buckets.items():
        model_type = "" if key == "audio" else _SUB_TYPE_TO_MODEL_TYPE[key]
        for model_id in model_ids:
            if model_id in seen:
                continue
            seen.add(model_id)
            models.append(model_id)
            if key == "audio":
                audio_type = _infer_audio_type(model_id)
                if audio_type:
                    types[model_id] = audio_type
            else:
                types[model_id] = model_type
    return True, models, types, "Connection successful"
