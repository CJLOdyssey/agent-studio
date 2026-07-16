"""Tools repository — CRUD for :class:`RegisteredToolDB`."""

from sqlalchemy import desc

from virtual_team.database import RegisteredToolDB
from virtual_team.repository.base import BaseRepository


class ToolRepository(BaseRepository):
    model = RegisteredToolDB
    default_order = desc(RegisteredToolDB.updated_at)

    @staticmethod
    def to_dict(obj) -> dict:
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
            "created_at": obj.created_at.isoformat() if obj.created_at else None,
        }


# module-level aliases — preserve existing ``from repository import *`` API
get_tools = ToolRepository.get_all     # await get_tools()
get_tool = ToolRepository.get_one      # await get_tool(id)
create_tool = ToolRepository.create_one
update_tool = ToolRepository.update_one
delete_tool = ToolRepository.delete_one
