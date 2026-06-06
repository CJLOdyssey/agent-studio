---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 子域：工具管理

> 领域：AI 执行
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 子域概述

工具的定义、生成、导入、CRUD 管理。

---

## 功能清单 (TDD)

| # | 功能 | 文件 | 状态 |
|---|---|---|---|
| 1 | 创建工具 | 01-create-tool.md | ⬜ |
| 2 | 查询工具列表 | 02-list-tools.md | ⬜ |
| 3 | 更新工具 | 03-update-tool.md | ⬜ |
| 4 | 删除工具 | 04-delete-tool.md | ⬜ |
| 5 | 自然语言生成 | 05-generate-tool.md | ⬜ |
| 6 | 导入工具 | 06-import-tool.md | ⬜ |

---

## 数据库表

```sql
CREATE TABLE tools (
    id UUID PRIMARY KEY,
    name VARCHAR(64) UNIQUE,
    description TEXT,
    source_type VARCHAR(32),  -- generated, imported, manual
    code TEXT,
    tool_def JSONB,
    parameters JSONB,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
);
```

---

## 进度

| 指标 | 值 |
|---|---|
| 功能 | 6 |
| 已完成 | 0 |
| 进度 | 0% |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
