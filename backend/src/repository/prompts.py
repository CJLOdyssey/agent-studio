"""提示词仓库——针对 :class:`PromptDB` 的 CRUD。"""

from typing import Any

from sqlalchemy import desc

from core.infra.cache import get_cache
from orm import PromptDB
from repository.base import BaseRepository

CACHE_KEY_PROMPTS = "prompts:all"


class PromptRepository(BaseRepository[PromptDB]):
    model = PromptDB
    default_order = desc(PromptDB.updated_at)

    @staticmethod
    def to_dict(obj: Any) -> dict[str, Any]:
        """将 PromptDB 行序列化为 JSON 安全字典。"""
        return {
            "id": obj.id,
            "name": obj.name,
            "description": obj.description,
            "category": obj.category,
            "content": obj.content,
            "model": obj.model,
            "status": obj.status,
            "version": obj.version,
            "created_at": obj.created_at.isoformat() if obj.created_at else None,
            "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
        }


async def _invalidate_prompts_cache() -> None:
    """变更后使提示词列表缓存失效。"""
    cache = get_cache()
    await cache.delete(CACHE_KEY_PROMPTS)


async def get_cached_prompts_as_dicts() -> list[dict[str, Any]]:
    """以字典返回所有提示词，使用带 5 分钟 TTL 的 Redis 缓存。

    缓存未命中时回落到 DB；变更会使缓存失效。
    """
    cache = get_cache()
    cached = await cache.get(CACHE_KEY_PROMPTS)
    if cached is not None:
        # SAFETY: 缓存值由返回 list[dict] 的 `PromptRepository.get_all_as_dicts()` 存储
        from typing import cast
        return cast(list[dict[str, Any]], cached)

    result = await PromptRepository.get_all_as_dicts()
    await cache.set(CACHE_KEY_PROMPTS, result)
    return result


# 模块级别名（只读为直接引用，写操作为了缓存而包裹）
get_prompts = PromptRepository.get_all
get_prompts_as_dicts = PromptRepository.get_all_as_dicts
get_prompt = PromptRepository.get_one


async def create_prompt(data: dict[str, Any]) -> PromptDB:
    """创建提示词并使缓存失效。"""
    result = await PromptRepository.create_one(data)
    await _invalidate_prompts_cache()
    return result


async def update_prompt(entity_id: str, data: dict[str, Any]) -> PromptDB | None:
    """更新提示词并使缓存失效。"""
    result = await PromptRepository.update_one(entity_id, data)
    await _invalidate_prompts_cache()
    return result


async def delete_prompt(entity_id: str) -> bool:
    """删除提示词并使缓存失效。"""
    result = await PromptRepository.delete_one(entity_id)
    await _invalidate_prompts_cache()
    return result
