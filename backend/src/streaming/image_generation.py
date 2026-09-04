"""通过 OpenAI 兼容的 /images/generations 接口生成图片。

用于具备图片能力的模型（model_types == "image"，例如 SiliconFlow 的
Kwai-Kolors/Kolors）。该接口非流式，返回临时签名 URL（通常约 1 小时有效）。
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

DEFAULT_IMAGE_SIZE = "1024x1024"
REQUEST_TIMEOUT = httpx.Timeout(180.0, connect=15.0)


class ImageGenerationError(RuntimeError):
    """图片供应商拒绝或生成请求失败时抛出。"""


async def generate_image(
    api_key: str,
    prompt: str,
    *,
    model: str,
    base_url: str | None = None,
    image_size: str = DEFAULT_IMAGE_SIZE,
    batch_size: int = 1,
) -> str:
    """生成一张图片并返回其 URL。

    参数：
        api_key: 供应商 API Key（Bearer）。
        prompt: 描述图片的文本提示词。
        model: 图片模型 id（如 "Kwai-Kolors/Kolors"）。
        base_url: 供应商基础 URL；缺省为 SiliconFlow。
        image_size: 如 "1024x1024"。
        batch_size: 图片数量；仅返回第一张。

    异常：
        ImageGenerationError: 响应非 200 或返回体缺少 images 时。
    """
    base = (base_url or "https://api.siliconflow.cn/v1").rstrip("/")
    url = f"{base}/images/generations"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "image_size": image_size,
        "batch_size": batch_size,
    }

    logger.info("Image generation request | model=%s | prompt=%d chars", model, len(prompt))
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT, proxy=None) as client:
            response = await client.post(url, headers=headers, json=body)
    except httpx.HTTPError as exc:
        logger.error("Image generation transport error | url=%s", url, exc_info=True)
        raise ImageGenerationError(f"图片生成请求失败: {exc}") from exc

    if response.status_code != 200:
        detail = response.text[:500]
        logger.error("Image generation rejected | status=%d body=%s", response.status_code, detail)
        raise ImageGenerationError(f"图片生成被拒绝 (HTTP {response.status_code})")

    payload = response.json()
    images = payload.get("images") or []
    if not images:
        raise ImageGenerationError("图片生成返回为空")
    image_url = images[0].get("url")
    if not image_url:
        raise ImageGenerationError("图片生成返回缺少 URL")
    return str(image_url)
