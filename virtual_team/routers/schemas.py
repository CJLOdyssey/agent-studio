"""Output schema management endpoints for Agent Config."""
import json
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from virtual_team.repository.schemas import (
    create_output_schema,
    delete_output_schema,
    get_output_schemas,
    update_output_schema,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class SchemaCreateRequest(BaseModel):
    name: str
    format_type: str
    schema_def: dict
    example: str | None = None


class SchemaUpdateRequest(BaseModel):
    name: str | None = None
    format_type: str | None = None
    schema_def: dict | None = None
    example: str | None = None


@router.post("/api/agents/{agent_id}/schemas", status_code=201)
async def create_agent_schema(agent_id: str, req: SchemaCreateRequest):
    try:
        schema = await create_output_schema(
            agent_id=agent_id,
            name=req.name,
            format_type=req.format_type,
            schema_def=json.dumps(req.schema_def),
            example=req.example,
        )
        return {"id": schema.id, "name": schema.name, "status": "created"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating output schema: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/agents/{agent_id}/schemas")
async def list_agent_schemas(agent_id: str):
    try:
        schemas = await get_output_schemas(agent_id)
        return [
            {
                "id": s.id,
                "name": s.name,
                "format_type": s.format_type,
                "schema_def": json.loads(s.schema_def),
                "example": s.example,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in schemas
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error listing schemas: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/agents/{agent_id}/schemas/{schema_id}")
async def update_agent_schema(agent_id: str, schema_id: str, req: SchemaUpdateRequest):
    try:
        updated = await update_output_schema(
            schema_id=schema_id,
            name=req.name,
            format_type=req.format_type,
            schema_def=json.dumps(req.schema_def) if req.schema_def is not None else None,
            example=req.example,
        )
        if not updated:
            raise HTTPException(status_code=404, detail="未找到该输出格式")
        return {"id": updated.id, "status": "updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating output schema: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/agents/{agent_id}/schemas/{schema_id}")
async def delete_agent_schema(agent_id: str, schema_id: str):
    try:
        deleted = await delete_output_schema(schema_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="未找到该输出格式")
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting output schema: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── Schema generation from natural language ──────────────────────────


class SchemaGenerateRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=500, description="自然语言描述")
    format_type: str = Field(default="json", description="输出格式类型")


class GeneratedSchema(BaseModel):
    id: str
    name: str
    description: str
    format_type: str
    schema_def: dict
    example: str | None = None


@router.post("/api/schemas/generate", response_model=GeneratedSchema)
async def generate_schema(req: SchemaGenerateRequest):
    try:
        from virtual_team.generation import registry
        from virtual_team.generation.generators.base import GenerateRequest as GenReq

        generator = registry.get("schema")
        if not generator:
            raise HTTPException(status_code=500, detail="Schema generator not available")

        result = generator.generate(GenReq(description=req.description, context={"format_type": req.format_type}))
        return GeneratedSchema(
            id=result.id,
            name=result.name,
            description=result.description,
            format_type=req.format_type,
            schema_def=result.metadata.get("schema_def", {}),
            example=result.metadata.get("example", ""),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Schema generation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"输出格式生成失败: {e}")
