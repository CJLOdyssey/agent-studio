---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 子域：消息管理

> 领域：对话协作
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 子域概述

消息的存储、查询、分页，支持按会话和轮次过滤。

---

## 功能清单 (TDD)

| # | 功能 | 文件 | 状态 |
|---|---|---|---|
| 1 | 保存消息 | 01-save-message.md | ⬜ |
| 2 | 查询会话消息 | 02-list-messages.md | ⬜ |
| 3 | 按轮次查询 | 03-list-messages-by-round.md | ⬜ |

---

## 数据库表

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    run_id UUID REFERENCES project_runs(id),
    role VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    round_number INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ
);
```

---

## 进度

| 指标 | 值 |
|---|---|
| 功能 | 3 |
| 已完成 | 0 |
| 进度 | 0% |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
