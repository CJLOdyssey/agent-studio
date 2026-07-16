"""Skills repository — CRUD for :class:`RegisteredSkillDB`."""

from sqlalchemy import desc

from virtual_team.database import RegisteredSkillDB
from virtual_team.repository.base import BaseRepository


class SkillRepository(BaseRepository):
    model = RegisteredSkillDB
    default_order = desc(RegisteredSkillDB.updated_at)

    @staticmethod
    def to_dict(obj) -> dict:
        return {
            "id": obj.id,
            "name": obj.name,
            "category": obj.category,
            "description": obj.content,
            "version": obj.version,
            "status": obj.status,
            "author": obj.author,
            "instructions": obj.instructions,
            "prompt_id": obj.prompt_id,
            "tool_names": obj.tool_names or [],
            "output_constraint": obj.output_constraint,
            "created_at": obj.created_at.isoformat() if obj.created_at else None,
        }


# module-level aliases
get_skills = SkillRepository.get_all
create_skill = SkillRepository.create_one
update_skill = SkillRepository.update_one
delete_skill = SkillRepository.delete_one
