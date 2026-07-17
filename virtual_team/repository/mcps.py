"""MCP server repository — CRUD for :class:`MCPServerDB`."""

from sqlalchemy import desc

from virtual_team.database import MCPServerDB
from virtual_team.repository.base import BaseRepository
from typing import Any



class MCPRepository(BaseRepository[MCPServerDB]):
    model = MCPServerDB
    default_order = desc(MCPServerDB.updated_at)

    @staticmethod
    def to_dict(obj) -> dict[str, Any]:  # type: ignore[no-untyped-def]
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
create_mcp = MCPRepository.create_one
update_mcp = MCPRepository.update_one
delete_mcp = MCPRepository.delete_one
