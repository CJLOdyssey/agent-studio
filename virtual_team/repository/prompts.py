"""Prompts repository — CRUD for :class:`PromptDB`."""

from sqlalchemy import desc

from virtual_team.database import PromptDB
from virtual_team.repository.base import BaseRepository
from typing import Any



class PromptRepository(BaseRepository[PromptDB]):
    model = PromptDB
    default_order = desc(PromptDB.updated_at)

    @staticmethod
    def to_dict(obj) -> dict[str, Any]:  # type: ignore[no-untyped-def]
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
get_prompt = PromptRepository.get_one
create_prompt = PromptRepository.create_one
update_prompt = PromptRepository.update_one
delete_prompt = PromptRepository.delete_one
