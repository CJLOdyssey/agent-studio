"""Pydantic schemas for the monitoring module (alert rules, events, notifications, SLO)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field
from pydantic.alias_generators import to_camel

MetricType = Literal["success_rate", "p95_latency", "avg_latency", "daily_cost", "error_count"]
Operator = Literal["gt", "gte", "lt", "lte"]
Severity = Literal["P1", "P2", "P3"]


class CamelModel(BaseModel):
    """Base model that serializes to camelCase (frontend convention)."""

    model_config = {"alias_generator": to_camel, "populate_by_name": True}


class AlertRuleCreate(CamelModel):
    name: str = Field(min_length=1, max_length=128)
    metric_type: str
    operator: Operator
    threshold: float
    window_seconds: int = Field(default=3600, ge=60)
    severity: Severity
    runbook_url: str | None = Field(default=None, max_length=512)
    cooldown_seconds: int = Field(default=300, ge=0)
    team_id: str | None = None


class AlertRuleUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    metric_type: str | None = None
    operator: Operator | None = None
    threshold: float | None = None
    window_seconds: int | None = Field(default=None, ge=60)
    severity: Severity | None = None
    runbook_url: str | None = Field(default=None, max_length=512)
    cooldown_seconds: int | None = Field(default=None, ge=0)
    team_id: str | None = None
    enabled: bool | None = None
    silence_until: datetime | None = None


class AlertRuleOut(CamelModel):
    id: str
    name: str
    metric_type: str
    operator: str
    threshold: float
    window_seconds: int
    severity: str
    runbook_url: str | None
    cooldown_seconds: int
    silence_until: datetime | None
    team_id: str | None
    enabled: bool
    created_by: str
    created_at: datetime
    updated_at: datetime


class AlertEventOut(CamelModel):
    id: str
    rule_id: str
    rule_name: str
    metric_value: float
    threshold: float
    severity: str
    status: str
    message: str
    triggered_at: datetime
    resolved_at: datetime | None
    acked_at: datetime | None


class NotificationOut(CamelModel):
    id: str
    user_id: str
    title: str
    body: str
    type: str
    link: str | None
    read_at: datetime | None
    created_at: datetime


class NotificationSubscriptionIn(CamelModel):
    severity: Severity
    team_id: str | None = None
    enabled: bool = True


class SLOSnapshot(CamelModel):
    target_percent: float
    window_seconds: int
    total_requests: int
    error_count: int
    sli_percent: float
    budget_remaining_percent: float
    burn_rate: float


class RuleEvaluateResult(CamelModel):
    rule_id: str
    metric_value: float
    breach: bool
