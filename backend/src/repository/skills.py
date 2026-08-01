"""Skills repository — CRUD for :class:`RegisteredSkillDB`."""

from typing import Any

from sqlalchemy import desc

from core.infra.database import RegisteredSkillDB
from repository.base import BaseRepository


class SkillRepository(BaseRepository[RegisteredSkillDB]):
    model = RegisteredSkillDB
    default_order = desc(RegisteredSkillDB.updated_at)

    @staticmethod
    def to_dict(obj: Any) -> dict[str, Any]:
        """Serialize a RegisteredSkillDB row to a JSON-safe dict."""
        return {
            "id": obj.id,
            "name": obj.name,
            "category": obj.category,
            "description": obj.content,
            "version": obj.version,
            "status": obj.status,
            "author": obj.author,
            "instructions": obj.instructions,
            "script_files": obj.script_files or {},
            "tool_names": obj.tool_names or [],
            "mcp_names": obj.mcp_names or [],
            "output_constraint": obj.output_constraint,
            "created_at": obj.created_at.isoformat() if obj.created_at else None,
        }


# module-level aliases
get_skills = SkillRepository.get_all
get_skills_as_dicts = SkillRepository.get_all_as_dicts
create_skill = SkillRepository.create_one
update_skill = SkillRepository.update_one
delete_skill = SkillRepository.delete_one
