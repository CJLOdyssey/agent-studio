---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 子域：审计日志

> 领域：基础设施
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 子域概述

全局审计日志，记录所有配置变更。

---

## 功能清单 (TDD)

| # | 功能 | 文件 | 状态 |
|---|---|---|---|
| 1 | 写入审计日志 | 01-write-log.md | ⬜ |
| 2 | 查询审计日志 | 02-query-log.md | ⬜ |
| 3 | 按实体查询 | 03-query-by-entity.md | ⬜ |
| 4 | 按时间范围查询 | 04-query-by-time.md | ⬜ |

---

## 数据库表

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(32),
    entity_id UUID,
    action VARCHAR(32),
    field_name VARCHAR(64),
    old_value JSONB,
    new_value JSONB,
    changed_by VARCHAR(128),
    created_at TIMESTAMPTZ
);
```

---

## 进度

| 指标 | 值 |
|---|---|
| 功能 | 4 |
| 已完成 | 0 |
| 进度 | 0% |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
