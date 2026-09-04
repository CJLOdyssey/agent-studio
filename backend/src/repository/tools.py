"""工具仓库——针对 :class:`RegisteredToolDB` 的 CRUD。"""

from typing import Any

from sqlalchemy import desc

from orm import RegisteredToolDB
from repository.base import BaseRepository


class ToolRepository(BaseRepository[RegisteredToolDB]):
    model = RegisteredToolDB
    default_order = desc(RegisteredToolDB.updated_at)

    @staticmethod
    def to_dict(obj: Any) -> dict[str, Any]:
        """将 RegisteredToolDB 实例序列化为 JSON 安全字典。"""
        return {
            "id": obj.id,
            "name": obj.name,
            "category": obj.category,
            "description": obj.description,
            "model": obj.model,
            "status": obj.status,
            "version": obj.version,
            "endpoint": obj.endpoint,
            "method": obj.method,
            "headers": obj.headers,
            "parameters": obj.parameters,
            "is_builtin": obj.is_builtin,
            "created_at": obj.created_at.isoformat() if obj.created_at else None,
        }


# 模块级别名——保留现有 ``from repository import *`` API
get_tools = ToolRepository.get_all     # await get_tools()
get_tools_as_dicts = ToolRepository.get_all_as_dicts
get_tool = ToolRepository.get_one      # await get_tool(id)
create_tool = ToolRepository.create_one
update_tool = ToolRepository.update_one
delete_tool = ToolRepository.delete_one


def list_tool_plugins() -> list[dict[str, Any]]:
    """从 thinking-tree 注册表列出已注册的工具插件。"""
    import thinking_tree.tools  # noqa: F401 — 副作用注册
    from thinking_tree.registry import registry

    return registry.list_plugins()
