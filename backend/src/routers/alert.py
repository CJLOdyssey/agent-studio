"""Alert management API — rules, events, notifications, and subscriptions.

Reads are available to any authenticated user; mutations require the
``admin`` role (legacy mode short-circuits to admin). Metric types are
validated against the live registry so new metric handlers are accepted
without a router change (open/closed).
"""

from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from monitoring.metrics import supported_metrics
from monitoring.schemas import (
    AlertEventOut,
    AlertRuleCreate,
    AlertRuleOut,
    AlertRuleUpdate,
    CamelModel,
    NotificationOut,
    NotificationSubscriptionIn,
)
from pydantic import BaseModel, Field

from auth import CurrentUser, require_role
from core.error_codes import ErrorCode, error_response
from core.infra.logging_config import get_logger
from repository import alert_repo

logger = get_logger(__name__)
router = APIRouter(tags=["alert"])


class Pagination(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class SubscriptionReplaceRequest(CamelModel):
    subscriptions: list[NotificationSubscriptionIn]


def _rule_out(rule: Any) -> AlertRuleOut:
    return AlertRuleOut(
        id=rule.id,
        name=rule.name,
        metric_type=rule.metric_type,
        operator=rule.operator,
        threshold=rule.threshold,
        window_seconds=rule.window_seconds,
        severity=rule.severity,
        runbook_url=rule.runbook_url,
        cooldown_seconds=rule.cooldown_seconds,
        silence_until=rule.silence_until,
        team_id=rule.team_id,
        enabled=rule.enabled,
        created_by=rule.created_by,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )


def _event_out(event: Any, rule_name: str) -> AlertEventOut:
    return AlertEventOut(
        id=event.id,
        rule_id=event.rule_id,
        rule_name=rule_name,
        metric_value=event.metric_value,
        threshold=event.threshold,
        severity=event.severity,
        status=event.status,
        message=event.message,
        triggered_at=event.triggered_at,
        resolved_at=event.resolved_at,
        acked_at=event.acked_at,
    )


def _notification_out(row: Any) -> NotificationOut:
    return NotificationOut(
        id=row.id,
        user_id=row.user_id,
        title=row.title,
        body=row.body,
        type=row.type,
        link=row.link,
        read_at=row.read_at,
        created_at=row.created_at,
    )


def _subscription_out(row: Any) -> dict[str, Any]:
    return {
        "severity": row.severity,
        "teamId": row.team_id,
        "enabled": row.enabled,
    }


def _validate_metric_type(metric_type: str | None) -> None:
    if metric_type is not None and metric_type not in supported_metrics():
        raise error_response(
            ErrorCode.INVALID_REQUEST,
            detail=f"Unsupported metric type: {metric_type}",
        )


# ── Rules ───────────────────────────────────────────────────────────────────


@router.get("/api/alerts/rules", response_model=list[AlertRuleOut])
async def list_alert_rules(
    request: Request,
    limit: int = 20,
    offset: int = 0,
    enabled: bool | None = None,
    metric_type: str | None = None,
) -> Any:
    """List alert rules, optionally filtered by enabled state or metric type."""
    try:
        _validate_metric_type(metric_type)
        rules = await alert_repo.list_rules(limit=limit, offset=offset, enabled=enabled, metric_type=metric_type)
        return [_rule_out(r) for r in rules]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error listing alert rules: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.post("/api/alerts/rules", status_code=201, response_model=AlertRuleOut)
async def create_alert_rule(
    req: AlertRuleCreate,
    request: Request,
    current_user: CurrentUser = Depends(require_role("admin")),  # noqa: B008
) -> Any:
    """Create an alert rule (admin only)."""
    try:
        _validate_metric_type(req.metric_type)
        rule = await alert_repo.create_rule(req.model_dump(exclude_none=True), current_user.id)
        return _rule_out(rule)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating alert rule: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.put("/api/alerts/rules/{rule_id}", response_model=AlertRuleOut)
async def update_alert_rule(
    rule_id: str,
    req: AlertRuleUpdate,
    request: Request,
    current_user: CurrentUser = Depends(require_role("admin")),  # noqa: B008
) -> Any:
    """Partially update an alert rule (admin only)."""
    try:
        _validate_metric_type(req.metric_type)
        rule = await alert_repo.update_rule(rule_id, req.model_dump(exclude_none=True))
        if rule is None:
            raise error_response(ErrorCode.ALERT_RULE_NOT_FOUND, detail="规则不存在")
        return _rule_out(rule)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating alert rule %s: %s", rule_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.delete("/api/alerts/rules/{rule_id}", status_code=204)
async def delete_alert_rule(
    rule_id: str,
    request: Request,
    current_user: CurrentUser = Depends(require_role("admin")),  # noqa: B008
) -> None:
    """Delete an alert rule (admin only); historical events are retained."""
    try:
        deleted = await alert_repo.delete_rule(rule_id)
        if not deleted:
            raise error_response(ErrorCode.ALERT_RULE_NOT_FOUND, detail="规则不存在")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting alert rule %s: %s", rule_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


class SilenceRequest(CamelModel):
    silence_until: datetime | None = None


@router.post("/api/alerts/rules/{rule_id}/silence", response_model=AlertRuleOut)
async def silence_alert_rule(
    rule_id: str,
    req: SilenceRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_role("admin")),  # noqa: B008
) -> Any:
    """Silence a rule until the given time (None clears the silence window)."""
    try:
        rule = await alert_repo.update_rule(rule_id, {"silence_until": req.silence_until})
        if rule is None:
            raise error_response(ErrorCode.ALERT_RULE_NOT_FOUND, detail="规则不存在")
        return _rule_out(rule)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error silencing alert rule %s: %s", rule_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


