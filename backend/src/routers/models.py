"""可用模型 API 路由。

返回用户可在前端选择的模型列表。
模型从 user_api_keys 表读取——每个激活密钥将其配置的模型贡献到可用列表。
"""

from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel

from auth import get_user_id
from core.infra.logging_config import get_logger
from domain.model_types import infer_model_type
from repository import get_api_keys
from routers.providers import PROVIDERS

logger = get_logger(__name__)
router = APIRouter(tags=["models"])


class ModelInfo(BaseModel):
    id: str
    label: str
    provider: str
    type: str = "llm"


async def _get_models_from_keys(user_id: str) -> list[ModelInfo]:
    """从数据库中用户的激活 API 密钥构建模型列表。"""
    try:
        keys = await get_api_keys(user_id)
    except Exception as e:
        logger.warning("Failed to load keys for model list: %s", e)
        return []

    seen: set[str] = set()
    models: list[ModelInfo] = []

    for k in keys:
        if not k.get("is_active"):
            continue
        provider = k.get("provider", "custom")
        provider_label = (
            PROVIDERS.get(provider, {}).get("name") or provider.title()
        )
        types_map = k.get("model_types") or {}
        for model_id in k.get("models", []):
            if model_id in seen:
                continue
            seen.add(model_id)
            models.append(
                ModelInfo(
                    id=model_id,
                    label=model_id,
                    provider=provider_label,
                    type=types_map.get(model_id) or infer_model_type(model_id, provider),
                )
            )

    return models


@router.get("/api/models", response_model=list[ModelInfo])
async def list_models(request: Request) -> Any:
    """返回来自用户激活 API 密钥的可用模型。"""
    user_id = get_user_id(request)
    return await _get_models_from_keys(user_id)
