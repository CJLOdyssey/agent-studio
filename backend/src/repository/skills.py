"""技能仓库——针对 :class:`RegisteredSkillDB` 的 CRUD。"""

from typing import Any

from sqlalchemy import desc

from orm import RegisteredSkillDB
from repository.base import BaseRepository


class SkillRepository(BaseRepository[RegisteredSkillDB]):
    model = RegisteredSkillDB
    default_order = desc(RegisteredSkillDB.updated_at)

    @staticmethod
    def to_dict(obj: Any) -> dict[str, Any]:
        """将 RegisteredSkillDB 行序列化为 JSON 安全字典。"""
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


# 模块级别名
get_skill = SkillRepository.get_one     # await get_skill(id)
get_skills = SkillRepository.get_all
get_skills_as_dicts = SkillRepository.get_all_as_dicts
create_skill = SkillRepository.create_one
update_skill = SkillRepository.update_one
delete_skill = SkillRepository.delete_one
