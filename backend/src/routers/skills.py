"""Skill CRUD API routes."""

from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.audit import log_audit
from core.error_codes import ErrorCode, error_response
from core.infra.logging_config import get_logger
from repository import create_skill as repo_create_skill
from repository import delete_skill, update_skill
from repository import get_skills as repo_get_skills
from repository import get_skills_as_dicts as repo_get_skills_as_dicts

logger = get_logger(__name__)
router = APIRouter(tags=["skills"])


class SkillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    category: str = Field(..., min_length=1, max_length=32)
    description: str = ""
    instructions: str = ""
    tool_names: list[str] = []
    output_constraint: str = ""
    version: str = "v1.0.0"
    author: str = ""
    status: str = "active"


class SkillUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    instructions: str | None = None
    tool_names: list[str] | None = None
    output_constraint: str | None = None
    version: str | None = None
    author: str | None = None
    status: str | None = None


class SkillImportRequest(BaseModel):
    markdown: str = Field(..., min_length=1, max_length=200000)
    category: str = Field(default="导入", min_length=1, max_length=32)


@router.get("/api/skills")
async def list_skills() -> Any:
    """List all skill configurations."""
    try:
        return await repo_get_skills_as_dicts()
    except Exception as e:
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.get("/api/skills/{skill_id}")
async def get_skill(skill_id: str) -> Any:
    """Get a single skill by ID."""
    try:
        skills = await repo_get_skills()
        s = next((sk for sk in skills if sk.id == skill_id), None)
        if not s:
            raise error_response(ErrorCode.SKILL_NOT_FOUND, detail="Skill not found")
        return {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "content": s.content,
            "author": s.author,
            "version": s.version,
            "status": s.status,
            "instructions": s.instructions,
            "tool_names": s.tool_names,
            "output_constraint": s.output_constraint,
            "created_at": str(s.created_at) if s.created_at else None,
            "updated_at": str(s.updated_at) if s.updated_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


async def _snapshot_skill(resource_id: str, session: AsyncSession | None = None) -> Any:
    """Create a version snapshot after skill save."""
    try:
        from repository.snapshot_helper import build_table_snapshot, with_session
        from repository.versions import create_version as _cv

        async def _save(s: Any, rt: str, rid: str, **kw: Any) -> None:
            from repository.skills import get_skills as _gskills
            all_items = await _gskills()
            item = next((sk for sk in all_items if sk.id == rid), None)
            if not item:
                return
            snapshot = build_table_snapshot(item)
            await _cv(s, rt, rid, snapshot, "system")

        await with_session(
            _save,
            resource_type="skill",
            resource_id=resource_id,
            session=session,
        )
    except Exception:
        logger.warning("Version snapshot failed for skill %s", resource_id, exc_info=True)


@router.post("/api/skills", status_code=201)
async def add_skill(req: SkillCreate) -> Any:
    """Create a new skill."""
    try:
        data = req.model_dump()
        data["content"] = data.pop("description", "")
        s = await repo_create_skill(data)
        await log_audit("create", "skill", s.name, "创建成功")
        return {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "status": s.status,
            "tool_names": s.tool_names,
            "output_constraint": s.output_constraint,
            "instructions": s.instructions,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
    except Exception as e:
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.post("/api/skills/import")
async def import_skill(
    files: list[UploadFile] = File(...), category: str = Form("导入")
) -> Any:
    """Import a skill from Anthropic Agent Skills SKILL.md directory (multipart).

    Files are keyed by relative path: ``SKILL.md`` (required), ``scripts/*``,
    ``references/*``, ``resources/*`` (optional). ``SKILL.md`` 的 frontmatter 与
    正文解析逻辑沿用原实现；其余文件内容存入 ``script_files``。
    """
    try:
        import yaml
        contents: dict[str, str] = {}
        for f in files:
            raw = await f.read()
            contents[f.filename or "unnamed"] = raw.decode("utf-8", errors="replace")

        markdown = contents.pop("SKILL.md", "") or contents.pop("skill.md", "")
        if not markdown:
            raise error_response(ErrorCode.INVALID_REQUEST, detail="缺少 SKILL.md 文件")

        meta: dict[str, Any] = {}
        body = markdown
        if markdown.startswith("---"):
            end = markdown.find("\n---", 3)
            if end != -1:
                raw_meta = markdown[3:end].strip()
                body = markdown[end + 4:].lstrip("\n")
                try:
                    parsed = yaml.safe_load(raw_meta)
                    if isinstance(parsed, dict):
                        meta = parsed
                except Exception:
                    meta = {}

        name = str(meta.get("name") or "").strip()
        if not name:
            # Fall back to the first markdown heading if frontmatter lacks name
            import re

            m = re.match(r"^#\s+(.+)", body)
            name = m.group(1).strip() if m else "imported-skill"
        name = name[:64]

        description = str(meta.get("description") or "").strip()[:500]
        category = str(meta.get("metadata", {}).get("category") or category)[:32]
        author = str(meta.get("metadata", {}).get("author") or "")[:64]
        license_text = str(meta.get("license") or "").strip()

        tools = meta.get("allowed-tools") or meta.get("allowed_tools") or []
        if not isinstance(tools, list):
            tools = []
        tool_names = [str(x) for x in tools if x]

        instructions = body.strip()
        if not instructions:
            raise error_response(
                ErrorCode.INVALID_REQUEST, detail="SKILL.md 缺少正文，无法导入"
            )
        if license_text:
            instructions += f"\n\n## License\n{license_text}"

        data = {
            "name": name,
            "category": category,
            "content": description,
            "instructions": instructions,
            "tool_names": tool_names,
            "version": "v1.0.0",
            "author": author,
            "status": "active",
            "output_constraint": "",
            "script_files": contents,
        }
        s = await repo_create_skill(data)
        await log_audit("create", "skill", s.name, "导入成功")
        return {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "status": s.status,
            "instructions": s.instructions,
            "tool_names": s.tool_names,
            "script_files": s.script_files,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Skill import failed: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=f"导入失败: {e}") from e


@router.post("/api/skills/import-text", status_code=201)
async def import_skill_text(req: SkillImportRequest) -> Any:
    """Import a skill from Anthropic Agent Skills SKILL.md format (text compat).

    Backward-compatible alias of the old ``/api/skills/import``: parses the
    YAML frontmatter (``name``, ``description``, ``allowed-tools``,
    ``metadata.category``) and maps the markdown body to ``instructions``.
    """
    try:
        import yaml

        markdown = req.markdown
        meta: dict[str, Any] = {}
        body = markdown
        if markdown.startswith("---"):
            end = markdown.find("\n---", 3)
            if end != -1:
                raw_meta = markdown[3:end].strip()
                body = markdown[end + 4:].lstrip("\n")
                try:
                    parsed = yaml.safe_load(raw_meta)
                    if isinstance(parsed, dict):
                        meta = parsed
                except Exception:
                    meta = {}

        name = str(meta.get("name") or "").strip()
        if not name:
            # Fall back to the first markdown heading if frontmatter lacks name
            import re

            m = re.match(r"^#\s+(.+)", body)
            name = m.group(1).strip() if m else "imported-skill"
        name = name[:64]

        description = str(meta.get("description") or "").strip()[:500]
        category = str(meta.get("metadata", {}).get("category") or req.category)[:32]
        author = str(meta.get("metadata", {}).get("author") or "")[:64]

        tools = meta.get("allowed-tools") or meta.get("allowed_tools") or []
        if not isinstance(tools, list):
            tools = []
        tool_names = [str(x) for x in tools if x]

        instructions = body.strip()
        if not instructions:
            raise error_response(
                ErrorCode.INVALID_REQUEST, detail="SKILL.md 缺少正文，无法导入"
            )

        data = {
            "name": name,
            "category": category,
            "content": description,
            "instructions": instructions,
            "tool_names": tool_names,
            "version": "v1.0.0",
            "author": author,
            "status": "active",
            "output_constraint": "",
        }
        s = await repo_create_skill(data)
        await log_audit("create", "skill", s.name, "导入成功")
        return {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "status": s.status,
            "instructions": s.instructions,
            "tool_names": s.tool_names,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Skill import failed: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=f"导入失败: {e}") from e


@router.put("/api/skills/{skill_id}")
async def edit_skill(skill_id: str, req: SkillUpdate) -> Any:
    """Update an existing skill."""
    try:
        data = req.model_dump(exclude_unset=True)
        if "description" in data:
            data["content"] = data.pop("description")
        s = await update_skill(skill_id, data)
        if not s:
            raise error_response(ErrorCode.SKILL_NOT_FOUND, detail="Skill not found")
        await log_audit("update", "skill", s.name, "更新成功")
        return {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "status": s.status,
            "tool_names": s.tool_names,
            "output_constraint": s.output_constraint,
            "instructions": s.instructions,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.delete("/api/skills/{skill_id}", status_code=204)
async def remove_skill(skill_id: str) -> None:
    """Delete a skill by ID."""
    try:
        from repository.skills import get_skills as _gskills
        all_items = await _gskills()
        target = next((s for s in all_items if s.id == skill_id), None)
        skill_name = target.name if target else skill_id
        ok = await delete_skill(skill_id)
        if not ok:
            raise error_response(ErrorCode.SKILL_NOT_FOUND, detail="Skill not found")
        await log_audit("delete", "skill", skill_name, "删除成功")
    except HTTPException:
        raise
    except Exception as e:
        raise error_response(ErrorCode.INTERNAL_ERROR) from e
