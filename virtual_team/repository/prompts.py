"""Prompts repository — CRUD for :class:`PromptDB`."""

from typing import Any

from sqlalchemy import desc

from virtual_team.core.infra.database import PromptDB
from virtual_team.repository.base import BaseRepository


class PromptRepository(BaseRepository[PromptDB]):
    model = PromptDB
    default_order = desc(PromptDB.updated_at)

    @staticmethod
    def to_dict(obj: Any) -> dict[str, Any]:
        """Serialize a PromptDB row to a JSON-safe dict."""
        return {
            "id": obj.id,
            "name": obj.name,
            "category": obj.category,
            "content": obj.content,
            "model": obj.model,
            "status": obj.status,
            "version": obj.version,
            "created_at": obj.created_at.isoformat() if obj.created_at else None,
            "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
        }


# module-level aliases
get_prompts = PromptRepository.get_all
get_prompts_as_dicts = PromptRepository.get_all_as_dicts
get_prompt = PromptRepository.get_one
create_prompt = PromptRepository.create_one
update_prompt = PromptRepository.update_one
delete_prompt = PromptRepository.delete_one
