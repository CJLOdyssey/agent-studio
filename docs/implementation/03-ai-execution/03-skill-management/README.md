---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 子域：技能管理

> 领域：AI 执行
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 子域概述

技能的定义、生成、导入、CRUD 管理。

---

## 功能清单 (TDD)

| # | 功能 | 文件 | 状态 |
|---|---|---|---|
| 1 | 创建技能 | 01-create-skill.md | ⬜ |
| 2 | 查询技能列表 | 02-list-skills.md | ⬜ |
| 3 | 更新技能 | 03-update-skill.md | ⬜ |
| 4 | 删除技能 | 04-delete-skill.md | ⬜ |
| 5 | 自然语言生成 | 05-generate-skill.md | ⬜ |
| 6 | 导入技能 | 06-import-skill.md | ⬜ |

---

## 数据库表

```sql
CREATE TABLE skills (
    id UUID PRIMARY KEY,
    name VARCHAR(64) UNIQUE,
    description TEXT,
    source_type VARCHAR(32),  -- generated, imported, manual
    content TEXT,
    triggers JSONB,
    instructions TEXT,
    examples JSONB,
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
