# 7. 运维监控

> 系统仪表盘、审计日志、Debug 调试工具。

---

## 架构树

```
7. 运维监控
├── 7.1 仪表盘
│   ├── 功能：统计概览 / 最近活动 / 系统健康 / 定时刷新
│   ├── FE: MonitorCenter, MonitorStats, MonitorActivity, MonitorHealth
│   ├── BE: routers/admin.py → repository/admin_stats.py
│   └── DB: 多表聚合
│
├── 7.2 审计日志
│   ├── 功能：命令执行日志 / 操作审计
│   ├── FE: LogAudit
│   ├── BE: routers/admin.py → repository/admin_stats.py
│   └── DB: command_logs, audit_logs
│
└── 7.3 Debug 工具
    ├── 功能：事件查询 / Trace 分析 / 错误报告 / Circuit Breaker / Startup Guard
    └── BE: observability/router.py, analyzer.py, store.py, startup_guard.py
```

---

## 7.1 仪表盘

| 项目 | 内容 |
|------|------|
| **功能** | 统计概览（运行数 / Agent 数 / Token / 告警） |
| | 最近活动列表 |
| | 系统健康状态（DB / Redis / Circuit Breaker） |
| | 定时刷新（60s interval） |
| **前端** | MonitorCenter, MonitorStats, MonitorActivity, MonitorHealth |
| **后端** | `routers/admin.py` → `repository/admin_stats.py` |
| **ORM** | 多表聚合 |
| **状态** | ✅ |

## 7.2 审计日志

| 项目 | 内容 |
|------|------|
| **功能** | 命令执行日志（分页 / 搜索 / 级别过滤） |
| | 操作审计记录 |
| **前端** | LogAudit |
| **后端** | `routers/admin.py` → `repository/admin_stats.py` |
| **ORM** | `CommandLogDB` → `command_logs`, `AuditLogDB` → `audit_logs` |
| **状态** | ✅ |

## 7.3 Debug 工具

| 项目 | 内容 |
|------|------|
| **功能** | 事件查询（按 trace / level / 时间 / 关键词） |
| | Trace 分析 |
| | 错误报告 |
| | Circuit Breaker 状态 |
| | Startup Guard |
| **后端** | `observability/router.py`, `observability/analyzer.py` |
| | `observability/store.py`, `observability/startup_guard.py` |
| **状态** | ✅ |
