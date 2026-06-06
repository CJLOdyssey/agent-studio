---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 子域：记忆系统

> 领域：知识管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 子域概述

从对话中提取记忆、存储、查询，支持跨会话上下文延续。

---

## 功能清单 (TDD)

| # | 功能 | 文件 | 状态 |
|---|---|---|---|
| 1 | 提取记忆 | 01-extract-memory.md | ⬜ |
| 2 | 保存记忆 | 02-save-memory.md | ⬜ |
| 3 | 查询会话记忆 | 03-list-memory.md | ⬜ |
| 4 | 删除记忆 | 04-delete-memory.md | ⬜ |
| 5 | 清空会话记忆 | 05-clear-memory.md | ⬜ |

---

## 数据库表

```sql
CREATE TABLE memory_entries (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    run_id UUID REFERENCES project_runs(id),
    content TEXT,
    content_type VARCHAR(64),  -- pm_document, code, review
    embedding vector(1536),
    created_at TIMESTAMPTZ
);
```

---

## 进度

| 指标 | 值 |
|---|---|
| 功能 | 5 |
| 已完成 | 0 |
| 进度 | 0% |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
