"""监控中心 —— 告警规则、事件、通知与 SLO 预算。

路由与应用生命周期使用的入口：
    from monitoring import get_evaluator, get_metric_service, get_notification_service, get_slo_service
"""

from monitoring.evaluator import AlertEvaluator, get_evaluator
from monitoring.metrics import MetricService, get_metric_service, supported_metrics
from monitoring.notifications import NotificationService, get_notification_service
from monitoring.schemas import (
    AlertEventOut,
    AlertRuleCreate,
    AlertRuleOut,
    AlertRuleUpdate,
    NotificationOut,
    NotificationSubscriptionIn,
    SLOSnapshot,
)
from monitoring.slo import SLOService, get_slo_service

__all__ = [
    "AlertEvaluator",
    "AlertEventOut",
    "AlertRuleCreate",
    "AlertRuleOut",
    "AlertRuleUpdate",
    "MetricService",
    "NotificationOut",
    "NotificationService",
    "NotificationSubscriptionIn",
    "SLOService",
    "SLOSnapshot",
    "get_evaluator",
    "get_metric_service",
    "get_notification_service",
    "get_slo_service",
    "supported_metrics",
]
