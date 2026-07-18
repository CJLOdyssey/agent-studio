"""MCP server repository — CRUD for :class:`MCPServerDB`."""

from typing import Any

from sqlalchemy import desc

from virtual_team.core.infra.database import MCPServerDB
from virtual_team.repository.base import BaseRepository


class MCPRepository(BaseRepository[MCPServerDB]):
    model = MCPServerDB
    default_order = desc(MCPServerDB.updated_at)

    @staticmethod
    def to_dict(obj: Any) -> dict[str, Any]:
        """Serialize an MCPServerDB row to a JSON-safe dict."""
        return {
            "id": obj.id,
            "name": obj.name,
            "type": obj.type,
            "endpoint": obj.endpoint,
            "config": obj.config,
            "status": obj.status,
            "created_at": obj.created_at.isoformat() if obj.created_at else None,
        }


# module-level aliases
get_mcps = MCPRepository.get_all
get_mcps_as_dicts = MCPRepository.get_all_as_dicts
create_mcp = MCPRepository.create_one
update_mcp = MCPRepository.update_one
delete_mcp = MCPRepository.delete_one
