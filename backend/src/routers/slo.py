"""SLO API——定义 CRUD + 实时预算快照。

定义持久化可配置的 SLO 目标；预算通过 ``monitoring.slo.SLOService``
从 run 实时计算（单一事实来源，无冗余预聚合表）。
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from monitoring.schemas import SLOSnapshot
from monitoring.slo import get_slo_service

from auth import CurrentUser, require_role
from core.error_codes import ErrorCode, error_response
from core.infra.logging_config import get_logger
from repository import slo_repo

logger = get_logger(__name__)
router = APIRouter(tags=["slo"])


def _to_snake(req: dict[str, Any]) -> dict[str, Any]:
    """将客户端 camelCase 载荷键规范化为 snake_case 以供仓库使用。"""
    mapping = {
        "metricType": "metric_type",
        "targetPercent": "target_percent",
        "windowDays": "window_days",
        "teamId": "team_id",
        "createdBy": "created_by",
    }
    result: dict[str, Any] = {}
    for key, value in req.items():
        result[mapping.get(key, key)] = value
    return result


def _def_out(obj: Any) -> dict[str, Any]:
    return {
        "id": obj.id,
        "name": obj.name,
        "metricType": obj.metric_type,
        "targetPercent": obj.target_percent,
        "windowDays": obj.window_days,
        "teamId": obj.team_id,
        "enabled": obj.enabled,
        "createdBy": obj.created_by,
        "createdAt": obj.created_at,
        "updatedAt": obj.updated_at,
    }


@router.get("/api/slo/definitions")
async def list_definitions(request: Request, enabled: bool | None = None) -> list[dict[str, Any]]:
    """列出 SLO 定义。"""
    try:
        rows = await slo_repo.list_definitions(enabled=enabled)
        return [_def_out(r) for r in rows]
    except Exception as e:
        logger.error("Error listing SLO definitions: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.post("/api/slo/definitions", status_code=201)
async def create_definition(
    req: dict[str, Any],
    request: Request,
    current_user: CurrentUser = Depends(require_role("admin")),  # noqa: B008
) -> dict[str, Any]:
    """创建 SLO 定义（仅管理员）。"""
    try:
        _validate(req)
        obj = await slo_repo.create_definition(_to_snake(req), current_user.id)
        return _def_out(obj)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating SLO definition: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.put("/api/slo/definitions/{sli_id}")
async def update_definition(
    sli_id: str,
    req: dict[str, Any],
    request: Request,
    current_user: CurrentUser = Depends(require_role("admin")),  # noqa: B008
) -> dict[str, Any]:
    """更新 SLO 定义（仅管理员）。"""
    try:
        if "target_percent" in req or "targetPercent" in req:
            _validate_target(req.get("target_percent", req.get("targetPercent")))
        obj = await slo_repo.update_definition(sli_id, _to_snake(req))
        if obj is None:
            raise error_response(ErrorCode.SLO_NOT_FOUND, detail="SLO 不存在")
        return _def_out(obj)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating SLO definition %s: %s", sli_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.delete("/api/slo/definitions/{sli_id}", status_code=204)
async def delete_definition(
    sli_id: str,
    request: Request,
    current_user: CurrentUser = Depends(require_role("admin")),  # noqa: B008
) -> None:
    """删除 SLO 定义（仅管理员）。"""
    try:
        deleted = await slo_repo.delete_definition(sli_id)
        if not deleted:
            raise error_response(ErrorCode.SLO_NOT_FOUND, detail="SLO 不存在")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting SLO definition %s: %s", sli_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.get("/api/slo/budget", response_model=SLOSnapshot)
async def get_budget(
    request: Request,
    target_percent: float = 99.0,
    window_seconds: int = 30 * 86400,
    team_id: str | None = None,
) -> SLOSnapshot:
    """为给定目标/窗口计算 SLO 预算快照。"""
    try:
        result = await get_slo_service().calculate(
            target_percent=target_percent,
            window_seconds=window_seconds,
            team_id=team_id,
        )
        return SLOSnapshot(**result)
    except Exception as e:
        logger.error("Error computing SLO budget: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


def _validate(req: dict[str, Any]) -> None:
    if not req.get("name"):
        raise error_response(ErrorCode.INVALID_REQUEST, detail="name 必填")
    target = req.get("target_percent", req.get("targetPercent"))
    _validate_target(target)


def _validate_target(target: Any) -> None:
    try:
        value = float(target)
    except (TypeError, ValueError):
        value = -1.0
    if not (0 < value < 100):
        raise error_response(
            ErrorCode.INVALID_REQUEST, detail="target_percent 必须在 0-100 之间"
        )