# ── Events ──────────────────────────────────────────────────────────────────


@router.get("/api/alerts/events", response_model=list[AlertEventOut])
async def list_alert_events(
    request: Request,
    limit: int = 20,
    offset: int = 0,
    rule_id: str | None = None,
    status: Literal["firing", "resolved", "acked"] | None = None,
    severity: Literal["P1", "P2", "P3"] | None = None,
) -> Any:
    """List alert events (newest first) with optional filters."""
    try:
        events = await alert_repo.list_events(
            limit=limit,
            offset=offset,
            rule_id=rule_id,
            status=status,
            severity=severity,
        )
        return [_event_out(event, rule_name) for event, rule_name in events]
    except Exception as e:
        logger.error("Error listing alert events: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.post("/api/alerts/events/{event_id}/ack", response_model=AlertEventOut)
async def ack_alert_event(event_id: str, request: Request) -> Any:
    """Acknowledge a firing/resolved event; idempotent for acked events."""
    try:
        event = await alert_repo.ack_event(event_id)
        if event is None:
            raise error_response(ErrorCode.ALERT_EVENT_NOT_FOUND, detail="事件不存在")
        return _event_out(event, event.rule_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error acking alert event %s: %s", event_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


# ── Notifications ───────────────────────────────────────────────────────────


@router.get("/api/alerts/notifications/unread-count")
async def unread_notification_count(request: Request) -> dict[str, int]:
    """Return the current user's unread notification count (bell badge)."""
    try:
        from auth import get_user_id

        user_id = get_user_id(request)
        count = await alert_repo.count_unread_notifications(user_id)
        return {"count": count}
    except Exception as e:
        logger.error("Error counting unread notifications: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.get("/api/alerts/notifications", response_model=list[NotificationOut])
async def list_notifications(
    request: Request,
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False,
) -> Any:
    """List the current user's in-app notifications (newest first)."""
    try:
        from auth import get_user_id

        user_id = get_user_id(request)
        rows = await alert_repo.list_notifications(user_id=user_id, limit=limit, offset=offset, unread_only=unread_only)
        return [_notification_out(r) for r in rows]
    except Exception as e:
        logger.error("Error listing notifications: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.post("/api/alerts/notifications/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(notification_id: str, request: Request) -> Any:
    """Mark one notification as read (owner-scoped)."""
    try:
        from auth import get_user_id

        user_id = get_user_id(request)
        row = await alert_repo.mark_notification_read(user_id, notification_id)
        if row is None:
            raise error_response(ErrorCode.NOTIFICATION_NOT_FOUND, detail="通知不存在或无权访问")
        return _notification_out(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error marking notification %s read: %s", notification_id, e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.post("/api/alerts/notifications/read-all")
async def mark_all_notifications_read(request: Request) -> dict[str, int]:
    """Mark all of the current user's notifications as read."""
    try:
        from auth import get_user_id

        user_id = get_user_id(request)
        count = await alert_repo.mark_all_notifications_read(user_id)
        return {"count": count}
    except Exception as e:
        logger.error("Error marking all notifications read: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


# ── Subscriptions ───────────────────────────────────────────────────────────


@router.get("/api/alerts/subscriptions")
async def list_subscriptions(request: Request) -> list[dict[str, Any]]:
    """Return the current user's alert delivery subscriptions."""
    try:
        from auth import get_user_id

        user_id = get_user_id(request)
        rows = await alert_repo.list_subscriptions(user_id)
        return [_subscription_out(r) for r in rows]
    except Exception as e:
        logger.error("Error listing subscriptions: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e


@router.put("/api/alerts/subscriptions")
async def replace_subscriptions(req: SubscriptionReplaceRequest, request: Request) -> list[dict[str, Any]]:
    """Atomically replace the current user's subscriptions."""
    try:
        from auth import get_user_id

        user_id = get_user_id(request)
        items = [s.model_dump(exclude_none=True) for s in req.subscriptions]
        rows = await alert_repo.replace_subscriptions(user_id, items)
        return [_subscription_out(r) for r in rows]
    except Exception as e:
        logger.error("Error replacing subscriptions: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR) from e
